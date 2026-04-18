const { haversineKm } = require("./distanceUtils");

function parseSqlDate(sqlDate) {
  if (!sqlDate) return null;

  const date = new Date(String(sqlDate).replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date;
}

function canAppendEvent(previous, next, minimumGapMinutes = 30) {
  if (!previous) return true;

  const prevEnd = parseSqlDate(previous.end_at || previous.start_at);
  const nextStart = parseSqlDate(next.start_at);

  if (!prevEnd || !nextStart) return false;

  const diffMinutes = (nextStart.getTime() - prevEnd.getTime()) / 60000;
  return diffMinutes >= minimumGapMinutes;
}

function distanceBetweenEvents(prev, next) {
  if (
    !prev ||
    typeof prev.lat !== "number" ||
    typeof prev.lng !== "number" ||
    typeof next.lat !== "number" ||
    typeof next.lng !== "number"
  ) {
    return null;
  }

  return haversineKm(prev.lat, prev.lng, next.lat, next.lng);
}

function distanceFromBase(baseLocation, event) {
  if (
    !baseLocation ||
    typeof baseLocation.lat !== "number" ||
    typeof baseLocation.lng !== "number" ||
    typeof event.lat !== "number" ||
    typeof event.lng !== "number"
  ) {
    return null;
  }

  return haversineKm(baseLocation.lat, baseLocation.lng, event.lat, event.lng);
}

function routeCandidateScore(previous, event, baseLocation) {
  let penalty = 0;

  const fromPreviousKm = distanceBetweenEvents(previous, event);
  const fromBaseKm = distanceFromBase(baseLocation, event);

  if (typeof fromPreviousKm === "number") {
    if (fromPreviousKm > 8) penalty += 0.4;
    else if (fromPreviousKm > 5) penalty += 0.2;
    else if (fromPreviousKm > 3) penalty += 0.1;
  }

  if (!previous && typeof fromBaseKm === "number") {
    if (fromBaseKm > 12) penalty += 0.2;
    else if (fromBaseKm > 6) penalty += 0.1;
  }

  const baseScore = typeof event.score === "number" ? event.score : 0;

  return {
    totalScore: baseScore - penalty,
    fromPreviousKm,
    fromBaseKm,
  };
}

function buildRoute(events, baseLocation = null, options = {}) {
  const maxItems = options.maxItems || 4;
  const minimumGapMinutes = options.minimumGapMinutes || 30;

  if (!Array.isArray(events) || events.length === 0) return [];

  // Partimos de eventos ya rankeados
  const pool = [...events];
  const route = [];

  while (route.length < maxItems && pool.length > 0) {
    const previous = route[route.length - 1] || null;

    const compatible = pool
      .filter((event) => canAppendEvent(previous, event, minimumGapMinutes))
      .map((event) => {
        const scored = routeCandidateScore(previous, event, baseLocation);

        return {
          ...event,
          _routeScore: scored.totalScore,
          _distance_from_previous_km: scored.fromPreviousKm,
          _distance_from_base_km: scored.fromBaseKm,
        };
      })
      .sort((a, b) => {
        if (b._routeScore !== a._routeScore) return b._routeScore - a._routeScore;

        const aStart = parseSqlDate(a.start_at);
        const bStart = parseSqlDate(b.start_at);

        if (!aStart || !bStart) return 0;
        return aStart - bStart;
      });

    if (!compatible.length) break;

    const selected = compatible[0];

    route.push({
      ...selected,
      distance_from_previous_km:
        typeof selected._distance_from_previous_km === "number"
          ? selected._distance_from_previous_km
          : 0,
      distance_from_base_km:
        typeof selected._distance_from_base_km === "number"
          ? selected._distance_from_base_km
          : null,
    });

    const selectedId = Number(selected.id);
    for (let i = pool.length - 1; i >= 0; i--) {
      if (Number(pool[i].id) === selectedId) {
        pool.splice(i, 1);
      }
    }
  }

  return route;
}

module.exports = {
  buildRoute,
};