const { haversineKm } = require("./distanceUtils");

const texts = {
  es: {
    veryClose: "Muy cerca de tu ubicación",
    close: "Cerca de tu ubicación",
    reasonableDistance: "A una distancia razonable",
    matchesMunicipality: (municipio) => `Coincide con ${municipio}`,
    matchesCategory: (categoria) => `Encaja en ${categoria}`,
    matchesTags: (tags) => `Coincide en tags: ${tags.join(", ")}`,
    matchesTimeWindow: "Encaja en la franja horaria",
    goodRating: "Tiene buena valoración",
    matchesPreferences: "Se parece a tus preferencias",
    matchesLikedTags: "Coincide con tags que te gustan",
    alreadySaved: "Ya lo tienes guardado",
  },
  en: {
    veryClose: "Very close to your location",
    close: "Close to your location",
    reasonableDistance: "Within a reasonable distance",
    matchesMunicipality: (municipio) => `Matches ${municipio}`,
    matchesCategory: (categoria) => `Fits ${categoria}`,
    matchesTags: (tags) => `Matches tags: ${tags.join(", ")}`,
    matchesTimeWindow: "Fits the selected time window",
    goodRating: "Has a good rating",
    matchesPreferences: "Similar to your preferences",
    matchesLikedTags: "Matches tags you like",
    alreadySaved: "You already have it saved",
  },
};

function getTexts(language = "es") {
  return texts[language] || texts.es;
}

function hourFromSqlDate(sqlDate) {
  if (!sqlDate) return null;

  const date = new Date(String(sqlDate).replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return null;

  return date.getHours();
}

function scoreTimeWindow(event, timeWindow) {
  if (!timeWindow) return 0;

  const hour = hourFromSqlDate(event.start_at);
  if (hour === null) return 0;

  if (timeWindow === "morning" && hour >= 8 && hour < 14) return 0.1;
  if (timeWindow === "afternoon" && hour >= 14 && hour < 20) return 0.1;
  if (timeWindow === "night" && (hour >= 20 || hour < 3)) return 0.1;

  return 0;
}

function scoreRating(event) {
  const avg = Number(event.rating_avg || 0);
  const count = Number(event.rating_count || 0);

  if (count === 0) return 0;

  return Math.min(avg / 5, 1) * 0.1;
}

function scoreDistanceToBase(event, baseLocation, language = "es") {
  const t = getTexts(language);

  if (
    !baseLocation ||
    typeof baseLocation.lat !== "number" ||
    typeof baseLocation.lng !== "number" ||
    typeof event.lat !== "number" ||
    typeof event.lng !== "number"
  ) {
    return {
      score: 0,
      reason: null,
      distanceKm: null,
    };
  }

  const km = haversineKm(
    baseLocation.lat,
    baseLocation.lng,
    event.lat,
    event.lng
  );

  if (typeof km !== "number" || Number.isNaN(km)) {
    return {
      score: 0,
      reason: null,
      distanceKm: null,
    };
  }

  if (km < 1.5) {
    return {
      score: 0.15,
      reason: t.veryClose,
      distanceKm: km,
    };
  }

  if (km < 3) {
    return {
      score: 0.1,
      reason: t.close,
      distanceKm: km,
    };
  }

  if (km < 6) {
    return {
      score: 0.05,
      reason: t.reasonableDistance,
      distanceKm: km,
    };
  }

  return {
    score: 0,
    reason: null,
    distanceKm: km,
  };
}

function getSignals(userProfile = {}) {
  const likedCategories = new Set(userProfile.preferences?.liked_categories || []);
  const likedTags = new Set(userProfile.preferences?.liked_tags || []);

  const dismissedEventIds = new Set(
    (userProfile.interactions || [])
      .filter((i) => i.type === "dismiss")
      .map((i) => Number(i.fiestaId))
      .filter(Boolean)
  );

  const savedEventIds = new Set(
    (userProfile.savedItems || [])
      .map((i) => Number(i.fiestaId))
      .filter(Boolean)
  );

  return {
    likedCategories,
    likedTags,
    dismissedEventIds,
    savedEventIds,
  };
}

function scoreEvents(
  events,
  userProfile = {},
  intent = {},
  baseLocation = null,
  language = "es"
) {
  const t = getTexts(language);
  const signals = getSignals(userProfile);

  return events
    .map((event) => {
      let score = 0;
      const reasons = [];
      const eventTags = Array.isArray(event.tags) ? event.tags : [];

      if (intent.municipio && event.municipio === intent.municipio) {
        score += 0.25;
        reasons.push(t.matchesMunicipality(intent.municipio));
      }

      if (intent.categoria && event.categoria === intent.categoria) {
        score += 0.15;
        reasons.push(t.matchesCategory(intent.categoria));
      }

      const matchingTags = (intent.tags || []).filter((tag) =>
        eventTags.includes(tag)
      );

      if (matchingTags.length > 0) {
        score += Math.min(0.2, matchingTags.length * 0.08);
        reasons.push(t.matchesTags(matchingTags));
      }

      const twScore = scoreTimeWindow(event, intent.timeWindow);
      if (twScore > 0) {
        score += twScore;
        reasons.push(t.matchesTimeWindow);
      }

      const ratingScore = scoreRating(event);
      if (ratingScore > 0) {
        score += ratingScore;
        reasons.push(t.goodRating);
      }

      if (signals.likedCategories.has(event.categoria)) {
        score += 0.08;
        reasons.push(t.matchesPreferences);
      }

      const likedTagMatches = eventTags.filter((tag) =>
        signals.likedTags.has(tag)
      );

      if (likedTagMatches.length > 0) {
        score += Math.min(0.08, likedTagMatches.length * 0.03);
        reasons.push(t.matchesLikedTags);
      }

      if (intent.nearBaseLocation || intent.useBaseLocation) {
        const distanceScore = scoreDistanceToBase(
          event,
          baseLocation,
          language
        );

        score += distanceScore.score;

        if (distanceScore.reason) {
          reasons.push(distanceScore.reason);
        }

        event.distance_from_base_km = distanceScore.distanceKm;
      }

      if (signals.dismissedEventIds.has(Number(event.id))) {
        score -= 0.2;
      }

      if (signals.savedEventIds.has(Number(event.id))) {
        score -= 0.15;
        reasons.push(t.alreadySaved);
      }

      return {
        ...event,
        score: Math.max(0, Math.min(score, 1)),
        reasons,
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(a.start_at) - new Date(b.start_at);
    });
}

module.exports = {
  scoreEvents,
};