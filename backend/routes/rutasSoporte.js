const express = require('express');
const router = express.Router();
const controladorSoporte = require('../controller/controladorSoporte');
const { verifyToken, requireAdmin } = require('../middelware/authmiddelware');

// Auth (usuario logueado)
router.post('/crear', verifyToken, controladorSoporte.crearMensaje);

// Admin
router.get('/lista', verifyToken, requireAdmin, controladorSoporte.listarMensajes);
router.post('/responder', verifyToken, requireAdmin, controladorSoporte.responderMensaje);

module.exports = router;
