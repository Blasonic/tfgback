const express = require('express');
const router = express.Router();
const eventController = require('../controller/controladorEventos');
const { verifyToken, requireAdmin } = require('../middelware/authmiddelware');

router.get('/aceptadas', eventController.listAcceptedEvents);
router.post('/solicitar', verifyToken, eventController.requestEvent);
router.get('/pendientes', verifyToken, requireAdmin, eventController.getPendingEvents);
router.put('/aceptar/:id', verifyToken, requireAdmin, eventController.acceptEvent);
router.delete('/:id', verifyToken, requireAdmin, eventController.rejectEvent);

module.exports = router;
