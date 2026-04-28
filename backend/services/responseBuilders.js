const messages = {
  es: {
    routeNeedTown:
      "Para prepararte una ruta necesito que me digas un municipio o que uses tu ubicación base.",
    askTown: "¿En qué municipio quieres la ruta?",
    askBaseLocation: "También puedes pedirla cerca de tu ubicación base.",
    needMoreInfo: "Necesito un poco más de información para afinar la búsqueda.",

    nearYou: " cerca de tu ubicación",
    communityMadrid: " en la Comunidad de Madrid",
    forDate: " para {{date}}",

    foundPlans: "He encontrado {{count}} planes{{where}}{{when}}.",
    foundPlansMonth: "He encontrado {{count}} planes para {{date}}{{where}}.",

    askRoute: "¿Quieres que te prepare una ruta con estos planes?",
    askPreference: "¿Prefieres algo más cultural, musical o gastronómico?",

    approxDistance:
      " La distancia aproximada entre planes es de {{distance}} km.",
    routeReady:
      "Te he preparado una ruta de {{count}} planes{{where}}{{when}}.{{extra}}",
    askCloser: "¿Quieres que priorice planes más cercanos entre sí?",
    askOtherRoute: "¿Quieres otra ruta de otro tipo?",

    distanceCalculated:
      "He calculado la distancia y la mejor forma aproximada de llegar.",
    askNearby: "¿Quieres que te enseñe más planes cerca de esa zona?",
    askRouteFromLocation: "¿Quieres que te prepare una ruta desde esa ubicación?",

    savedPlans: "Estos son tus planes guardados.",
    noSavedPlans: "Todavía no tienes favoritos guardados.",
    askFavoritesRoute: "¿Quieres que te haga una ruta con tus favoritos?",
  },
  en: {
    routeNeedTown:
      "To prepare a route, I need you to tell me a town or use your base location.",
    askTown: "Which town do you want the route in?",
    askBaseLocation: "You can also ask for it near your base location.",
    needMoreInfo: "I need a little more information to refine the search.",

    nearYou: " near your location",
    communityMadrid: " in the Community of Madrid",
    forDate: " for {{date}}",

    foundPlans: "I found {{count}} plans{{where}}{{when}}.",
    foundPlansMonth: "I found {{count}} plans for {{date}}{{where}}.",

    askRoute: "Do you want me to prepare a route with these plans?",
    askPreference: "Would you prefer something more cultural, musical, or gastronomic?",

    approxDistance:
      " The approximate distance between plans is {{distance}} km.",
    routeReady:
      "I have prepared a route of {{count}} plans{{where}}{{when}}.{{extra}}",
    askCloser: "Do you want me to prioritize plans that are closer together?",
    askOtherRoute: "Do you want another route of a different type?",

    distanceCalculated:
      "I have calculated the distance and the approximate best way to get there.",
    askNearby: "Do you want me to show you more plans near that area?",
    askRouteFromLocation: "Do you want me to prepare a route from that location?",

    savedPlans: "These are your saved plans.",
    noSavedPlans: "You don't have any saved favorites yet.",
    askFavoritesRoute: "Do you want me to make a route with your favorites?",
  },
};

function getLang(language) {
  return String(language || "es").startsWith("en") ? "en" : "es";
}

function t(language, key, vars = {}) {
  const lang = getLang(language);
  let value = messages[lang][key] || messages.es[key] || key;

  Object.entries(vars).forEach(([k, v]) => {
    value = value.replaceAll(`{{${k}}}`, String(v));
  });

  return value;
}

function getWhere(intent, language) {
  if (intent.municipio) {
    return getLang(language) === "en"
      ? ` in ${intent.municipio}`
      : ` en ${intent.municipio}`;
  }

  if (intent.nearBaseLocation || intent.useBaseLocation) {
    return t(language, "nearYou");
  }

  return t(language, "communityMadrid");
}

function getWhen(intent, language) {
  return intent.dateRange?.label
    ? t(language, "forDate", { date: intent.dateRange.label })
    : "";
}

function buildClarificationResponse(intent, language = "es") {
  if (intent.missing.includes("municipio_or_base_location")) {
    return {
      reply: t(language, "routeNeedTown"),
      action: "ask_clarification",
      intent,
      missing: intent.missing,
      followUpQuestions: [
        t(language, "askTown"),
        t(language, "askBaseLocation"),
      ],
      data: null,
    };
  }

  return {
    reply: t(language, "needMoreInfo"),
    action: "ask_clarification",
    intent,
    missing: intent.missing,
    followUpQuestions: [],
    data: null,
  };
}

function buildRecommendationResponse(events, intent, language = "es") {
  const where = getWhere(intent, language);
  const when = getWhen(intent, language);

  let intro = t(language, "foundPlans", {
    count: events.length,
    where,
    when,
  });

  if (intent.monthQuery && intent.dateRange?.label) {
    const monthWhere = intent.municipio
      ? getLang(language) === "en"
        ? ` in ${intent.municipio}`
        : ` en ${intent.municipio}`
      : "";

    intro = t(language, "foundPlansMonth", {
      count: events.length,
      date: intent.dateRange.label,
      where: monthWhere,
    });
  }

  return {
    reply: intro,
    action: "show_recommendations",
    intent,
    missing: [],
    followUpQuestions: [
      t(language, "askRoute"),
      t(language, "askPreference"),
    ],
    data: {
      events,
    },
  };
}

function buildRouteResponse(route, intent, language = "es") {
  const where = getWhere(intent, language);
  const when = getWhen(intent, language);

  const totalDistance = route.reduce((acc, item) => {
    const d = Number(item.distance_from_previous_km || 0);
    return acc + (Number.isFinite(d) ? d : 0);
  }, 0);

  const extra =
    totalDistance > 0
      ? t(language, "approxDistance", {
          distance: totalDistance.toFixed(2),
        })
      : "";

  return {
    reply: t(language, "routeReady", {
      count: route.length,
      where,
      when,
      extra,
    }),
    action: "show_route",
    intent,
    missing: [],
    followUpQuestions: [
      t(language, "askCloser"),
      t(language, "askOtherRoute"),
    ],
    data: {
      route,
    },
  };
}

function buildDistanceResponse(payload, language = "es") {
  return {
    reply: payload?.reply || t(language, "distanceCalculated"),
    action: "show_recommendations",
    intent: payload?.intent || null,
    missing: [],
    followUpQuestions: [
      t(language, "askNearby"),
      t(language, "askRouteFromLocation"),
    ],
    data: payload?.data || {
      events: [],
      routeInfo: null,
    },
  };
}

function buildFavoritesResponse(events, intent, language = "es") {
  return {
    reply: events.length
      ? t(language, "savedPlans")
      : t(language, "noSavedPlans"),
    action: "show_recommendations",
    intent,
    missing: [],
    followUpQuestions: events.length ? [t(language, "askFavoritesRoute")] : [],
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