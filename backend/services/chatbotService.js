const db = require("../models/db");
const firestoreRepo = require("../repositories/firestoreRepo");
const { parseMessage } = require("./intentParser");
const { scoreEvents } = require("./recommendationService");
const { buildRoute } = require("./routePlannerService");
const { haversineKm } = require("./distanceUtils");
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

function enrichDistanceResults(events) {
  if (!Array.isArray(events) || events.length === 0) return [];

  return events.map((event, index) => {
    const previous = index > 0 ? events[index - 1] : null;

    const distance_from_previous_km =
      previous &&
      typeof previous.lat === "number" &&
      typeof previous.lng === "number" &&
      typeof event.lat === "number" &&
      typeof event.lng === "number"
        ? haversineKm(previous.lat, previous.lng, event.lat, event.lng)
        : null;

    return {
      ...event,
      distance_from_previous_km,
      reasons:
        distance_from_previous_km != null
          ? [`A ${distance_from_previous_km.toFixed(2)} km del plan anterior`]
          : ["No se puede calcular la distancia exacta con los datos actuales"],
      score: 0.5,
    };
  });
}

async function processMessage({ uid, message, conversationState = null, visibleEventIds = [] }) {
  const userProfile = await buildUserProfile(uid);
  const municipios = await getDistinctMunicipiosMadrid();

  const intent = parseMessage(
    message,
    municipios,
    conversationState || userProfile.recommendationState?.lastIntent || null
  );

  if (intent.missing.length > 0) {
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
    let baseEvents = [];

    if (Array.isArray(visibleEventIds) && visibleEventIds.length > 0) {
      baseEvents = await getEventsByIds(visibleEventIds.slice(0, 10));
    } else {
      const lastIds = userProfile.recommendationState?.lastSuggestedEventIds || [];
      baseEvents = await getEventsByIds(lastIds.slice(0, 10));
    }

    const enriched = enrichDistanceResults(baseEvents);
    return buildDistanceResponse(enriched, intent);
  }

  const candidates = await searchCandidateEvents(intent, 100);

  if (!candidates.length) {
    return {
      reply: "No he encontrado planes que encajen con lo que has pedido. Prueba con otro municipio, otra fecha o una categoría distinta.",
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

  if (intent.type === "route") {
    const baseLocation = userProfile.preferences?.base_location || null;

    const route = buildRoute(
      candidates,
      intent.useBaseLocation ? baseLocation : null,
      { maxItems: 4 }
    );

    await firestoreRepo.saveRecommendationState(uid, {
      lastIntent: intent,
      lastSuggestedEventIds: route.map((item) => item.id),
    });

    if (!route.length) {
      return {
        reply: "He encontrado planes, pero no puedo montar una ruta coherente con los horarios actuales.",
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

  const ranked = scoreEvents(candidates, userProfile, intent).slice(0, 8);

  await firestoreRepo.saveRecommendationState(uid, {
    lastIntent: intent,
    lastSuggestedEventIds: ranked.map((item) => item.id),
  });

  return buildRecommendationResponse(ranked, intent);
}

module.exports = {
  processMessage,
};