const express = require('express');
require('dotenv').config();
const cors = require('cors');
const app = express();

const eventRoutes = require('./routes/rutas');


app.use(cors());
app.use(express.json());

app.use('/api/fiestas', eventRoutes);


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor de eventos escuchando en puerto ${PORT}`));
