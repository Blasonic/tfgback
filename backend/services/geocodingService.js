const GOOGLE_GEOCODING_BASE_URL =
  "https://maps.googleapis.com/maps/api/geocode/json";

function normalizeGeocodingResult(result, language = "es") {
  const location = result?.geometry?.location || {};

  return {
    label:
      result?.formatted_address ||
      (language === "en" ? "Location" : "Ubicación"),
    address: result?.formatted_address || "",
    lat: typeof location.lat === "number" ? location.lat : null,
    lng: typeof location.lng === "number" ? location.lng : null,
    placeId: result?.place_id || null,
    types: Array.isArray(result?.types) ? result.types : [],
  };
}

async function geocodeAddress(query, language = "es") {
  if (!query || typeof query !== "string") {
    throw new Error(
      language === "en"
        ? "The address to geocode is invalid."
        : "La dirección a geocodificar es inválida."
    );
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    throw new Error(
      language === "en"
        ? "Missing GOOGLE_MAPS_API_KEY in environment variables."
        : "Falta GOOGLE_MAPS_API_KEY en variables de entorno."
    );
  }

  const url = new URL(GOOGLE_GEOCODING_BASE_URL);
  url.searchParams.set("address", query);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("region", "es");
  url.searchParams.set("language", language);

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(
      language === "en"
        ? `Geocoding HTTP error: ${response.status}`
        : `Error HTTP geocoding: ${response.status}`
    );
  }

  const data = await response.json();

  if (data.status === "ZERO_RESULTS") {
    return [];
  }

  if (data.status !== "OK") {
    throw new Error(
      language === "en"
        ? `Google Geocoding returned invalid status: ${data.status}`
        : `Google Geocoding devolvió estado inválido: ${data.status}`
    );
  }

  return data.results.map((result) =>
    normalizeGeocodingResult(result, language)
  );
}

async function geocodeFirstResult(query, language = "es") {
  const results = await geocodeAddress(query, language);
  return results.length > 0 ? results[0] : null;
}

module.exports = {
  geocodeAddress,
  geocodeFirstResult,
};