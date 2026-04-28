const chatbotService = require("../services/chatbotService");
const firestoreRepo = require("../repositories/firestoreRepo");
const { geocodeAddress, geocodeFirstResult } = require("../services/geocodingService");

function getLang(req) {
  return req.headers["accept-language"]?.startsWith("en") ? "en" : "es";
}

const messages = {
  es: {
    unauthenticated: "Usuario no autenticado.",
    messageRequired: "El campo message es obligatorio.",
    chatbotError: "Error interno al procesar el chatbot.",
    interactionRequired: "type y fiestaId válidos son obligatorios.",
    interactionError: "No se pudo guardar la interacción.",
    preferencesError: "No se pudieron obtener las preferencias.",
    validAddressRequired: "Debes enviar una dirección válida.",
    addressNotFound: "No se pudo localizar esa dirección.",
    baseLocationError: "No se pudo actualizar la ubicación base.",
    validLocationRequired: "Debes enviar una ubicación válida.",
    locationNotFound: "No se pudo localizar esa ubicación.",
    temporaryLocationError: "No se pudo actualizar la ubicación temporal.",
    validSearchRequired: "Debes enviar una búsqueda válida.",
    resolveLocationError: "No se pudo resolver la ubicación.",
    homeLabel: "Casa",
    currentLocationLabel: "Ubicación actual",
  },
  en: {
    unauthenticated: "User not authenticated.",
    messageRequired: "The message field is required.",
    chatbotError: "Internal error while processing the chatbot.",
    interactionRequired: "Valid type and fiestaId are required.",
    interactionError: "The interaction could not be saved.",
    preferencesError: "Preferences could not be retrieved.",
    validAddressRequired: "You must send a valid address.",
    addressNotFound: "That address could not be located.",
    baseLocationError: "The base location could not be updated.",
    validLocationRequired: "You must send a valid location.",
    locationNotFound: "That location could not be located.",
    temporaryLocationError: "The temporary location could not be updated.",
    validSearchRequired: "You must send a valid search query.",
    resolveLocationError: "The location could not be resolved.",
    homeLabel: "Home",
    currentLocationLabel: "Current location",
  },
};

function t(req, key) {
  const lang = getLang(req);
  return messages[lang][key] || messages.es[key] || key;
}

async function processMessage(req, res) {
  try {
    const uid = req.user?.id || req.user?.uid;

    if (!uid) {
      return res.status(401).json({ message: t(req, "unauthenticated") });
    }

    const {
      message,
      conversationState = null,
      visibleEventIds = [],
      selectedEventId = null,
      language,
    } = req.body || {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({ message: t(req, "messageRequired") });
    }

    const result = await chatbotService.processMessage({
      uid,
      message,
      conversationState,
      visibleEventIds,
      selectedEventId,
      language: language || getLang(req),
    });

    return res.json(result);
  } catch (error) {
    console.error("[controladorChatbot.processMessage]", error);
    return res.status(500).json({
      message: error.message || t(req, "chatbotError"),
    });
  }
}

async function trackInteraction(req, res) {
  try {
    const uid = req.user?.id || req.user?.uid;

    if (!uid) {
      return res.status(401).json({ message: t(req, "unauthenticated") });
    }

    const { type, fiestaId, source = "chatbot", payload = {} } = req.body || {};
    const fiestaIdNum = Number(fiestaId);

    if (!type || !Number.isInteger(fiestaIdNum) || fiestaIdNum <= 0) {
      return res.status(400).json({
        message: t(req, "interactionRequired"),
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
      message: error.message || t(req, "interactionError"),
    });
  }
}

async function getPreferences(req, res) {
  try {
    const uid = req.user?.id || req.user?.uid;

    if (!uid) {
      return res.status(401).json({ message: t(req, "unauthenticated") });
    }

    const preferences = await firestoreRepo.getUserPreferences(uid);
    return res.json({ ok: true, preferences });
  } catch (error) {
    console.error("[controladorChatbot.getPreferences]", error);
    return res.status(500).json({
      message: error.message || t(req, "preferencesError"),
    });
  }
}

async function updateBaseLocation(req, res) {
  try {
    const uid = req.user?.id || req.user?.uid;

    if (!uid) {
      return res.status(401).json({ message: t(req, "unauthenticated") });
    }

    const { address } = req.body || {};

    if (!address || typeof address !== "string") {
      return res.status(400).json({
        message: t(req, "validAddressRequired"),
      });
    }

    const result = await geocodeFirstResult(address);

    if (!result || typeof result.lat !== "number" || typeof result.lng !== "number") {
      return res.status(404).json({
        message: t(req, "addressNotFound"),
      });
    }

    const location = {
      label: t(req, "homeLabel"),
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
      message: error.message || t(req, "baseLocationError"),
    });
  }
}

async function updateTemporaryLocation(req, res) {
  try {
    const uid = req.user?.id || req.user?.uid;

    if (!uid) {
      return res.status(401).json({ message: t(req, "unauthenticated") });
    }

    const { query, label } = req.body || {};

    if (!query || typeof query !== "string") {
      return res.status(400).json({
        message: t(req, "validLocationRequired"),
      });
    }

    const result = await geocodeFirstResult(query);

    if (!result || typeof result.lat !== "number" || typeof result.lng !== "number") {
      return res.status(404).json({
        message: t(req, "locationNotFound"),
      });
    }

    const finalLabel = label || t(req, "currentLocationLabel");

    await firestoreRepo.saveRecommendationState(uid, {
      temporary_location: {
        label: finalLabel,
        address: result.address,
        lat: result.lat,
        lng: result.lng,
      },
    });

    return res.json({
      ok: true,
      location: {
        label: finalLabel,
        address: result.address,
        lat: result.lat,
        lng: result.lng,
      },
    });
  } catch (error) {
    console.error("[controladorChatbot.updateTemporaryLocation]", error);
    return res.status(500).json({
      message: error.message || t(req, "temporaryLocationError"),
    });
  }
}

async function resolveLocation(req, res) {
  try {
    const uid = req.user?.id || req.user?.uid;

    if (!uid) {
      return res.status(401).json({ message: t(req, "unauthenticated") });
    }

    const { query } = req.body || {};

    if (!query || typeof query !== "string") {
      return res.status(400).json({
        message: t(req, "validSearchRequired"),
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
      message: error.message || t(req, "resolveLocationError"),
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