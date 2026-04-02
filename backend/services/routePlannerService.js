const { haversineKm } = require("./distanceUtils");

function canAppendEvent(previous, next, minimumGapMinutes = 30) {
  if (!previous) return true;

  const prevEnd = new Date(String(previous.end_at || previous.start_at).replace(" ", "T"));
  const nextStart = new Date(String(next.start_at).replace(" ", "T"));

  const diffMinutes = (nextStart.getTime() - prevEnd.getTime()) / 60000;
  return diffMinutes >= minimumGapMinutes;
}

function buildRoute(events, baseLocation = null, options = {}) {
  const sorted = [...events].sort((a, b) => new Date(a.start_at) - new Date(b.start_at));
  const maxItems = options.maxItems || 4;
  const route = [];

  for (const event of sorted) {
    if (route.length >= maxItems) break;
    if (!canAppendEvent(route[route.length - 1], event, 30)) continue;

    const enriched = { ...event };

    if (
      baseLocation &&
      typeof baseLocation.lat === "number" &&
      typeof baseLocation.lng === "number" &&
      typeof event.lat === "number" &&
      typeof event.lng === "number"
    ) {
      enriched.distance_from_base_km = haversineKm(
        baseLocation.lat,
        baseLocation.lng,
        event.lat,
        event.lng
      );
    } else {
      enriched.distance_from_base_km = null;
    }

    const previous = route[route.length - 1];
    if (
      previous &&
      typeof previous.lat === "number" &&
      typeof previous.lng === "number" &&
      typeof event.lat === "number" &&
      typeof event.lng === "number"
    ) {
      enriched.distance_from_previous_km = haversineKm(
        previous.lat,
        previous.lng,
        event.lat,
        event.lng
      );
    } else {
      enriched.distance_from_previous_km = 0;
    }

    route.push(enriched);
  }

  return route;
}

module.exports = {
  buildRoute,
};