function normalizeText(value = "") {
  return value
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/ñ/g, "n")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function formatPrice(value, lang = "es") {
  if (typeof value !== "number") return null;

  if (lang === "en") {
    return `€${value.toFixed(2)}`;
  }

  return `${value.toFixed(2).replace(".", ",")} €`;
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

module.exports = {
  normalizeText,
  formatPrice,
  safeNumber,
};