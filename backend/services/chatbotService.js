const db = require("../models/db");
const firestoreRepo = require("../repositories/firestoreRepo");
const { parseMessage } = require("./intentParser");
const { scoreEvents } = require("./recommendationService");
const { buildRoute } = require("./routePlannerService");
const { geocodeFirstResult } = require("./geocodingService");
const {
  haversineKm,
  estimateWalkMinutes,
  estimateCarMinutes,
  estimateTransitMinutes,
  recommendTransportMode,
} = require("./distanceUtils");
const {
  buildClarificationResponse,
  buildRecommendationResponse,
  buildRouteResponse,
  buildDistanceResponse,
  buildFavoritesResponse,
} = require("./responseBuilders");

let municipiosCache = {
  data: [],
  expiresAt: 0,
};

function parseTags(tagsJson) {
  if (!tagsJson) return [];
  if (Array.isArray(tagsJson)) return tagsJson;

  try {
    const parsed = typeof tagsJson === "string" ? JSON.parse(tagsJson) : tagsJson;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function filterEventsByTimeWindow(events = [], timeWindow = null) {
  if (!timeWindow) return events;

  return events.filter((event) => {
    const rawDate = event?.start_at || event?.start;
    if (!rawDate) return false;

    const date = new Date(rawDate);
    const hour = date.getHours();

    if (timeWindow === "morning") return hour >= 6 && hour < 12;
    if (timeWindow === "afternoon") return hour >= 12 && hour < 20;
    if (timeWindow === "night") return hour >= 20 && hour <= 23;

    return true;
  });
}

function looksLikeLocationText(message = "") {
  const text = String(message).toLowerCase().trim();

  if (!text) return false;

  return (
    text.includes("calle") ||
    text.includes("c/") ||
    text.includes("avenida") ||
    text.includes("av.") ||
    text.includes("plaza") ||
    text.includes("paseo") ||
    text.includes("hotel") ||
    text.includes("hostal") ||
    text.includes("apartamento") ||
    text.includes("madrid") ||
    /\d+/.test(text)
  );
}

function buildGoogleMapsDirectionsUrl(origin, destination, mode = "transit") {
  if (
    !origin ||
    typeof origin.lat !== "number" ||
    typeof origin.lng !== "number" ||
    !destination ||
    typeof destination.lat !== "number" ||
    typeof destination.lng !== "number"
  ) {
    return null;
  }

  const params = new URLSearchParams({
    api: "1",
    origin: `${origin.lat},${origin.lng}`,
    destination: `${destination.lat},${destination.lng}`,
    travelmode: mode,
  });

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function buildTransportExplanation(distanceKm, recommendedMode) {
  if (recommendedMode === "walking") {
    return "Está bastante cerca, así que ir andando es una opción muy cómoda.";
  }

  if (recommendedMode === "transit") {
    return "Te recomiendo transporte público porque suele ser la opción más práctica para este trayecto urbano.";
  }

  if (recommendedMode === "driving") {
    return "Te recomiendo coche si priorizas rapidez, aunque puede depender del tráfico y del aparcamiento.";
  }

  return `La mejor opción estimada es ${recommendedMode}.`;
}

function buildRouteInfo(originLocation, event, distanceKm, walkMinutes, carMinutes, transitMinutes, recommendedMode) {
  return {
    origin: originLocation,
    distance_km: distanceKm,
    walk_minutes: walkMinutes,
    car_minutes: carMinutes,
    transit_minutes: transitMinutes,
    recommended_mode: recommendedMode,
    maps_links: {
      walking: buildGoogleMapsDirectionsUrl(originLocation, event, "walking"),
      driving: buildGoogleMapsDirectionsUrl(originLocation, event, "driving"),
      transit: buildGoogleMapsDirectionsUrl(originLocation, event, "transit"),
    },
  };
}

async function getDistinctMunicipiosMadrid() {
  const now = Date.now();

  if (municipiosCache.expiresAt > now && municipiosCache.data.length > 0) {
    return municipiosCache.data;
  }

  const [rows] = await db.query(`
    SELECT DISTINCT municipio
    FROM fiestas
    WHERE estado = 'published'
      AND is_deleted = 0
      AND provincia = 'Madrid'
      AND municipio IS NOT NULL
      AND municipio <> ''
    ORDER BY municipio ASC
  `);

  municipiosCache = {
    data: rows.map((r) => r.municipio),
    expiresAt: now + 10 * 60 * 1000,
  };

  return municipiosCache.data;
}

async function getEventsByIds(ids = []) {
  if (!Array.isArray(ids) || ids.length === 0) return [];

  const cleanIds = ids.map(Number).filter(Boolean);
  if (cleanIds.length === 0) return [];

  const placeholders = cleanIds.map(() => "?").join(",");

  const [rows] = await db.query(
    `
    SELECT
      f.id,
      f.titulo,
      f.descripcion,
      f.start_at,
      f.end_at,
      f.tipo,
      f.categoria,
      f.categoria_detalle,
      f.tags_json,
      f.estado,
      f.imagen,
      f.provincia,
      f.municipio,
      f.direccion,
      CAST(f.lat AS DOUBLE) AS lat,
      CAST(f.lng AS DOUBLE) AS lng,
      f.created_at,
      f.updated_at,
      COALESCE(AVG(CASE WHEN c.status = 'visible' THEN c.estrellas END), 0) AS rating_avg,
      COUNT(CASE WHEN c.status = 'visible' THEN c.id END) AS rating_count
    FROM fiestas f
    LEFT JOIN comentarios c ON c.fiesta_id = f.id
    WHERE f.id IN (${placeholders})
      AND f.estado = 'published'
      AND f.is_deleted = 0
    GROUP BY f.id
    `,
    cleanIds
  );

  return rows.map((row) => ({
    ...row,
    tags: parseTags(row.tags_json),
  }));
}

async function searchCandidateEvents(intent, limit = 100) {
  let sql = `
    SELECT
      f.id,
      f.titulo,
      f.descripcion,
      f.start_at,
      f.end_at,
      f.tipo,
      f.categoria,
      f.categoria_detalle,
      f.tags_json,
      f.estado,
      f.imagen,
      f.provincia,
      f.municipio,
      f.direccion,
      CAST(f.lat AS DOUBLE) AS lat,
      CAST(f.lng AS DOUBLE) AS lng,
      f.created_at,
      f.updated_at,
      COALESCE(AVG(CASE WHEN c.status = 'visible' THEN c.estrellas END), 0) AS rating_avg,
      COUNT(CASE WHEN c.status = 'visible' THEN c.id END) AS rating_count
    FROM fiestas f
    LEFT JOIN comentarios c ON c.fiesta_id = f.id
    WHERE f.estado = 'published'
      AND f.is_deleted = 0
      AND f.provincia = 'Madrid'
  `;

  const params = [];

  if (intent.municipio) {
    sql += ` AND f.municipio = ?`;
    params.push(intent.municipio);
  }

  if (intent.dateRange?.from && intent.dateRange?.to) {
    sql += ` AND f.start_at >= ? AND f.start_at < ?`;
    params.push(intent.dateRange.from, intent.dateRange.to);
  }

  if (intent.categoria) {
    sql += ` AND f.categoria = ?`;
    params.push(intent.categoria);
  }

  if (Array.isArray(intent.tags) && intent.tags.length > 0) {
    const tagClauses = intent.tags
      .map(() => `JSON_CONTAINS(f.tags_json, JSON_QUOTE(?))`)
      .join(" OR ");
    sql += ` AND (${tagClauses})`;
    params.push(...intent.tags);
  }

  sql += ` GROUP BY f.id ORDER BY f.start_at ASC LIMIT ?`;
  params.push(limit);

  const [rows] = await db.query(sql, params);

  return rows.map((row) => ({
    ...row,
    tags: parseTags(row.tags_json),
  }));
}

async function buildUserProfile(uid) {
  const [preferences, savedItems, interactions, recommendationState] = await Promise.all([
    firestoreRepo.getUserPreferences(uid),
    firestoreRepo.getUserSavedItems(uid, 100),
    firestoreRepo.getRecentInteractions(uid, 200),
    firestoreRepo.getRecommendationState(uid),
  ]);

  return {
    preferences,
    savedItems,
    interactions,
    recommendationState,
  };
}

function resolveLocation(userProfile, intent) {
  const permanentBase = userProfile.preferences?.base_location || null;
  const temporaryLocation = userProfile.recommendationState?.temporary_location || null;

  if (
    intent.locationAlias === "hotel" ||
    intent.locationAlias === "alojamiento" ||
    intent.locationAlias === "apartamento"
  ) {
    return temporaryLocation || permanentBase;
  }

  if (intent.locationAlias === "casa") {
    return permanentBase;
  }

  if (intent.useBaseLocation || intent.nearBaseLocation) {
    return temporaryLocation || permanentBase;
  }

  return permanentBase;
}

async function saveBaseLocationFromIntent(uid, rawLocationText) {
  const result = await geocodeFirstResult(rawLocationText);

  if (!result || typeof result.lat !== "number" || typeof result.lng !== "number") {
    return null;
  }

  const baseLocation = {
    label: "Casa",
    address: result.address,
    lat: result.lat,
    lng: result.lng,
  };

  await firestoreRepo.updateBaseLocation(uid, baseLocation);

  return baseLocation;
}

async function saveTemporaryLocationFromIntent(uid, rawLocationText) {
  const result = await geocodeFirstResult(rawLocationText);

  if (!result || typeof result.lat !== "number" || typeof result.lng !== "number") {
    return null;
  }

  const temporaryLocation = {
    label: "Hotel",
    address: result.address,
    lat: result.lat,
    lng: result.lng,
  };

  await firestoreRepo.saveRecommendationState(uid, {
    temporary_location: temporaryLocation,
  });

  return temporaryLocation;
}

async function processMessage({
  uid,
  message,
  conversationState = null,
  visibleEventIds = [],
  selectedEventId = null,
}) {
  const userProfile = await buildUserProfile(uid);
  const municipios = await getDistinctMunicipiosMadrid();

  const intent = parseMessage(
    message,
    municipios,
    conversationState || userProfile.recommendationState?.lastIntent || null
  );

  if (conversationState?.pendingAction && looksLikeLocationText(message)) {
    const resolvedLocation = await geocodeFirstResult(message);

    if (!resolvedLocation) {
      return {
        reply:
          "No he podido localizar esa ubicación. Prueba con una dirección, calle, hotel o lugar más concreto.",
        action: "ask_location",
        intent,
        missing: [],
        data: null,
        conversationState,
      };
    }

    const temporaryOrigin = {
      label: "Ubicación actual",
      address: resolvedLocation.address,
      lat: resolvedLocation.lat,
      lng: resolvedLocation.lng,
    };

    if (conversationState.pendingAction === "awaiting_current_location_for_distance") {
      const targetEventId =
        conversationState.targetEventId ||
        selectedEventId ||
        visibleEventIds?.[0] ||
        null;

      if (!targetEventId) {
        return {
          reply:
            "Ya tengo tu ubicación, pero no tengo claro a qué evento te refieres.",
          action: "none",
          intent,
          missing: [],
          data: {
            location: temporaryOrigin,
          },
          conversationState: null,
        };
      }

      const targetEvents = await getEventsByIds([targetEventId]);
      const event = targetEvents[0];

      if (!event) {
        return {
          reply:
            "Ya tengo tu ubicación, pero no he podido encontrar el evento para calcular cómo llegar.",
          action: "none",
          intent,
          missing: [],
          data: {
            location: temporaryOrigin,
          },
          conversationState: null,
        };
      }

      if (typeof event.lat !== "number" || typeof event.lng !== "number") {
        return buildDistanceResponse({
          reply:
            "He localizado tu ubicación, pero este evento no tiene coordenadas válidas para calcular cómo llegar.",
          data: {
            events: [event],
            routeInfo: null,
          },
        });
      }

      const distanceKm = haversineKm(
        temporaryOrigin.lat,
        temporaryOrigin.lng,
        event.lat,
        event.lng
      );
      const walkMinutes = estimateWalkMinutes(distanceKm);
      const carMinutes = estimateCarMinutes(distanceKm);
      const transitMinutes = estimateTransitMinutes(distanceKm);
      const recommendedMode = recommendTransportMode(distanceKm);
      const transportExplanation = buildTransportExplanation(distanceKm, recommendedMode);

      return buildDistanceResponse({
        reply: `Perfecto. Tomo ${temporaryOrigin.address} como tu ubicación actual para esta consulta. El evento está a ${distanceKm.toFixed(
          2
        )} km. ${transportExplanation} Andando tardarías unos ${walkMinutes} min, en coche unos ${carMinutes} min y en transporte público unos ${transitMinutes} min aproximadamente.`,
        data: {
          events: [event],
          routeInfo: buildRouteInfo(
            temporaryOrigin,
            event,
            distanceKm,
            walkMinutes,
            carMinutes,
            transitMinutes,
            recommendedMode
          ),
        },
      });
    }

    if (conversationState.pendingAction === "awaiting_current_location_for_route") {
      const baseIntent = conversationState.pendingRouteIntent || intent;

      let candidates = await searchCandidateEvents(baseIntent, 100);
      candidates = filterEventsByTimeWindow(candidates, baseIntent.timeWindow);

      if (!candidates.length) {
        return {
          reply:
            "He localizado tu ubicación, pero no he encontrado planes que encajen con esa ruta.",
          action: "show_route",
          intent: baseIntent,
          missing: [],
          data: { route: [] },
          conversationState: null,
        };
      }

      const ranked = scoreEvents(candidates, userProfile, baseIntent, temporaryOrigin);
      const route = buildRoute(ranked, temporaryOrigin, { maxItems: 4 });

      await firestoreRepo.saveRecommendationState(uid, {
        lastIntent: baseIntent,
        lastSuggestedEventIds: route.map((item) => item.id),
      });

      if (!route.length) {
        return {
          reply:
            "He localizado tu ubicación, pero no puedo montar una ruta coherente con los horarios y distancias actuales.",
          action: "show_route",
          intent: baseIntent,
          missing: [],
          data: { route: [] },
          conversationState: null,
        };
      }

      const routeResponse = buildRouteResponse(route, baseIntent);

      return {
        ...routeResponse,
        reply: `Perfecto. Tomo ${temporaryOrigin.address} como punto de salida para esta consulta.\n\n${routeResponse.reply}`,
        conversationState: null,
      };
    }
  }

  if (intent.wantsToSaveBaseLocation && intent.rawLocationText) {
    const savedLocation = await saveBaseLocationFromIntent(uid, intent.rawLocationText);

    if (!savedLocation) {
      return {
        reply:
          "No he podido localizar esa dirección de casa. Prueba con una dirección más concreta.",
        action: "none",
        intent,
        missing: [],
        data: { location: null },
      };
    }

    return {
      reply: `Perfecto. He guardado tu casa en ${savedLocation.address}.`,
      action: "none",
      intent,
      missing: [],
      data: { location: savedLocation },
      conversationState: {
        ...conversationState,
        lastIntent: intent,
      },
    };
  }

  if (intent.wantsToSaveTemporaryLocation && intent.rawLocationText) {
    const savedLocation = await saveTemporaryLocationFromIntent(uid, intent.rawLocationText);

    if (!savedLocation) {
      return {
        reply:
          "No he podido localizar esa ubicación. Prueba con una dirección o un nombre más concreto.",
        action: "none",
        intent,
        missing: [],
        data: { location: null },
      };
    }

    return {
      reply: `Perfecto. Tomaré ${savedLocation.address} como tu ubicación actual.`,
      action: "none",
      intent,
      missing: [],
      data: { location: savedLocation },
      conversationState: {
        ...conversationState,
        lastIntent: intent,
      },
    };
  }

  if (intent.missing.length > 0) {
    if (intent.type === "route" && intent.missing.includes("municipio_or_area")) {
      return {
        reply:
          "Para prepararte una ruta, dime en qué municipio o zona la quieres. Por ejemplo: 'una ruta en El Escorial este finde' o 'ruta en Madrid para esta tarde'.",
        action: "ask_area",
        intent,
        missing: intent.missing,
        data: null,
        conversationState: {
          ...(conversationState || {}),
          lastIntent: intent,
        },
      };
    }

    return buildClarificationResponse(intent);
  }

  if (intent.type === "favorites") {
    const favoriteIds = userProfile.savedItems
      .map((x) => Number(x.fiestaId))
      .filter(Boolean);

    const events = await getEventsByIds(favoriteIds);
    return buildFavoritesResponse(events, intent);
  }

  if (intent.type === "distance") {
    const originLocation = resolveLocation(userProfile, intent);

    if (
      !originLocation ||
      typeof originLocation.lat !== "number" ||
      typeof originLocation.lng !== "number"
    ) {
      const fallbackTargetEventId =
        selectedEventId ||
        (Array.isArray(visibleEventIds) && visibleEventIds.length > 0
          ? visibleEventIds[0]
          : userProfile.recommendationState?.lastSuggestedEventIds?.[0] || null);

      return {
        reply:
          "Necesito tu ubicación actual para decirte cómo llegar. Escríbeme una dirección, calle, hotel o lugar.",
        action: "ask_location",
        intent,
        missing: [],
        data: null,
        conversationState: {
          ...(conversationState || {}),
          pendingAction: "awaiting_current_location_for_distance",
          targetEventId: fallbackTargetEventId,
        },
      };
    }

    let targetEvents = [];

    if (selectedEventId) {
      targetEvents = await getEventsByIds([selectedEventId]);
    } else if (Array.isArray(visibleEventIds) && visibleEventIds.length > 0) {
      targetEvents = await getEventsByIds([visibleEventIds[0]]);
    } else {
      const lastIds = userProfile.recommendationState?.lastSuggestedEventIds || [];
      targetEvents = await getEventsByIds(lastIds.slice(0, 1));
    }

    const event = targetEvents[0];

    if (!event) {
      return buildDistanceResponse({
        reply: "No tengo claro a qué evento te refieres para calcular cómo llegar.",
        data: {
          events: [],
          routeInfo: null,
        },
      });
    }

    if (typeof event.lat !== "number" || typeof event.lng !== "number") {
      return buildDistanceResponse({
        reply: "No puedo calcular cómo llegar porque este evento no tiene coordenadas válidas.",
        data: {
          events: [event],
          routeInfo: null,
        },
      });
    }

    const distanceKm = haversineKm(originLocation.lat, originLocation.lng, event.lat, event.lng);
    const walkMinutes = estimateWalkMinutes(distanceKm);
    const carMinutes = estimateCarMinutes(distanceKm);
    const transitMinutes = estimateTransitMinutes(distanceKm);
    const recommendedMode = recommendTransportMode(distanceKm);
    const transportExplanation = buildTransportExplanation(distanceKm, recommendedMode);

    return buildDistanceResponse({
      reply: `El evento está a ${distanceKm.toFixed(
        2
      )} km de ${originLocation.label || "tu ubicación"}. ${transportExplanation} Andando tardarías unos ${walkMinutes} min, en coche unos ${carMinutes} min y en transporte público unos ${transitMinutes} min aproximadamente.`,
      data: {
        events: [event],
        routeInfo: buildRouteInfo(
          originLocation,
          event,
          distanceKm,
          walkMinutes,
          carMinutes,
          transitMinutes,
          recommendedMode
        ),
      },
    });
  }

  let candidates = await searchCandidateEvents(intent, 100);
  candidates = filterEventsByTimeWindow(candidates, intent.timeWindow);

  if (!candidates.length) {
    return {
      reply:
        "No he encontrado planes que encajen con lo que has pedido. Prueba con otro municipio, otra fecha o una categoría distinta.",
      action: "show_recommendations",
      intent,
      missing: [],
      followUpQuestions: [
        "¿Quieres que busque en otro municipio?",
        "¿Prefieres ampliar a este finde o a esta semana?",
      ],
      data: { events: [] },
    };
  }

  const originLocation =
    intent.useBaseLocation || intent.nearBaseLocation
      ? resolveLocation(userProfile, intent)
      : null;

  const ranked = scoreEvents(candidates, userProfile, intent, originLocation);

  if (intent.type === "route") {
    const wantsRouteFromCurrentLocation =
      intent.useBaseLocation || intent.nearBaseLocation;

    if (wantsRouteFromCurrentLocation && !originLocation) {
      return {
        reply:
          "Para prepararte esa ruta necesito saber desde dónde sales. Escríbeme una dirección, calle, hotel o lugar.",
        action: "ask_location",
        intent,
        missing: [],
        data: null,
        conversationState: {
          ...(conversationState || {}),
          pendingAction: "awaiting_current_location_for_route",
          pendingRouteIntent: intent,
        },
      };
    }

    const route = buildRoute(ranked, originLocation, { maxItems: 4 });

    await firestoreRepo.saveRecommendationState(uid, {
      lastIntent: intent,
      lastSuggestedEventIds: route.map((item) => item.id),
    });

    if (!route.length) {
      return {
        reply:
          "He encontrado planes, pero no puedo montar una ruta coherente con los horarios y distancias actuales.",
        action: "show_route",
        intent,
        missing: [],
        followUpQuestions: [
          "¿Quieres que te enseñe igualmente los planes encontrados?",
          "¿Quieres probar con otra fecha o municipio?",
        ],
        data: { route: [] },
      };
    }

    return buildRouteResponse(route, intent);
  }

  const finalRanked = ranked.slice(0, 8);

  await firestoreRepo.saveRecommendationState(uid, {
    lastIntent: intent,
    lastSuggestedEventIds: finalRanked.map((item) => item.id),
  });

  return buildRecommendationResponse(finalRanked, intent);
}

module.exports = {
  processMessage,
};