const db = require('../models/db');
const { getUserById } = require('./controladorMongo');

// POST /api/comentarios
exports.crearComentario = async (req, res) => {
  const { fiesta_id, estrellas, texto } = req.body;
  const autor_id = req.user.id;

  if (!fiesta_id || !estrellas || !texto) {
    return res.status(400).json({ message: 'Faltan campos obligatorios' });
  }

  try {
    const [yaComentado] = await db.query(
      'SELECT id FROM comentarios WHERE fiesta_id = ? AND autor_id = ?',
      [fiesta_id, autor_id]
    );

    if (yaComentado.length > 0) {
      return res.status(400).json({ message: 'Ya has comentado en este evento' });
    }

    const [[fiesta]] = await db.query('SELECT creado_por FROM fiestas WHERE id = ?', [fiesta_id]);
    if (!fiesta) return res.status(404).json({ message: 'Fiesta no encontrada' });

    const receptor_id = fiesta.creado_por;

    await db.query(`
      INSERT INTO comentarios (fiesta_id, autor_id, receptor_id, estrellas, texto)
      VALUES (?, ?, ?, ?, ?)`,
      [fiesta_id, autor_id, receptor_id, estrellas, texto]
    );

    res.status(201).json({ message: 'Comentario registrado' });
  } catch (error) {
    console.error('Error en crearComentario:', error);
    res.status(500).json({ message: 'Error al guardar el comentario' });
  }
};

// GET /api/comentarios/mis-fiestas
exports.obtenerComentariosRecibidos = async (req, res) => {
  const receptor_id = req.user.id;

  try {
    const [comentarios] = await db.query(`
      SELECT c.*, f.titulo AS titulo_fiesta
      FROM comentarios c
      JOIN fiestas f ON c.fiesta_id = f.id
      WHERE c.receptor_id = ?
      ORDER BY c.fecha_creacion DESC
    `, [receptor_id]);

    const comentariosConAutor = await Promise.all(
      comentarios.map(async (comentario) => {
        const autor = await getUserById(comentario.autor_id);
        return {
          ...comentario,
          autor_nombre: autor?.user || 'Usuario desconocido',
          autor_avatar: autor?.profilePicture || null
        };
      })
    );

    res.json(comentariosConAutor);
  } catch (error) {
    console.error('Error en obtenerComentariosRecibidos:', error);
    res.status(500).json({ message: 'Error al obtener comentarios' });
  }
};

// GET /api/comentarios/enviados
exports.obtenerComentariosEnviados = async (req, res) => {
  const autor_id = req.user.id;

  try {
    const [comentarios] = await db.query(`
      SELECT c.*, f.titulo AS titulo_fiesta
      FROM comentarios c
      JOIN fiestas f ON c.fiesta_id = f.id
      WHERE c.autor_id = ?
      ORDER BY c.fecha_creacion DESC
    `, [autor_id]);

    res.json(comentarios);
  } catch (error) {
    console.error('Error en obtenerComentariosEnviados:', error);
    res.status(500).json({ message: 'Error al obtener tus comentarios' });
  }
};

// GET /api/comentarios/por-evento/:id
exports.getComentariosPorEvento = async (req, res) => {
  const { id } = req.params;

  try {
    const [comentarios] = await db.query(`
      SELECT c.*, f.titulo AS titulo_fiesta
      FROM comentarios c
      JOIN fiestas f ON c.fiesta_id = f.id
      WHERE c.fiesta_id = ?
      ORDER BY c.fecha_creacion DESC
    `, [id]);

    const comentariosConAutor = await Promise.all(
      comentarios.map(async (c) => {
        const autor = await getUserById(c.autor_id);
        return {
          ...c,
          autor_nombre: autor?.user || 'Anónimo',
          autor_avatar: autor?.profilePicture || null
        };
      })
    );

    res.json(comentariosConAutor);
  } catch (error) {
    console.error('Error en getComentariosPorEvento:', error);
    res.status(500).json({ message: 'Error al obtener comentarios del evento' });
  }
};

// GET /api/comentarios/top
exports.getComentariosTop = async (req, res) => {
  try {
    const [comentarios] = await db.query(`
      SELECT c.*, f.titulo AS titulo_fiesta
      FROM comentarios c
      JOIN fiestas f ON c.fiesta_id = f.id
      ORDER BY c.estrellas DESC, c.fecha_creacion DESC
      LIMIT 10
    `);

    const comentariosConAutor = await Promise.all(
      comentarios.map(async (c) => {
        const autor = await getUserById(c.autor_id);
        return {
          ...c,
          autor_nombre: autor?.user || 'Anónimo',
          autor_avatar: autor?.profilePicture || null
        };
      })
    );

    res.json(comentariosConAutor);
  } catch (error) {
    console.error('Error en getComentariosTop:', error);
    res.status(500).json({ message: 'Error al obtener comentarios destacados' });
  }
};
