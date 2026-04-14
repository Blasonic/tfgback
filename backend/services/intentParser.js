const {
  rangeToday,
  rangeTomorrow,
  rangeThisWeekend,
  rangeThisWeek,
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

  if (/(ruta|itinerario|recorrido|plan completo|en orden)/.test(normalized)) return "route";
  if (/(distancia|cuanto hay|cuanto esta|lejos|cerca)/.test(normalized)) return "distance";
  if (/(favoritos|guardados|mis planes guardados)/.test(normalized)) return "favorites";

  return "recommend";
}

function extractTimeWindow(text) {
  const normalized = normalizeText(text);

  if (/\bnoche\b/.test(normalized)) return "night";
  if (/\btarde\b/.test(normalized)) return "afternoon";
  if (/\bmanana\b/.test(normalized)) return "morning";

  return null;
}

function extractDateRange(text) {
  const normalized = normalizeText(text);

  if (/\bhoy\b/.test(normalized)) return rangeToday();
  if (/\bmanana\b/.test(normalized)) return rangeTomorrow();
  if (/finde|fin de semana/.test(normalized)) return rangeThisWeekend();
  if (/esta semana/.test(normalized)) return rangeThisWeek();

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
  return /(alojamiento|hotel|apartamento|donde me alojo|cerca de mi alojamiento|cerca de mi hotel)/.test(normalized);
}

function parseMessage(message, municipios = [], previousState = null) {
  const type = detectIntentType(message);
  const dateRange = extractDateRange(message);
  const timeWindow = extractTimeWindow(message);
  const categoria = extractCategoria(message);
  const tags = extractTags(message);
  const municipio = extractMunicipio(message, municipios) || previousState?.municipio || null;
  const useBaseLocation = inferNeedBaseLocation(message);

  const intent = {
    type,
    municipio,
    dateRange,
    timeWindow,
    categoria,
    tags,
    useBaseLocation,
  };

  const missing = [];

  if (type === "route" && !municipio && !useBaseLocation) {
    missing.push("municipio_or_base_location");
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