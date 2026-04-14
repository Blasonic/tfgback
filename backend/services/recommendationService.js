function hourFromSqlDate(sqlDate) {
  if (!sqlDate) return null;
  const date = new Date(String(sqlDate).replace(" ", "T"));
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

function getSignals(userProfile) {
  const likedCategories = new Set(userProfile.preferences?.liked_categories || []);
  const likedTags = new Set(userProfile.preferences?.liked_tags || []);
  const dismissedEventIds = new Set(
    (userProfile.interactions || [])
      .filter((i) => i.type === "dismiss")
      .map((i) => Number(i.fiestaId))
  );
  const savedEventIds = new Set(
    (userProfile.savedItems || []).map((i) => Number(i.fiestaId))
  );

  return {
    likedCategories,
    likedTags,
    dismissedEventIds,
    savedEventIds,
  };
}

function scoreEvents(events, userProfile, intent) {
  const signals = getSignals(userProfile);

  return events
    .map((event) => {
      let score = 0;
      const reasons = [];
      const eventTags = Array.isArray(event.tags) ? event.tags : [];

      if (intent.municipio && event.municipio === intent.municipio) {
        score += 0.25;
        reasons.push(`Coincide con ${intent.municipio}`);
      }

      if (intent.categoria && event.categoria === intent.categoria) {
        score += 0.15;
        reasons.push(`Encaja en ${intent.categoria}`);
      }

      const matchingTags = (intent.tags || []).filter((tag) => eventTags.includes(tag));
      if (matchingTags.length > 0) {
        score += Math.min(0.2, matchingTags.length * 0.08);
        reasons.push(`Coincide en tags: ${matchingTags.join(", ")}`);
      }

      const twScore = scoreTimeWindow(event, intent.timeWindow);
      if (twScore > 0) {
        score += twScore;
        reasons.push("Encaja en la franja horaria");
      }

      const ratingScore = scoreRating(event);
      if (ratingScore > 0) {
        score += ratingScore;
        reasons.push("Tiene buena valoración");
      }

      if (signals.likedCategories.has(event.categoria)) {
        score += 0.08;
        reasons.push("Se parece a tus preferencias");
      }

      const likedTagMatches = eventTags.filter((tag) => signals.likedTags.has(tag));
      if (likedTagMatches.length > 0) {
        score += Math.min(0.08, likedTagMatches.length * 0.03);
        reasons.push("Coincide con tags que te gustan");
      }

      if (signals.dismissedEventIds.has(Number(event.id))) {
        score -= 0.2;
      }

      if (signals.savedEventIds.has(Number(event.id))) {
        score -= 0.15;
        reasons.push("Ya lo tienes guardado");
      }

      return {
        ...event,
        score: Math.max(0, Math.min(score, 1)),
        reasons,
      };
    })
    .sort((a, b) => b.score - a.score || new Date(a.start_at) - new Date(b.start_at));
}

module.exports = {
  scoreEvents,
};