// controller/controladorComentarios.js
const db = require("../models/db");

function getUid(req) {
  return req?.auth?.uid || req?.user?.id || null;
}

module.exports = {
  // POST /api/comentarios  (auth)
  // UPSERT: 1 comentario por user por fiesta
  crearComentario: async (req, res) => {
    const { fiesta_id, estrellas, texto } = req.body;

    const autor_uid = getUid(req);
    const fiestaId = Number(fiesta_id);
    const estrellasNum = Number(estrellas);

    if (!autor_uid) return res.status(401).json({ message: "No autorizado" });
    if (!fiestaId || Number.isNaN(fiestaId)) {
      return res.status(400).json({ message: "fiesta_id inválido" });
    }
    if (!Number.isInteger(estrellasNum) || estrellasNum < 1 || estrellasNum > 5) {
      return res.status(400).json({ message: "estrellas debe ser 1-5" });
    }

    try {
      const [[fiesta]] = await db.query("SELECT id FROM fiestas WHERE id = ?", [fiestaId]);
      if (!fiesta) return res.status(404).json({ message: "Fiesta no encontrada" });

      // Requiere UNIQUE(fiesta_id, autor_uid)
      await db.query(
        `
        INSERT INTO comentarios (fiesta_id, autor_uid, estrellas, texto, status)
        VALUES (?, ?, ?, ?, 'visible')
        ON DUPLICATE KEY UPDATE
          estrellas = VALUES(estrellas),
          texto = VALUES(texto),
          status = 'visible'
        `,
        [fiestaId, autor_uid, estrellasNum, texto || null]
      );

      return res.status(201).json({ message: "Comentario guardado" });
    } catch (error) {
      console.error("Error en crearComentario:", error);
      return res.status(500).json({ message: "Error al guardar el comentario" });
    }
  },

  // GET /api/comentarios/mis-fiestas (auth)
  // Comentarios recibidos en mis fiestas (yo soy creador)
  obtenerComentariosRecibidos: async (req, res) => {
    const miUid = getUid(req);
    if (!miUid) return res.status(401).json({ message: "No autorizado" });

    try {
      const [comentarios] = await db.query(
        `
        SELECT c.id, c.fiesta_id, c.autor_uid, c.estrellas, c.texto, c.created_at, c.status,
               f.titulo AS titulo_fiesta
        FROM comentarios c
        JOIN fiestas f ON c.fiesta_id = f.id
        WHERE f.creado_por_uid = ?
          AND c.status <> 'deleted'
        ORDER BY c.created_at DESC
        `,
        [miUid]
      );

      return res.json(comentarios);
    } catch (error) {
      console.error("Error en obtenerComentariosRecibidos:", error);
      return res.status(500).json({ message: "Error al obtener comentarios" });
    }
  },

  // GET /api/comentarios/enviados (auth)
  obtenerComentariosEnviados: async (req, res) => {
    const autor_uid = getUid(req);
    if (!autor_uid) return res.status(401).json({ message: "No autorizado" });

    try {
      const [comentarios] = await db.query(
        `
        SELECT c.id, c.fiesta_id, c.autor_uid, c.estrellas, c.texto, c.created_at, c.status,
               f.titulo AS titulo_fiesta
        FROM comentarios c
        JOIN fiestas f ON c.fiesta_id = f.id
        WHERE c.autor_uid = ?
          AND c.status <> 'deleted'
        ORDER BY c.created_at DESC
        `,
        [autor_uid]
      );

      return res.json(comentarios);
    } catch (error) {
      console.error("Error en obtenerComentariosEnviados:", error);
      return res.status(500).json({ message: "Error al obtener tus comentarios" });
    }
  },

  // GET /api/comentarios/por-evento/:id (pública)
  getComentariosPorEvento: async (req, res) => {
    const fiestaId = Number(req.params.id);
    if (!Number.isInteger(fiestaId) || fiestaId <= 0) {
      return res.status(400).json({ message: "ID inválido" });
    }

    try {
      const [comentarios] = await db.query(
        `
        SELECT c.id, c.fiesta_id, c.autor_uid, c.estrellas, c.texto, c.created_at, c.status,
               f.titulo AS titulo_fiesta
        FROM comentarios c
        JOIN fiestas f ON c.fiesta_id = f.id
        WHERE c.fiesta_id = ?
          AND c.status IN ('visible','reported','hidden')
        ORDER BY c.created_at DESC
        `,
        [fiestaId]
      );

      return res.json(comentarios);
    } catch (error) {
      console.error("Error en getComentariosPorEvento:", error);
      return res.status(500).json({ message: "Error al obtener comentarios del evento" });
    }
  },

  // GET /api/comentarios/top (pública)
  getComentariosTop: async (_req, res) => {
    try {
      const [comentarios] = await db.query(
        `
        SELECT c.id, c.fiesta_id, c.autor_uid, c.estrellas, c.texto, c.created_at, c.status,
               f.titulo AS titulo_fiesta
        FROM comentarios c
        JOIN fiestas f ON c.fiesta_id = f.id
        WHERE c.status = 'visible'
        ORDER BY c.estrellas DESC, c.created_at DESC
        LIMIT 10
        `
      );

      return res.json(comentarios);
    } catch (error) {
      console.error("Error en getComentariosTop:", error);
      return res.status(500).json({ message: "Error al obtener comentarios destacados" });
    }
  },
};