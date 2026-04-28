const {
  rangeToday,
  rangeTomorrow,
  rangeThisWeekend,
  rangeThisWeek,
  rangeThisMonth,
  rangeNextMonth,
  rangeSpecificMonth,
  rangeNextWeekday,
  defaultRange14Days,
} = require("./dateUtils");

const WEEKDAY_MAP = {
  lunes: 1,
  monday: 1,

  martes: 2,
  tuesday: 2,

  miercoles: 3,
  miércoles: 3,
  wednesday: 3,

  jueves: 4,
  thursday: 4,

  viernes: 5,
  friday: 5,

  sabado: 6,
  sábado: 6,
  saturday: 6,

  domingo: 7,
  sunday: 7,
};

const MONTH_MAP = {
  enero: 1,
  january: 1,

  febrero: 2,
  february: 2,

  marzo: 3,
  march: 3,

  abril: 4,
  april: 4,

  mayo: 5,
  may: 5,

  junio: 6,
  june: 6,

  julio: 7,
  july: 7,

  agosto: 8,
  august: 8,

  septiembre: 9,
  september: 9,

  octubre: 10,
  october: 10,

  noviembre: 11,
  november: 11,

  diciembre: 12,
  december: 12,
};

const CATEGORY_KEYWORDS = {
  musica: [
    "musica",
    "música",
    "music",
    "concierto",
    "concert",
    "festival",
    "dj",
  ],
  cultural: [
    "cultural",
    "culture",
    "teatro",
    "theatre",
    "theater",
    "museo",
    "museum",
    "exposicion",
    "exposición",
    "exhibition",
    "historia",
    "history",
  ],
  gastronomia: [
    "gastronomia",
    "gastronomía",
    "gastronomy",
    "tapas",
    "brunch",
    "vino",
    "wine",
    "comida",
    "food",
  ],
  deporte: [
    "deporte",
    "sport",
    "sports",
    "running",
    "senderismo",
    "hiking",
    "futbol",
    "fútbol",
    "football",
    "soccer",
    "padel",
    "paddle",
  ],
  familia: [
    "familia",
    "family",
    "ninos",
    "niños",
    "kids",
    "children",
    "peques",
    "infantil",
  ],
};

const TAG_KEYWORDS = {
  techno: ["techno", "tecno"],
  house: ["house"],
  reggaeton: ["reggaeton", "reggaetón", "perreo"],
  rock: ["rock"],
  teatro: ["teatro", "theatre", "theater"],
  museo: ["museo", "museum"],
  tapas: ["tapas"],
  senderismo: ["senderismo", "hiking"],
};

function normalizeText(text = "") {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function detectIntentType(text) {
  const normalized = normalizeText(text);

  if (
    /(ruta|itinerario|recorrido|plan completo|en orden|hazme una ruta|ruta de eventos|route|itinerary|full plan|make me a route|event route)/.test(
      normalized
    )
  ) {
    return "route";
  }

  if (
    /(como llego|como ir|mejor forma de llegar|a que distancia|distancia|cuanto hay|cuanto esta|lejos|cerca|how do i get|how to get|how can i get|best way to get|distance|how far|near|nearby)/.test(
      normalized
    )
  ) {
    return "distance";
  }

  if (
    /(favoritos|guardados|mis planes guardados|favorites|saved|my saved plans|saved plans)/.test(
      normalized
    )
  ) {
    return "favorites";
  }

  return "recommend";
}

function extractTimeWindow(text) {
  const normalized = normalizeText(text);

  if (/esta noche|por la noche|\bnoche\b|tonight|at night|\bnight\b/.test(normalized)) {
    return "night";
  }

  if (/esta tarde|por la tarde|\btarde\b|this afternoon|afternoon/.test(normalized)) {
    return "afternoon";
  }

  if (/esta manana|por la manana|\bmanana\b|this morning|morning/.test(normalized)) {
    return "morning";
  }

  return null;
}

function extractDateRange(text, language = "es") {
  const normalized = normalizeText(text);

  if (/\bhoy\b|\btoday\b/.test(normalized)) return rangeToday(language);
  if (/\bmanana\b|\btomorrow\b/.test(normalized)) return rangeTomorrow(language);

  if (/finde|fin de semana|weekend|this weekend/.test(normalized)) {
    return rangeThisWeekend(language);
  }

  if (/esta semana|this week/.test(normalized)) {
    return rangeThisWeek(language);
  }

  if (/este mes|this month/.test(normalized)) {
    return rangeThisMonth(language);
  }

  if (/mes que viene|proximo mes|próximo mes|next month/.test(normalized)) {
    return rangeNextMonth(language);
  }

  for (const [name, month] of Object.entries(MONTH_MAP)) {
    if (
      new RegExp(`\\b${name}\\b`).test(normalized) &&
      /(mes|month|planes|plans|eventos|events|que hay|qué hay|what is on|what's on|route|ruta)/.test(
        normalized
      )
    ) {
      return rangeSpecificMonth(month, undefined, language);
    }
  }

  for (const [name, weekday] of Object.entries(WEEKDAY_MAP)) {
    if (new RegExp(`\\b${name}\\b`).test(normalized)) {
      return rangeNextWeekday(weekday, language);
    }
  }

  return defaultRange14Days(language);
}

function extractCategoria(text) {
  const normalized = normalizeText(text);

  for (const [categoria, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => normalized.includes(normalizeText(kw)))) {
      return categoria;
    }
  }

  return null;
}

function extractTags(text) {
  const normalized = normalizeText(text);
  const tags = [];

  for (const [tag, keywords] of Object.entries(TAG_KEYWORDS)) {
    if (keywords.some((kw) => normalized.includes(normalizeText(kw)))) {
      tags.push(tag);
    }
  }

  return tags;
}

function extractMunicipio(text, municipios = []) {
  const normalized = normalizeText(text);

  const ordered = [...municipios]
    .filter(Boolean)
    .map((m) => ({ original: m, normalized: normalizeText(m) }))
    .sort((a, b) => b.normalized.length - a.normalized.length);

  for (const municipio of ordered) {
    if (normalized.includes(municipio.normalized)) {
      return municipio.original;
    }
  }

  if (/madrid capital|centro de madrid|madrid centro|madrid city|central madrid/.test(normalized)) {
    return "Madrid";
  }

  return null;
}

function inferNeedBaseLocation(text) {
  const normalized = normalizeText(text);

  return /(alojamiento|hotel|apartamento|donde me alojo|cerca de mi alojamiento|cerca de mi hotel|cerca de casa|desde casa|desde mi hotel|desde mi alojamiento|desde mi ubicacion|desde mi ubicación|accommodation|apartment|where i am staying|near my accommodation|near my hotel|near home|from home|from my hotel|from my accommodation|from my location)/.test(
    normalized
  );
}

function extractLocationAlias(text) {
  const normalized = normalizeText(text);

  if (/\bcasa\b|\bhome\b/.test(normalized)) return "casa";
  if (/\bhotel\b/.test(normalized)) return "hotel";
  if (/\balojamiento\b|\baccommodation\b/.test(normalized)) return "alojamiento";
  if (/\bapartamento\b|\bapartment\b/.test(normalized)) return "apartamento";

  return null;
}

function inferNearBaseLocation(text) {
  const normalized = normalizeText(text);

  return /(cerca de mi hotel|cerca del hotel|cerca de casa|cerca de mi alojamiento|cerca de donde me alojo|cerca de mi apartamento|cerca de mi ubicacion|cerca de mi ubicación|near my hotel|near the hotel|near home|near my accommodation|near where i am staying|near my apartment|near my location)/.test(
    normalized
  );
}

function inferWantsDirections(text) {
  const normalized = normalizeText(text);

  return /(como llego|como ir|mejor forma de llegar|como puedo llegar|cómo llego|cómo ir|cómo puedo llegar|how do i get|how to get|best way to get|how can i get there|how can i get)/.test(
    normalized
  );
}

function inferMonthQuery(text) {
  const normalized = normalizeText(text);

  return /(este mes|mes que viene|proximo mes|próximo mes|planes de|eventos de|que hay en|qué hay en|this month|next month|plans in|events in|what is on in|what's on in)/.test(
    normalized
  );
}

function detectSaveBaseLocation(text) {
  const normalized = normalizeText(text);

  return (
    normalized.includes("guarda mi casa en ") ||
    normalized.includes("mi casa esta en ") ||
    normalized.includes("mi casa está en ") ||
    normalized.includes("vivo en ") ||
    normalized.includes("save my home at ") ||
    normalized.includes("my home is at ") ||
    normalized.includes("i live at ") ||
    normalized.includes("i live in ")
  );
}

function detectSaveTemporaryLocation(text) {
  const normalized = normalizeText(text);

  return (
    normalized.includes("estoy en ") ||
    normalized.includes("mi hotel es ") ||
    normalized.includes("mi alojamiento es ") ||
    normalized.includes("estoy alojado en ") ||
    normalized.includes("estoy alojada en ") ||
    normalized.includes("i am at ") ||
    normalized.includes("i'm at ") ||
    normalized.includes("my hotel is ") ||
    normalized.includes("my accommodation is ") ||
    normalized.includes("i am staying at ") ||
    normalized.includes("i'm staying at ")
  );
}

function extractRawLocationText(text) {
  const normalized = normalizeText(text);

  const patterns = [
    "guarda mi casa en ",
    "mi casa esta en ",
    "mi casa está en ",
    "vivo en ",
    "estoy en ",
    "mi hotel es ",
    "mi alojamiento es ",
    "estoy alojado en ",
    "estoy alojada en ",
    "save my home at ",
    "my home is at ",
    "i live at ",
    "i live in ",
    "i am at ",
    "i'm at ",
    "my hotel is ",
    "my accommodation is ",
    "i am staying at ",
    "i'm staying at ",
  ];

  for (const pattern of patterns) {
    if (normalized.includes(pattern)) {
      return normalized.split(pattern)[1]?.trim() || null;
    }
  }

  return null;
}

function parseMessage(message, municipios = [], previousState = null, language = "es") {
  const type = detectIntentType(message);
  const dateRange = extractDateRange(message, language);
  const timeWindow = extractTimeWindow(message);
  const categoria = extractCategoria(message);
  const tags = extractTags(message);
  const municipio =
    extractMunicipio(message, municipios) || previousState?.municipio || null;

  const useBaseLocation = inferNeedBaseLocation(message);
  const nearBaseLocation = inferNearBaseLocation(message);
  const locationAlias = extractLocationAlias(message);
  const wantsDirections = inferWantsDirections(message);
  const monthQuery = inferMonthQuery(message);

  const wantsToSaveBaseLocation = detectSaveBaseLocation(message);
  const wantsToSaveTemporaryLocation = detectSaveTemporaryLocation(message);
  const rawLocationText = extractRawLocationText(message);

  const intent = {
    type,
    municipio,
    dateRange,
    timeWindow,
    categoria,
    tags,
    useBaseLocation,
    nearBaseLocation,
    wantsDirections,
    locationAlias,
    monthQuery,
    wantsToSaveBaseLocation,
    wantsToSaveTemporaryLocation,
    rawLocationText,
  };

  const missing = [];

  if (type === "route" && !municipio && !nearBaseLocation && !useBaseLocation) {
    missing.push("municipio_or_area");
  }

  return {
    ...intent,
    missing,
  };
}

module.exports = {
  normalizeText,
  parseMessage,
};