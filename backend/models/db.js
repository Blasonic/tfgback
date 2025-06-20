const mysql = require('mysql2/promise'); // 👈 Asegúrate que dice /promise
require('dotenv').config();

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

module.exports = db; // 👈 Exporta el pool directamente
