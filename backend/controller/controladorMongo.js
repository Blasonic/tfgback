// controladorMongo.js en el backend de fiestas (MySQL)
const axios = require('axios');

const USUARIOS_API = process.env.USUARIOS_API || 'http://localhost:5000';
const API_KEY = process.env.INTERNAL_API_KEY || 'Jirafa2004';

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
    userCache.set(id, user);
    return user;
  } catch (error) {
    console.warn(`❌ Error al obtener usuario ${id}:`, error.response?.data || error.message);
    return null;
  }
}

module.exports = { getUserById };
