const express = require("express");
const router = express.Router();

const controladorChatbot = require("../controller/controladorChatbot");
const { verifyToken } = require("../middelware/authmiddelware");

router.post("/message", verifyToken, controladorChatbot.processMessage);
router.post("/interactions", verifyToken, controladorChatbot.trackInteraction);
router.get("/preferences", verifyToken, controladorChatbot.getPreferences);

router.put(
  "/preferences/base-location",
  verifyToken,
  controladorChatbot.updateBaseLocation
);

router.put(
  "/preferences/temporary-location",
  verifyToken,
  controladorChatbot.updateTemporaryLocation
);

router.post(
  "/location/resolve",
  verifyToken,
  controladorChatbot.resolveLocation
);

module.exports = router;