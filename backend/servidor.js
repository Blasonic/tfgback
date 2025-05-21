const express = require('express');
const cors = require('cors');
const app = express();
require('dotenv').config();

const soporteRoutes = require('./routes/rutasSoporte');       // Soporte técnico
const fiestasRoutes = require('./routes/rutas');              // Fiestas
const comentariosRoutes = require('./routes/rutasComentarios'); // Comentarios 👈 NUEVO

app.use(cors());
app.use(express.json());

// Rutas
app.use('/api/soporte', soporteRoutes);
app.use('/api/fiestas', fiestasRoutes);
app.use('/api/comentarios', comentariosRoutes); // 👈 Añadido

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
