const express = require('express');
const router = express.Router();
const eventController = require('../controller/controladorEventos');
const comentariosController = require('../controller/controladorComentarios');
const { verifyToken, requireAdmin } = require('../middelware/authmiddelware');


router.get('/aceptadas', eventController.listAcceptedEvents);
router.post('/solicitar', verifyToken, eventController.requestEvent);
router.get('/pendientes', verifyToken, requireAdmin, eventController.getPendingEvents);
router.put('/aceptar/:id', verifyToken, requireAdmin, eventController.acceptEvent);
router.delete('/:id', verifyToken, requireAdmin, eventController.rejectEvent);


router.post('/comentarios', verifyToken, comentariosController.crearComentario);
router.get('/comentarios/mis-fiestas', verifyToken, comentariosController.obtenerComentariosRecibidos);
router.get('/comentarios/enviados', verifyToken, comentariosController.obtenerComentariosEnviados);
router.get('/comentarios/por-evento/:id', verifyToken, comentariosController.getComentariosPorEvento);


module.exports = router;
