function toRad(value) {
  return (value * Math.PI) / 180;
}

function haversineKm(lat1, lng1, lat2, lng2) {
  if (
    [lat1, lng1, lat2, lng2].some(
      (v) => typeof v !== "number" || Number.isNaN(v)
    )
  ) {
    return null;
  }

  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function estimateWalkMinutes(km) {
  if (typeof km !== "number" || Number.isNaN(km)) return null;
  return Math.round((km / 4.5) * 60);
}

function estimateCarMinutes(km) {
  if (typeof km !== "number" || Number.isNaN(km)) return null;
  return Math.round((km / 25) * 60);
}

function estimateTransitMinutes(km) {
  if (typeof km !== "number" || Number.isNaN(km)) return null;
  return Math.round((km / 18) * 60);
}

function recommendTransportMode(km, language = "es") {
  const texts = {
    es: {
      default: "transporte público",
      walk: "andando",
      medium: "transporte público o taxi",
      long: "coche o transporte público",
    },
    en: {
      default: "public transport",
      walk: "walking",
      medium: "public transport or taxi",
      long: "car or public transport",
    },
  };

  const t = texts[language] || texts.es;

  if (typeof km !== "number" || Number.isNaN(km)) {
    return t.default;
  }

  if (km < 1.5) return t.walk;
  if (km < 6) return t.medium;
  return t.long;
}

module.exports = {
  haversineKm,
  estimateWalkMinutes,
  estimateCarMinutes,
  estimateTransitMinutes,
  recommendTransportMode,
};