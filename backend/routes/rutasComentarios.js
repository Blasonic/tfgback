const express = require('express');
const router = express.Router();
const {
  crearComentario,
  obtenerComentariosRecibidos,
  obtenerComentariosEnviados,
  getComentariosPorEvento,
  getComentariosTop
} = require('../controladores/controladorComentarios');
const { authMiddleware } = require('../middlewares/authMiddleware');

// Crear un nuevo comentario (requiere autenticación)
router.post('/', authMiddleware, crearComentario);

// Comentarios recibidos por el usuario autenticado
router.get('/mis-fiestas', authMiddleware, obtenerComentariosRecibidos);

// Comentarios enviados por el usuario autenticado
router.get('/enviados', authMiddleware, obtenerComentariosEnviados);

// Comentarios de un evento específico (público)
router.get('/por-evento/:id', getComentariosPorEvento);

// Comentarios mejor valorados (público)
router.get('/top', getComentariosTop);

module.exports = router;
