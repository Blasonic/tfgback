const { pool } = require('../models/db');

exports.listAcceptedEvents = async (req, res) => {
  const [rows] = await pool.query(
    'SELECT * FROM fiestas WHERE estado = "aceptado" ORDER BY fecha, hora'
  );
  res.json(rows);
};

exports.requestEvent = async (req, res) => {
  const {
    titulo,
    descripcion,
    fecha_inicio,
    fecha_fin,
    hora_inicio,
    hora_fin,
    tipo,
    imagen,
    provincia,
    direccion
  } = req.body;

  const creado_por = req.user.id;

  if (!(titulo && fecha_inicio && fecha_fin && hora_inicio && hora_fin && tipo && imagen)) {
    return res.status(400).json({ message: 'Faltan datos obligatorios' });
  }

  await pool.query(
    `INSERT INTO fiestas (titulo, descripcion, fecha_inicio, fecha_fin, hora_inicio, hora_fin, tipo, imagen, provincia, direccion, creado_por)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [titulo, descripcion, fecha_inicio, fecha_fin, hora_inicio, hora_fin, tipo, imagen, provincia, direccion, creado_por]
  );

  res.status(201).json({ message: 'Solicitud enviada' });
};


exports.getPendingEvents = async (req, res) => {
  const [rows] = await pool.query(
    'SELECT * FROM fiestas WHERE estado = "pendiente" ORDER BY creado_en DESC'
  );
  res.json(rows);
};

exports.acceptEvent = async (req, res) => {
  await pool.query('UPDATE fiestas SET estado = "aceptado" WHERE id = ?', [req.params.id]);
  res.json({ message: 'Evento aceptado' });
};

exports.rejectEvent = async (req, res) => {
  await pool.query('UPDATE fiestas SET estado = "rechazado" WHERE id = ?', [req.params.id]);
  res.json({ message: 'Evento rechazado' });
};