const express = require('express');
const router = express.Router();

// Importar controlador completo
let controlador;

try {
  controlador = require('../controller/controladorComentarios');
} catch (err) {
  console.error('❌ Error cargando controladorComentarios:', err);
  process.exit(1);
}

// Importar middleware de autenticación
let authMiddleware;
try {
  const auth = require('../middelware/authmiddelware');
  authMiddleware = auth.authMiddleware;

} catch (err) {
  console.error('❌ Error cargando authmiddelware:', err);
  process.exit(1);
}

// Verificar que todos los handlers estén definidos
const handlers = [
  'crearComentario',
  'obtenerComentariosRecibidos',
  'obtenerComentariosEnviados',
  'getComentariosPorEvento',
  'getComentariosTop'
];

handlers.forEach((fn) => {
  if (typeof controlador[fn] !== 'function') {
    console.error(`❌ Handler "${fn}" no está definido o no es una función`);
    process.exit(1);
  }
});

// Definición de rutas
router.post('/', authMiddleware, controlador.crearComentario);
router.get('/mis-fiestas', authMiddleware, controlador.obtenerComentariosRecibidos);
router.get('/enviados', authMiddleware, controlador.obtenerComentariosEnviados);
router.get('/por-evento/:id', controlador.getComentariosPorEvento); // pública
router.get('/top', controlador.getComentariosTop); // pública

module.exports = router;
