const chatbotService = require("../services/chatbotService");
const firestoreRepo = require("../repositories/firestoreRepo");

async function processMessage(req, res) {
  try {
    const uid = req.user?.id || req.user?.uid;

    if (!uid) {
      return res.status(401).json({ message: "Usuario no autenticado." });
    }

    const { message, conversationState = null, visibleEventIds = [] } = req.body || {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({ message: "El campo message es obligatorio." });
    }

    const result = await chatbotService.processMessage({
      uid,
      message,
      conversationState,
      visibleEventIds,
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

    const { label, lat, lng } = req.body || {};

    if (!label || typeof lat !== "number" || typeof lng !== "number") {
      return res.status(400).json({
        message: "label, lat y lng son obligatorios y deben ser válidos.",
      });
    }

    await firestoreRepo.updateBaseLocation(uid, { label, lat, lng });

    return res.json({ ok: true });
  } catch (error) {
    console.error("[controladorChatbot.updateBaseLocation]", error);
    return res.status(500).json({
      message: error.message || "No se pudo actualizar la ubicación base.",
    });
  }
}

module.exports = {
  processMessage,
  trackInteraction,
  getPreferences,
  updateBaseLocation,
};