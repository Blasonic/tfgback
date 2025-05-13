// modelo/Usuario.js
const mongoose = require('mongoose');

const usuarioSchema = new mongoose.Schema({
  user: String,               // nombre de usuario (p. ej., "Danisito")
  profilePicture: String,     // ruta a la imagen
  role: String                // debe ser 'user' o 'admin'
});

module.exports = mongoose.model('Usuario', usuarioSchema);

