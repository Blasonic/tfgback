const { TRANSPORT_ZONES } = require("../models/traffic");
const { normalizeText } = require("./trafficUtils");

function getMunicipalityInfo(municipio = "") {
  const key = normalizeText(municipio);
  return TRANSPORT_ZONES[key] || null;
}

function getZoneByMunicipio(municipio = "") {
  return getMunicipalityInfo(municipio)?.zone || null;
}

function isMadridCapital(municipio = "") {
  const info = getMunicipalityInfo(municipio);
  return Boolean(info?.isCapital);
}

function getZoneLabel(municipio = "") {
  const info = getMunicipalityInfo(municipio);

  if (!info) {
    return {
      zone: null,
      label: municipio || "Desconocido",
      found: false,
    };
  }

  return {
    zone: info.zone,
    label: info.label,
    found: true,
  };
}

module.exports = {
  getMunicipalityInfo,
  getZoneByMunicipio,
  isMadridCapital,
  getZoneLabel,
};