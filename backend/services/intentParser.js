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
  martes: 2,
  miercoles: 3,
  miércoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
  sábado: 6,
  domingo: 7,
};

const MONTH_MAP = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

const CATEGORY_KEYWORDS = {
  musica: ["musica", "música", "concierto", "festival", "dj"],
  cultural: ["cultural", "teatro", "museo", "exposicion", "exposición", "historia"],
  gastronomia: ["gastronomia", "gastronomía", "tapas", "brunch", "vino", "comida"],
  deporte: ["deporte", "running", "senderismo", "futbol", "fútbol", "padel", "paddle"],
  familia: ["familia", "ninos", "niños", "peques", "infantil"],
};

const TAG_KEYWORDS = {
  techno: ["techno", "tecno"],
  house: ["house"],
  reggaeton: ["reggaeton", "reggaetón", "perreo"],
  rock: ["rock"],
  teatro: ["teatro"],
  museo: ["museo"],
  tapas: ["tapas"],
  senderismo: ["senderismo"],
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
    /(ruta|itinerario|recorrido|plan completo|en orden|hazme una ruta|ruta de eventos)/.test(
      normalized
    )
  ) {
    return "route";
  }

  if (
    /(como llego|como ir|mejor forma de llegar|a que distancia|distancia|cuanto hay|cuanto esta|lejos|cerca)/.test(
      normalized
    )
  ) {
    return "distance";
  }

  if (/(favoritos|guardados|mis planes guardados)/.test(normalized)) {
    return "favorites";
  }

  return "recommend";
}

function extractTimeWindow(text) {
  const normalized = normalizeText(text);

  if (/esta noche|por la noche|\bnoche\b/.test(normalized)) {
    return "night";
  }

  if (/esta tarde|por la tarde|\btarde\b/.test(normalized)) {
    return "afternoon";
  }

  if (/esta manana|por la manana|\bmanana\b/.test(normalized)) {
    return "morning";
  }

  return null;
}

function extractDateRange(text) {
  const normalized = normalizeText(text);

  if (/\bhoy\b/.test(normalized)) return rangeToday();
  if (/\bmanana\b/.test(normalized)) return rangeTomorrow();
  if (/finde|fin de semana/.test(normalized)) return rangeThisWeekend();
  if (/esta semana/.test(normalized)) return rangeThisWeek();

  if (/este mes/.test(normalized)) return rangeThisMonth();
  if (/mes que viene|proximo mes|próximo mes/.test(normalized)) return rangeNextMonth();

  for (const [name, month] of Object.entries(MONTH_MAP)) {
    if (
      new RegExp(`\\b${name}\\b`).test(normalized) &&
      /(mes|planes|eventos|que hay|qué hay|ruta)/.test(normalized)
    ) {
      return rangeSpecificMonth(month);
    }
  }

  for (const [name, weekday] of Object.entries(WEEKDAY_MAP)) {
    if (new RegExp(`\\b${name}\\b`).test(normalized)) {
      return rangeNextWeekday(weekday);
    }
  }

  return defaultRange14Days();
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

  if (/madrid capital|centro de madrid|madrid centro/.test(normalized)) {
    return "Madrid";
  }

  return null;
}

function inferNeedBaseLocation(text) {
  const normalized = normalizeText(text);

  return /(alojamiento|hotel|apartamento|donde me alojo|cerca de mi alojamiento|cerca de mi hotel|cerca de casa|desde casa|desde mi hotel|desde mi alojamiento|desde mi ubicacion|desde mi ubicación)/.test(
    normalized
  );
}

function extractLocationAlias(text) {
  const normalized = normalizeText(text);

  if (/\bcasa\b/.test(normalized)) return "casa";
  if (/\bhotel\b/.test(normalized)) return "hotel";
  if (/\balojamiento\b/.test(normalized)) return "alojamiento";
  if (/\bapartamento\b/.test(normalized)) return "apartamento";

  return null;
}

function inferNearBaseLocation(text) {
  const normalized = normalizeText(text);

  return /(cerca de mi hotel|cerca del hotel|cerca de casa|cerca de mi alojamiento|cerca de donde me alojo|cerca de mi apartamento|cerca de mi ubicacion|cerca de mi ubicación)/.test(
    normalized
  );
}

function inferWantsDirections(text) {
  const normalized = normalizeText(text);

  return /(como llego|como ir|mejor forma de llegar|como puedo llegar|cómo llego|cómo ir|cómo puedo llegar)/.test(
    normalized
  );
}

function inferMonthQuery(text) {
  const normalized = normalizeText(text);
  return /(este mes|mes que viene|proximo mes|próximo mes|planes de|eventos de|que hay en|qué hay en)/.test(
    normalized
  );
}

function detectSaveBaseLocation(text) {
  const normalized = normalizeText(text);

  return (
    normalized.includes("guarda mi casa en ") ||
    normalized.includes("mi casa esta en ") ||
    normalized.includes("mi casa está en ") ||
    normalized.includes("vivo en ")
  );
}

function detectSaveTemporaryLocation(text) {
  const normalized = normalizeText(text);

  return (
    normalized.includes("estoy en ") ||
    normalized.includes("mi hotel es ") ||
    normalized.includes("mi alojamiento es ") ||
    normalized.includes("estoy alojado en ") ||
    normalized.includes("estoy alojada en ")
  );
}

function extractRawLocationText(text) {
  const normalized = normalizeText(text);

  const patterns = [
    "guarda mi casa en ",
    "mi casa esta en ",
    "vivo en ",
    "estoy en ",
    "mi hotel es ",
    "mi alojamiento es ",
    "estoy alojado en ",
    "estoy alojada en ",
  ];

  for (const pattern of patterns) {
    if (normalized.includes(pattern)) {
      return normalized.split(pattern)[1]?.trim() || null;
    }
  }

  return null;
}

function parseMessage(message, municipios = [], previousState = null) {
  const type = detectIntentType(message);
  const dateRange = extractDateRange(message);
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

  // Para rutas NO exigimos ubicación del usuario.
  // Solo necesitamos un contexto geográfico razonable.
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