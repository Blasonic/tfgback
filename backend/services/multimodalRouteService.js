const {
  getZoneByMunicipio,
  isMadridCapital,
} = require("./transportZoneService");

const { getFareRecommendation } = require("./transportFareService");
const { safeNumber } = require("./trafficUtils");

function estimateWalkMinutes(distanceKm) {
  const km = safeNumber(distanceKm, 0);
  return Math.max(5, Math.round((km / 4.8) * 60));
}

function estimateTransitMinutes(distanceKm, mode) {
  const km = safeNumber(distanceKm, 0);

  if (mode === "metro") return Math.round(km * 4 + 8);
  if (mode === "cercanias") return Math.round(km * 3 + 12);
  if (mode === "bus_interurbano") return Math.round(km * 5 + 15);

  return Math.round(km * 4.5 + 12);
}

function chooseMainTransport(originMunicipio, destinationMunicipio, distanceKm) {
  const originMadrid = isMadridCapital(originMunicipio);
  const destinationMadrid = isMadridCapital(destinationMunicipio);
  const km = safeNumber(distanceKm, 0);

  if (originMadrid && destinationMadrid) {
    return {
      mode: "metro",
      label_es: "Metro / EMT",
      label_en: "Metro / EMT",
      emoji: "🚇",
    };
  }

  if (originMadrid !== destinationMadrid) {
    return {
      mode: "cercanias",
      label_es: "Cercanías o bus interurbano",
      label_en: "Commuter rail or intercity bus",
      emoji: "🚆",
    };
  }

  if (km <= 12) {
    return {
      mode: "bus_interurbano",
      label_es: "Bus interurbano",
      label_en: "Intercity bus",
      emoji: "🚌",
    };
  }

  return {
    mode: "mixed_public_transport",
    label_es: "Transporte público combinado",
    label_en: "Combined public transport",
    emoji: "🚍",
  };
}

function buildSimulatedMultimodalRoute({
  origin,
  destination,
  distanceKm,
  estimatedTrips = 1,
  lang = "es",
}) {
  const originZone = getZoneByMunicipio(origin?.municipio);
  const destinationZone = getZoneByMunicipio(destination?.municipio);

  const mainTransport = chooseMainTransport(
    origin?.municipio,
    destination?.municipio,
    distanceKm
  );

  const km = safeNumber(distanceKm, 0);

  const walkToStopMinutes = km > 8 ? 8 : 5;
  const walkToDestinationMinutes = km > 8 ? 10 : 6;
  const transitMinutes = estimateTransitMinutes(km, mainTransport.mode);
  const totalMinutes =
    walkToStopMinutes + transitMinutes + walkToDestinationMinutes;

  const fare = getFareRecommendation({
    estimatedTrips,
    originZone,
    destinationZone,
    lang,
  });

  return {
    type: "simulated_multimodal",
    language: lang,
    distance_km: Number(km.toFixed(2)),
    total_minutes: totalMinutes,

    recommended_transport:
      lang === "en" ? mainTransport.label_en : mainTransport.label_es,

    fare,

    tariff_detail: {
      origin_zone: originZone,
      destination_zone: destinationZone,
    },

    segments: [
      {
        type: "walk",
        emoji: "🚶",
        label:
          lang === "en"
            ? "Walk to the nearest stop or station"
            : "Caminar hasta la parada o estación más cercana",
        duration_minutes: walkToStopMinutes,
      },
      {
        type: mainTransport.mode,
        emoji: mainTransport.emoji,
        label: lang === "en" ? mainTransport.label_en : mainTransport.label_es,
        duration_minutes: transitMinutes,
      },
      {
        type: "walk",
        emoji: "🚶",
        label:
          lang === "en"
            ? "Walk from the stop to the event"
            : "Caminar desde la parada hasta el evento",
        duration_minutes: walkToDestinationMinutes,
      },
    ],

    disclaimer:
      lang === "en"
        ? "Estimated multimodal route. It does not use real-time public transport schedules."
        : "Ruta multimodal estimada. No usa horarios de transporte público en tiempo real.",
  };
}

module.exports = {
  buildSimulatedMultimodalRoute,
};