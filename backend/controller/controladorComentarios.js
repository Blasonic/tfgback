const db = require('../models/db');

module.exports = {
  // POST /api/comentarios
  // -> UPSERT: 1 comentario por user por fiesta (mejor UX que bloquear)
  crearComentario: async (req, res) => {
    const { fiesta_id, estrellas, texto } = req.body;
    const autor_id = req.user?.id; // uid firebase

    const fiestaId = Number(fiesta_id);
    const estrellasNum = Number(estrellas);

    if (!autor_id) return res.status(401).json({ message: 'No autorizado' });
    if (!fiestaId || Number.isNaN(fiestaId)) {
      return res.status(400).json({ message: 'fiesta_id inválido' });
    }
    if (!Number.isInteger(estrellasNum) || estrellasNum < 1 || estrellasNum > 5) {
      return res.status(400).json({ message: 'estrellas debe ser 1-5' });
    }

    try {
      const [[fiesta]] = await db.query('SELECT id FROM fiestas WHERE id = ?', [fiestaId]);
      if (!fiesta) return res.status(404).json({ message: 'Fiesta no encontrada' });

      // OJO: requiere UNIQUE(fiesta_id, autor_id)
      await db.query(
        `INSERT INTO comentarios (fiesta_id, autor_id, estrellas, texto)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           estrellas = VALUES(estrellas),
           texto = VALUES(texto),
           fecha_actualizacion = CURRENT_TIMESTAMP`,
        [fiestaId, autor_id, estrellasNum, texto || null]
      );

      res.status(201).json({ message: 'Comentario guardado' });
    } catch (error) {
      console.error('Error en crearComentario:', error);
      res.status(500).json({ message: 'Error al guardar el comentario' });
    }
  },

  // GET /api/comentarios/mis-fiestas
  // -> comentarios hechos en fiestas que YO he creado (sin receptor_id)
  obtenerComentariosRecibidos: async (req, res) => {
    const miUid = req.user?.id;
    if (!miUid) return res.status(401).json({ message: 'No autorizado' });

    try {
      const [comentarios] = await db.query(
        `
        SELECT c.*, f.titulo AS titulo_fiesta
        FROM comentarios c
        JOIN fiestas f ON c.fiesta_id = f.id
        WHERE f.creado_por = ?
        ORDER BY c.fecha_creacion DESC
        `,
        [miUid]
      );

      res.json(comentarios);
    } catch (error) {
      console.error('Error en obtenerComentariosRecibidos:', error);
      res.status(500).json({ message: 'Error al obtener comentarios' });
    }
  },

  // GET /api/comentarios/enviados
  obtenerComentariosEnviados: async (req, res) => {
    const autor_id = req.user?.id;
    if (!autor_id) return res.status(401).json({ message: 'No autorizado' });

    try {
      const [comentarios] = await db.query(
        `
        SELECT c.*, f.titulo AS titulo_fiesta
        FROM comentarios c
        JOIN fiestas f ON c.fiesta_id = f.id
        WHERE c.autor_id = ?
        ORDER BY c.fecha_creacion DESC
        `,
        [autor_id]
      );

      res.json(comentarios);
    } catch (error) {
      console.error('Error en obtenerComentariosEnviados:', error);
      res.status(500).json({ message: 'Error al obtener tus comentarios' });
    }
  },

  // GET /api/comentarios/por-evento/:id  (pública)
  getComentariosPorEvento: async (req, res) => {
    const fiestaId = Number(req.params.id);
    if (!fiestaId) return res.status(400).json({ message: 'ID inválido' });

    try {
      const [comentarios] = await db.query(
        `
        SELECT c.*, f.titulo AS titulo_fiesta
        FROM comentarios c
        JOIN fiestas f ON c.fiesta_id = f.id
        WHERE c.fiesta_id = ?
        ORDER BY c.fecha_creacion DESC
        `,
        [fiestaId]
      );

      res.json(comentarios);
    } catch (error) {
      console.error('Error en getComentariosPorEvento:', error);
      res.status(500).json({ message: 'Error al obtener comentarios del evento' });
    }
  },

  // GET /api/comentarios/top  (pública)
  getComentariosTop: async (_req, res) => {
    try {
      const [comentarios] = await db.query(
        `
        SELECT c.*, f.titulo AS titulo_fiesta
        FROM comentarios c
        JOIN fiestas f ON c.fiesta_id = f.id
        ORDER BY c.estrellas DESC, c.fecha_creacion DESC
        LIMIT 10
        `
      );

      res.json(comentarios);
    } catch (error) {
      console.error('Error en getComentariosTop:', error);
      res.status(500).json({ message: 'Error al obtener comentarios destacados' });
    }
  },
};
