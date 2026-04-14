const express = require("express");
const router = express.Router();

const controladorChatbot = require("../controller/controladorChatbot");
const { verifyToken } = require("../middelware/authmiddelware");

router.post("/message", verifyToken, controladorChatbot.processMessage);
router.post("/interactions", verifyToken, controladorChatbot.trackInteraction);
router.get("/preferences", verifyToken, controladorChatbot.getPreferences);
router.put("/preferences/base-location", verifyToken, controladorChatbot.updateBaseLocation);

module.exports = router;