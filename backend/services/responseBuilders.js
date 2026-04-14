function buildClarificationResponse(intent) {
  if (intent.missing.includes("municipio_or_base_location")) {
    return {
      reply: "Para prepararte una ruta necesito que me digas un municipio o que uses tu alojamiento o ubicación base.",
      action: "ask_clarification",
      intent,
      missing: intent.missing,
      followUpQuestions: [
        "¿En qué municipio quieres la ruta?",
        "También puedes pedírmela cerca de tu alojamiento.",
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
  const where = intent.municipio ? ` en ${intent.municipio}` : " en la Comunidad de Madrid";
  const when = intent.dateRange?.label ? ` para ${intent.dateRange.label}` : "";

  return {
    reply: `He encontrado ${events.length} planes${where}${when}.`,
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
  const where = intent.municipio ? ` en ${intent.municipio}` : " cerca de tu ubicación base";
  const when = intent.dateRange?.label ? ` para ${intent.dateRange.label}` : "";

  return {
    reply: `Te he preparado una ruta de ${route.length} planes${where}${when}.`,
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

function buildDistanceResponse(events, intent) {
  return {
    reply: "Te dejo las distancias entre los planes que tienes visibles o en la última recomendación.",
    action: "show_recommendations",
    intent,
    missing: [],
    followUpQuestions: [],
    data: {
      events,
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
    followUpQuestions: events.length ? ["¿Quieres que te haga una ruta con tus favoritos?"] : [],
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