const chatbotService = require("../services/chatbotService");
const firestoreRepo = require("../repositories/firestoreRepo");
const { geocodeAddress, geocodeFirstResult } = require("../services/geocodingService");

async function processMessage(req, res) {
  try {
    const uid = req.user?.id || req.user?.uid;

    if (!uid) {
      return res.status(401).json({ message: "Usuario no autenticado." });
    }

    const {
      message,
      conversationState = null,
      visibleEventIds = [],
      selectedEventId = null,
    } = req.body || {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({ message: "El campo message es obligatorio." });
    }

    const result = await chatbotService.processMessage({
      uid,
      message,
      conversationState,
      visibleEventIds,
      selectedEventId,
    });

    return res.json(result);
  } catch (error) {
    console.error("[controladorChatbot.processMessage]", error);
    return res.status(500).json({
      message: error.message || "Error interno al procesar el chatbot.",
    });
  }
}

async function trackInteraction(req, res) {
  try {
    const uid = req.user?.id || req.user?.uid;

    if (!uid) {
      return res.status(401).json({ message: "Usuario no autenticado." });
    }

    const { type, fiestaId, source = "chatbot", payload = {} } = req.body || {};
    const fiestaIdNum = Number(fiestaId);

    if (!type || !Number.isInteger(fiestaIdNum) || fiestaIdNum <= 0) {
      return res.status(400).json({
        message: "type y fiestaId válidos son obligatorios.",
      });
    }

    const saved = await firestoreRepo.saveInteraction(uid, {
      type,
      fiestaId: fiestaIdNum,
      source,
      payload,
    });

    if (type === "save") {
      await firestoreRepo.saveFavorite(uid, fiestaIdNum);
    }

    if (type === "unsave") {
      await firestoreRepo.deleteFavorite(uid, fiestaIdNum);
    }

    return res.json({ ok: true, id: saved.id });
  } catch (error) {
    console.error("[controladorChatbot.trackInteraction]", error);
    return res.status(500).json({
      message: error.message || "No se pudo guardar la interacción.",
    });
  }
}

async function getPreferences(req, res) {
  try {
    const uid = req.user?.id || req.user?.uid;

    if (!uid) {
      return res.status(401).json({ message: "Usuario no autenticado." });
    }

    const preferences = await firestoreRepo.getUserPreferences(uid);
    return res.json({ ok: true, preferences });
  } catch (error) {
    console.error("[controladorChatbot.getPreferences]", error);
    return res.status(500).json({
      message: error.message || "No se pudieron obtener las preferencias.",
    });
  }
}

async function updateBaseLocation(req, res) {
  try {
    const uid = req.user?.id || req.user?.uid;

    if (!uid) {
      return res.status(401).json({ message: "Usuario no autenticado." });
    }

    const { address } = req.body || {};

    if (!address || typeof address !== "string") {
      return res.status(400).json({
        message: "Debes enviar una dirección válida.",
      });
    }

    const result = await geocodeFirstResult(address);

    if (!result || typeof result.lat !== "number" || typeof result.lng !== "number") {
      return res.status(404).json({
        message: "No se pudo localizar esa dirección.",
      });
    }

    const location = {
      label: "Casa",
      address: result.address,
      lat: result.lat,
      lng: result.lng,
    };

    await firestoreRepo.updateBaseLocation(uid, location);

    return res.json({
      ok: true,
      location,
    });
  } catch (error) {
    console.error("[controladorChatbot.updateBaseLocation]", error);
    return res.status(500).json({
      message: error.message || "No se pudo actualizar la ubicación base.",
    });
  }
}

async function updateTemporaryLocation(req, res) {
  try {
    const uid = req.user?.id || req.user?.uid;

    if (!uid) {
      return res.status(401).json({ message: "Usuario no autenticado." });
    }

    const { query, label = "Ubicación actual" } = req.body || {};

    if (!query || typeof query !== "string") {
      return res.status(400).json({
        message: "Debes enviar una ubicación válida.",
      });
    }

    const result = await geocodeFirstResult(query);

    if (!result || typeof result.lat !== "number" || typeof result.lng !== "number") {
      return res.status(404).json({
        message: "No se pudo localizar esa ubicación.",
      });
    }

    await firestoreRepo.saveRecommendationState(uid, {
      temporary_location: {
        label,
        address: result.address,
        lat: result.lat,
        lng: result.lng,
      },
    });

    return res.json({
      ok: true,
      location: {
        label,
        address: result.address,
        lat: result.lat,
        lng: result.lng,
      },
    });
  } catch (error) {
    console.error("[controladorChatbot.updateTemporaryLocation]", error);
    return res.status(500).json({
      message: error.message || "No se pudo actualizar la ubicación temporal.",
    });
  }
}

async function resolveLocation(req, res) {
  try {
    const uid = req.user?.id || req.user?.uid;

    if (!uid) {
      return res.status(401).json({ message: "Usuario no autenticado." });
    }

    const { query } = req.body || {};

    if (!query || typeof query !== "string") {
      return res.status(400).json({
        message: "Debes enviar una búsqueda válida.",
      });
    }

    const results = await geocodeAddress(query);

    return res.json({
      ok: true,
      results,
    });
  } catch (error) {
    console.error("[controladorChatbot.resolveLocation]", error);
    return res.status(500).json({
      message: error.message || "No se pudo resolver la ubicación.",
    });
  }
}

module.exports = {
  processMessage,
  trackInteraction,
  getPreferences,
  updateBaseLocation,
  updateTemporaryLocation,
  resolveLocation,
};