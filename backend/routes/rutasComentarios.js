const express = require('express');
const router = express.Router();
const controlador = require('../controller/controladorComentarios');
const { authMiddleware } = require('../middelware/authmiddelware');

// Auth
router.post('/', authMiddleware, controlador.crearComentario);
router.get('/mis-fiestas', authMiddleware, controlador.obtenerComentariosRecibidos);
router.get('/enviados', authMiddleware, controlador.obtenerComentariosEnviados);

// Público
router.get('/por-evento/:id', controlador.getComentariosPorEvento);
router.get('/top', controlador.getComentariosTop);

module.exports = router;
