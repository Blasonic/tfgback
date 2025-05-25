const express = require('express');
const cors = require('cors');
const app = express();
require('dotenv').config();

const soporteRoutes = require('./routes/rutasSoporte');
const fiestasRoutes = require('./routes/rutas');
const comentariosRoutes = require('./routes/rutasComentarios'); // ✅

app.use(cors());
app.use(express.json());

app.use('/api/soporte', soporteRoutes);
app.use('/api/fiestas', fiestasRoutes);
app.use('/api/comentarios', comentariosRoutes); // ✅

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
