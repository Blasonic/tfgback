// models/Usuario.js
const mongoose = require('mongoose');

const usuarioSchema = new mongoose.Schema({
  nombre_usuario: String,
  foto: String,
  rol: String,
  // otros campos si los tienes
});

module.exports = mongoose.model('Usuario', usuarioSchema);
