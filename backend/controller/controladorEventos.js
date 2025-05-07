const { pool } = require('../models/db');
const { getUserById } = require('./controladorMongo');

exports.listAcceptedEvents = async (req, res) => {
  try {
    const [eventos] = await pool.query(
      'SELECT * FROM fiestas WHERE estado = "aceptado" ORDER BY fecha_inicio, hora_inicio'
    );

    const eventosConUsuarios = await Promise.all(
      eventos.map(async (evento) => {
        if (!evento.creado_por) return evento;

        const user = await getUserById(evento.creado_por); // 👈 Aquí se busca al usuario

        if (user?.role === 'user') {
          return {
            ...evento,
            creador_nombre: user.user,
            creador_foto: user.profilePicture,
            creador_rol: user.role
          };
        }

        return evento;
      })
    );

    res.json(eventosConUsuarios);
  } catch (error) {
    console.error('Error en listAcceptedEvents:', error);
    res.status(500).json({ message: 'Error cargando eventos' });
  }
};



// ✅ Solicitar un nuevo evento (estado inicial: pendiente)
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

  const creado_por = req.user?.id;

  if (!(titulo && fecha_inicio && fecha_fin && tipo && imagen)) {
    return res.status(400).json({ message: 'Faltan datos obligatorios' });
  }

  try {
    await pool.query(
      `INSERT INTO fiestas (titulo, descripcion, fecha_inicio, fecha_fin, hora_inicio, hora_fin, tipo, imagen, provincia, direccion, creado_por, estado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        titulo,
        descripcion,
        fecha_inicio,
        fecha_fin,
        hora_inicio || null,
        hora_fin || null,
        tipo,
        imagen,
        provincia,
        direccion,
        creado_por,
        'pendiente'
      ]
    );

    res.status(201).json({ message: 'Solicitud enviada' });
  } catch (error) {
    console.error('Error en requestEvent:', error);
    res.status(500).json({ message: 'Error al registrar el evento' });
  }
};

// ✅ Obtener eventos pendientes
exports.getPendingEvents = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM fiestas WHERE estado = "pendiente" ORDER BY creado_en DESC'
    );
    res.json(rows);
  } catch (error) {
    console.error('Error en getPendingEvents:', error);
    res.status(500).json({ message: 'Error al obtener eventos pendientes' });
  }
};

// ✅ Aceptar evento (cambia estado a aceptado)
exports.acceptEvent = async (req, res) => {
  try {
    await pool.query('UPDATE fiestas SET estado = "aceptado" WHERE id = ?', [req.params.id]);
    res.json({ message: 'Evento aceptado' });
  } catch (error) {
    console.error('Error en acceptEvent:', error);
    res.status(500).json({ message: 'Error al aceptar evento' });
  }
};

// ✅ Rechazar evento (elimina el registro)
exports.rejectEvent = async (req, res) => {
  try {
    await pool.query('DELETE FROM fiestas WHERE id = ?', [req.params.id]);
    res.json({ message: 'Evento eliminado' });
  } catch (error) {
    console.error('Error en rejectEvent:', error);
    res.status(500).json({ message: 'Error al eliminar evento' });
  }
};
