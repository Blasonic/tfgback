const express = require("express");
const router = express.Router();

const {
  listarAyuntamientos,
  obtenerAyuntamiento,
  listarPlanesPorMunicipio,
} = require("../controller/controladorAyuntamientos");

router.get("/", listarAyuntamientos);
router.get("/municipio/:municipio/planes", listarPlanesPorMunicipio);
router.get("/:id", obtenerAyuntamiento);

module.exports = router;