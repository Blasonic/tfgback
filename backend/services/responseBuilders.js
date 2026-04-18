function buildClarificationResponse(intent) {
  if (intent.missing.includes("municipio_or_base_location")) {
    return {
      reply:
        "Para prepararte una ruta necesito que me digas un municipio o que uses tu ubicación base.",
      action: "ask_clarification",
      intent,
      missing: intent.missing,
      followUpQuestions: [
        "¿En qué municipio quieres la ruta?",
        "También puedes pedirla cerca de tu ubicación base.",
      ],
      data: null,
    };
  }

  return {
    reply: "Necesito un poco más de información para afinar la búsqueda.",
    action: "ask_clarification",
    intent,
    missing: intent.missing,
    followUpQuestions: [],
    data: null,
  };
}

function buildRecommendationResponse(events, intent) {
  const where = intent.municipio
    ? ` en ${intent.municipio}`
    : intent.nearBaseLocation
    ? " cerca de tu ubicación"
    : " en la Comunidad de Madrid";

  const when = intent.dateRange?.label ? ` para ${intent.dateRange.label}` : "";

  let intro = `He encontrado ${events.length} planes${where}${when}.`;

  if (intent.monthQuery && intent.dateRange?.label) {
    intro = `He encontrado ${events.length} planes para ${intent.dateRange.label}${intent.municipio ? ` en ${intent.municipio}` : ""}.`;
  }

  return {
    reply: intro,
    action: "show_recommendations",
    intent,
    missing: [],
    followUpQuestions: [
      "¿Quieres que te prepare una ruta con estos planes?",
      "¿Prefieres algo más cultural, musical o gastronómico?",
    ],
    data: {
      events,
    },
  };
}

function buildRouteResponse(route, intent) {
  const where = intent.municipio
    ? ` en ${intent.municipio}`
    : intent.useBaseLocation || intent.nearBaseLocation
    ? " cerca de tu ubicación"
    : " en la Comunidad de Madrid";

  const when = intent.dateRange?.label ? ` para ${intent.dateRange.label}` : "";

  const totalDistance = route.reduce((acc, item) => {
    const d = Number(item.distance_from_previous_km || 0);
    return acc + (Number.isFinite(d) ? d : 0);
  }, 0);

  const extra =
    totalDistance > 0
      ? ` La distancia aproximada entre planes es de ${totalDistance.toFixed(2)} km.`
      : "";

  return {
    reply: `Te he preparado una ruta de ${route.length} planes${where}${when}.${extra}`,
    action: "show_route",
    intent,
    missing: [],
    followUpQuestions: [
      "¿Quieres que priorice planes más cercanos entre sí?",
      "¿Quieres otra ruta de otro tipo?",
    ],
    data: {
      route,
    },
  };
}

function buildDistanceResponse(payload) {
  return {
    reply:
      payload?.reply ||
      "He calculado la distancia y la mejor forma aproximada de llegar.",
    action: "show_recommendations",
    intent: payload?.intent || null,
    missing: [],
    followUpQuestions: [
      "¿Quieres que te enseñe más planes cerca de esa zona?",
      "¿Quieres que te prepare una ruta desde esa ubicación?",
    ],
    data: payload?.data || {
      events: [],
      routeInfo: null,
    },
  };
}

function buildFavoritesResponse(events, intent) {
  return {
    reply: events.length
      ? "Estos son tus planes guardados."
      : "Todavía no tienes favoritos guardados.",
    action: "show_recommendations",
    intent,
    missing: [],
    followUpQuestions: events.length
      ? ["¿Quieres que te haga una ruta con tus favoritos?"]
      : [],
    data: {
      events,
    },
  };
}

module.exports = {
  buildClarificationResponse,
  buildRecommendationResponse,
  buildRouteResponse,
  buildDistanceResponse,
  buildFavoritesResponse,
};