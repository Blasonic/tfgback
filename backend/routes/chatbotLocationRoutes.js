import express from "express";
import {
  resolveLocation,
  updateBaseLocationFromText,
  updateTemporaryLocationFromText,
} from "../controlador/chatbotLocationController.js";
import { verifyFirebaseToken } from "../middleware/verifyFirebaseToken.js";

const router = express.Router();

router.post("/location/resolve", verifyFirebaseToken, resolveLocation);
router.put(
  "/preferences/base-location",
  verifyFirebaseToken,
  updateBaseLocationFromText
);
router.put(
  "/preferences/temporary-location",
  verifyFirebaseToken,
  updateTemporaryLocationFromText
);

export default router;