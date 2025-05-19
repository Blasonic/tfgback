const express = require('express');
const cors = require('cors');
const app = express();
require('dotenv').config();

const soporteRoutes = require('./routes/rutasSoporte'); // ← nuevo archivo separado
const fiestasRoutes = require('./routes/rutas');   // ← las de antes

app.use(cors());
app.use(express.json());

// Rutas
app.use('/api/soporte', soporteRoutes);   // 👈 ahora soporte tiene su propio namespace
app.use('/api/fiestas', fiestasRoutes);   // fiestas sigue igual

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
