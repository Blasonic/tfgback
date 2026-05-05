const { TRANSPORT_TARIFFS } = require("../models/traffic");
const { formatPrice } = require("./trafficUtils");

function getMonthlyPassPrice(zone) {
  return TRANSPORT_TARIFFS.monthlyPass[zone] || null;
}

function getFareRecommendation({
  estimatedTrips = 1,
  originZone = null,
  destinationZone = "A",
  lang = "es",
} = {}) {
  const trips = Math.max(1, Number(estimatedTrips) || 1);

  const singlePrice = TRANSPORT_TARIFFS.singleTicket.price;
  const tenTripPrice = TRANSPORT_TARIFFS.tenTripTicket.price;
  const tenTripUnitPrice = TRANSPORT_TARIFFS.tenTripTicket.unitPrice;

  const targetZone = destinationZone || originZone || "A";
  const monthlyPassPrice = getMonthlyPassPrice(targetZone);

  const singleTotal = singlePrice * trips;
  const tenTripTotal = Math.ceil(trips / 10) * tenTripPrice;

  let bestOption = "single_ticket";

  if (trips >= 2 && tenTripTotal < singleTotal) {
    bestOption = "ten_trip_ticket";
  }

  if (monthlyPassPrice && trips >= Math.ceil(monthlyPassPrice / tenTripUnitPrice)) {
    bestOption = "monthly_pass";
  }

  const recommendation =
    lang === "en"
      ? buildEnglishRecommendation({
          bestOption,
          singlePrice,
          tenTripUnitPrice,
          monthlyPassPrice,
          targetZone,
        })
      : buildSpanishRecommendation({
          bestOption,
          singlePrice,
          tenTripUnitPrice,
          monthlyPassPrice,
          targetZone,
        });

  return {
    origin_zone: originZone,
    destination_zone: destinationZone,
    estimated_trips: trips,
    best_option: bestOption,

    single_ticket: {
      label: lang === "en" ? "Single ticket" : "Billete sencillo",
      price: singlePrice,
      formatted_price: formatPrice(singlePrice, lang),
    },

    ten_trip_ticket: {
      label: lang === "en" ? "10-trip ticket" : "Bono 10 viajes",
      price: tenTripPrice,
      unit_price: tenTripUnitPrice,
      formatted_price: formatPrice(tenTripPrice, lang),
      formatted_unit_price: formatPrice(tenTripUnitPrice, lang),
    },

    monthly_pass: monthlyPassPrice
      ? {
          label:
            lang === "en"
              ? `Monthly travel pass zone ${targetZone}`
              : `Abono mensual zona ${targetZone}`,
          zone: targetZone,
          price: monthlyPassPrice,
          formatted_price: formatPrice(monthlyPassPrice, lang),
        }
      : null,

    recommendation,
  };
}

function buildSpanishRecommendation({
  bestOption,
  singlePrice,
  tenTripUnitPrice,
  monthlyPassPrice,
  targetZone,
}) {
  if (bestOption === "single_ticket") {
    return `Para un trayecto puntual, te sale mejor el billete sencillo: ${formatPrice(
      singlePrice,
      "es"
    )}.`;
  }

  if (bestOption === "ten_trip_ticket") {
    return `Te compensa el bono de 10 viajes: cada trayecto sale aproximadamente a ${formatPrice(
      tenTripUnitPrice,
      "es"
    )}.`;
  }

  return `Si vas a moverte mucho este mes, te compensa el Abono Transporte mensual de zona ${targetZone}: ${formatPrice(
    monthlyPassPrice,
    "es"
  )}.`;
}

function buildEnglishRecommendation({
  bestOption,
  singlePrice,
  tenTripUnitPrice,
  monthlyPassPrice,
  targetZone,
}) {
  if (bestOption === "single_ticket") {
    return `For a one-off trip, the single ticket is the cheapest option: ${formatPrice(
      singlePrice,
      "en"
    )}.`;
  }

  if (bestOption === "ten_trip_ticket") {
    return `The 10-trip ticket is better value: each trip costs approximately ${formatPrice(
      tenTripUnitPrice,
      "en"
    )}.`;
  }

  return `If you are travelling frequently this month, the monthly travel pass for zone ${targetZone} is better value: ${formatPrice(
    monthlyPassPrice,
    "en"
  )}.`;
}

module.exports = {
  getFareRecommendation,
};