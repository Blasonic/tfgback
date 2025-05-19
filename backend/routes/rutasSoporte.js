const express = require('express');
const router = express.Router();
const controladorSoporte = require('../controller/controladorSoporte');
const { verifyToken } = require('../middelware/authmiddelware');

router.post('/crear', verifyToken, controladorSoporte.crearMensaje);
router.get('/lista', controladorSoporte.listarMensajes);
router.post('/responder', controladorSoporte.responderMensaje);

module.exports = router;
