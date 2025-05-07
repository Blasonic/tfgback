const axios = require('axios');

const USUARIOS_API = process.env.USUARIOS_API || 'http://localhost:3001'; // URL del backend de usuarios
const API_KEY = process.env.INTERNAL_API_KEY || 'Jirafa2004'; // debe coincidir con el .env del backend Mongo

// Caché en memoria simple
const userCache = new Map();

async function getUserById(id) {
  if (userCache.has(id)) {
    return userCache.get(id);
  }

  try {
    const res = await axios.get(`${USUARIOS_API}/api/usuarios/${id}/resumen`, {
      headers: {
        'x-api-key': API_KEY
      }
    });

    const user = res.data;
    userCache.set(id, user); // guardamos en caché
    return user;
  } catch (error) {
    console.warn(`❌ Error al obtener usuario ${id}:`, error.response?.data || error.message);
    return null;
  }
}

module.exports = { getUserById };
