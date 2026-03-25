const express = require('express');
const router = express.Router();

const eventController = require('../controller/controladorEventos');
const searchController = require('../controller/controladorBuscador');
const { verifyToken, requireAdmin } = require('../middelware/authmiddelware');

// Público
router.get('/aceptadas', eventController.listAcceptedEvents);
router.get('/buscar', searchController.searchAcceptedEvents);
router.get('/filtros', searchController.getSearchFilters);
router.get('/detalle/:id', searchController.getAcceptedEventById);

// Auth
router.post('/solicitar', verifyToken, eventController.requestEvent);

// Admin
router.get('/pendientes', verifyToken, requireAdmin, eventController.getPendingEvents);
router.put('/aceptar/:id', verifyToken, requireAdmin, eventController.acceptEvent);
router.delete('/:id', verifyToken, requireAdmin, eventController.rejectEvent);

module.exports = router;