import {
  geocodeAddress,
  geocodeFirstResult,
} from "../servicios/geocodingService.js";
import {
  saveBaseLocation,
  saveTemporaryLocation,
} from "../servicios/chatbotPreferencesService.js";

/**
 * Resuelve una dirección/lugar a coordenadas sin guardar.
 * Útil para frontend o para depuración.
 */
export async function resolveLocation(req, res) {
  try {
    const { query } = req.body;

    if (!query || typeof query !== "string") {
      return res.status(400).json({
        error: "Debes enviar un campo query válido",
      });
    }

    const results = await geocodeAddress(query);

    return res.json({
      ok: true,
      results,
    });
  } catch (error) {
    console.error("Error resolviendo ubicación:", error);

    return res.status(500).json({
      error: "No se pudo resolver la ubicación",
    });
  }
}

/**
 * Guarda base_location (casa) a partir de texto libre.
 */
export async function updateBaseLocationFromText(req, res) {
  try {
    const uid = req.user.uid;
    const { address } = req.body;

    if (!address || typeof address !== "string") {
      return res.status(400).json({
        error: "Debes enviar una dirección válida",
      });
    }

    const result = await geocodeFirstResult(address);

    if (!result) {
      return res.status(404).json({
        error: "No se encontró la dirección indicada",
      });
    }

    const locationToSave = {
      label: "Casa",
      address: result.address,
      lat: result.lat,
      lng: result.lng,
    };

    await saveBaseLocation(uid, locationToSave);

    return res.json({
      ok: true,
      location: locationToSave,
      message: "Ubicación de casa guardada correctamente",
    });
  } catch (error) {
    console.error("Error guardando base_location:", error);

    return res.status(500).json({
      error: "No se pudo guardar la ubicación de casa",
    });
  }
}

/**
 * Guarda temporary_location a partir de texto libre.
 */
export async function updateTemporaryLocationFromText(req, res) {
  try {
    const uid = req.user.uid;
    const { query, label } = req.body;

    if (!query || typeof query !== "string") {
      return res.status(400).json({
        error: "Debes enviar una ubicación válida",
      });
    }

    const result = await geocodeFirstResult(query);

    if (!result) {
      return res.status(404).json({
        error: "No se encontró la ubicación indicada",
      });
    }

    const locationToSave = {
      label: label || "Ubicación actual",
      address: result.address,
      lat: result.lat,
      lng: result.lng,
    };

    await saveTemporaryLocation(uid, locationToSave);

    return res.json({
      ok: true,
      location: locationToSave,
      message: "Ubicación temporal guardada correctamente",
    });
  } catch (error) {
    console.error("Error guardando temporary_location:", error);

    return res.status(500).json({
      error: "No se pudo guardar la ubicación temporal",
    });
  }
}