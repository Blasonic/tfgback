// controller/controladorComentarios.js
const db = require("../models/db");
const admin = require("../models/firebaseAdmin");

function getLang(req) {
  return req.headers["accept-language"]?.startsWith("en") ? "en" : "es";
}

const messages = {
  es: {
    unauthorized: "No autorizado",
    invalidFiestaId: "fiesta_id inválido",
    invalidStars: "estrellas debe ser 1-5",
    fiestaNotFound: "Fiesta no encontrada",
    commentSaved: "Comentario guardado",
    userNotSynced: "Usuario no existe/sincronizado en MySQL",
    saveCommentError: "Error al guardar el comentario",
    getCommentsError: "Error al obtener comentarios",
    getYourCommentsError: "Error al obtener tus comentarios",
    invalidId: "ID inválido",
    getEventCommentsError: "Error al obtener comentarios del evento",
    getTopCommentsError: "Error al obtener comentarios destacados",
  },
  en: {
    unauthorized: "Unauthorized",
    invalidFiestaId: "Invalid fiesta_id",
    invalidStars: "stars must be 1-5",
    fiestaNotFound: "Event not found",
    commentSaved: "Comment saved",
    userNotSynced: "User does not exist/is not synchronized in MySQL",
    saveCommentError: "Error saving the comment",
    getCommentsError: "Error retrieving comments",
    getYourCommentsError: "Error retrieving your comments",
    invalidId: "Invalid ID",
    getEventCommentsError: "Error retrieving event comments",
    getTopCommentsError: "Error retrieving featured comments",
  },
};

function t(req, key) {
  const lang = getLang(req);
  return messages[lang][key] || messages.es[key] || key;
}

function getUid(req) {
  return req?.auth?.uid || req?.user?.uid || req?.user?.id || null;
}

async function ensureMysqlUser(firebaseUid) {
  const [rows] = await db.query(
    "SELECT firebase_uid FROM users WHERE firebase_uid = ? LIMIT 1",
    [firebaseUid]
  );

  if (rows.length > 0) return;

  let username = null;
  let profilePicture = null;

  try {
    const u = await admin.auth().getUser(firebaseUid);
    username = u.displayName || null;
    profilePicture = u.photoURL || null;
  } catch (e) {
    username = null;
    profilePicture = null;
  }

  await db.query(
    `
    INSERT INTO users (firebase_uid, username, profile_picture)
    VALUES (?, ?, ?)
    `,
    [firebaseUid, username, profilePicture]
  );
}

module.exports = {
  crearComentario: async (req, res) => {
    const { fiesta_id, estrellas, texto } = req.body;

    const autor_uid = getUid(req);
    const fiestaId = Number(fiesta_id);
    const estrellasNum = Number(estrellas);

    if (!autor_uid) {
      return res.status(401).json({ message: t(req, "unauthorized") });
    }

    if (!Number.isInteger(fiestaId) || fiestaId <= 0) {
      return res.status(400).json({ message: t(req, "invalidFiestaId") });
    }

    if (
      !Number.isInteger(estrellasNum) ||
      estrellasNum < 1 ||
      estrellasNum > 5
    ) {
      return res.status(400).json({ message: t(req, "invalidStars") });
    }

    try {
      const [[fiesta]] = await db.query(
        "SELECT id FROM fiestas WHERE id = ?",
        [fiestaId]
      );

      if (!fiesta) {
        return res.status(404).json({ message: t(req, "fiestaNotFound") });
      }

      await ensureMysqlUser(autor_uid);

      await db.query(
        `
        INSERT INTO comentarios (fiesta_id, autor_uid, estrellas, texto, status)
        VALUES (?, ?, ?, ?, 'visible')
        ON DUPLICATE KEY UPDATE
          estrellas = VALUES(estrellas),
          texto = VALUES(texto),
          status = 'visible',
          updated_at = CURRENT_TIMESTAMP
        `,
        [fiestaId, autor_uid, estrellasNum, texto || null]
      );

      return res.status(201).json({ message: t(req, "commentSaved") });
    } catch (error) {
      console.error("Error en crearComentario:", error);

      if (error.code === "ER_NO_REFERENCED_ROW_2") {
        return res.status(409).json({ message: t(req, "userNotSynced") });
      }

      return res.status(500).json({ message: t(req, "saveCommentError") });
    }
  },

  obtenerComentariosRecibidos: async (req, res) => {
    const miUid = getUid(req);

    if (!miUid) {
      return res.status(401).json({ message: t(req, "unauthorized") });
    }

    try {
      const [comentarios] = await db.query(
        `
        SELECT
          c.id,
          c.fiesta_id,
          c.autor_uid,
          c.estrellas,
          c.texto,
          c.created_at AS fecha_creacion,
          c.status,
          f.titulo AS titulo_fiesta,
          u.username AS autor_nombre,
          u.profile_picture AS autor_avatar
        FROM comentarios c
        JOIN fiestas f ON c.fiesta_id = f.id
        LEFT JOIN users u ON u.firebase_uid = c.autor_uid
        WHERE f.creado_por_uid = ?
          AND c.status <> 'deleted'
        ORDER BY c.created_at DESC
        `,
        [miUid]
      );

      return res.json(comentarios);
    } catch (error) {
      console.error("Error en obtenerComentariosRecibidos:", error);
      return res.status(500).json({ message: t(req, "getCommentsError") });
    }
  },

  obtenerComentariosEnviados: async (req, res) => {
    const autor_uid = getUid(req);

    if (!autor_uid) {
      return res.status(401).json({ message: t(req, "unauthorized") });
    }

    try {
      const [comentarios] = await db.query(
        `
        SELECT
          c.id,
          c.fiesta_id,
          c.autor_uid,
          c.estrellas,
          c.texto,
          c.created_at AS fecha_creacion,
          c.status,
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
      return res.status(500).json({ message: t(req, "getYourCommentsError") });
    }
  },

  getComentariosPorEvento: async (req, res) => {
    const fiestaId = Number(req.params.id);

    if (!Number.isInteger(fiestaId) || fiestaId <= 0) {
      return res.status(400).json({ message: t(req, "invalidId") });
    }

    try {
      const [comentarios] = await db.query(
        `
        SELECT
          c.id,
          c.fiesta_id,
          c.autor_uid,
          c.estrellas,
          c.texto,
          c.created_at AS fecha_creacion,
          c.status,
          f.titulo AS titulo_fiesta,
          u.username AS autor_nombre,
          u.profile_picture AS autor_avatar
        FROM comentarios c
        JOIN fiestas f ON c.fiesta_id = f.id
        LEFT JOIN users u ON u.firebase_uid = c.autor_uid
        WHERE c.fiesta_id = ?
          AND c.status IN ('visible','reported','hidden')
        ORDER BY c.created_at DESC
        `,
        [fiestaId]
      );

      return res.json(comentarios);
    } catch (error) {
      console.error("Error en getComentariosPorEvento:", error);
      return res.status(500).json({ message: t(req, "getEventCommentsError") });
    }
  },

  getComentariosTop: async (req, res) => {
    try {
      const [comentarios] = await db.query(
        `
        SELECT
          c.id,
          c.fiesta_id,
          c.autor_uid,
          c.estrellas,
          c.texto,
          c.created_at AS fecha_creacion,
          c.status,
          f.titulo AS titulo_fiesta,
          u.username AS autor_nombre,
          u.profile_picture AS autor_avatar
        FROM comentarios c
        JOIN fiestas f ON c.fiesta_id = f.id
        LEFT JOIN users u ON u.firebase_uid = c.autor_uid
        WHERE c.status = 'visible'
        ORDER BY c.estrellas DESC, c.created_at DESC
        LIMIT 10
        `
      );

      return res.json(comentarios);
    } catch (error) {
      console.error("Error en getComentariosTop:", error);
      return res.status(500).json({ message: t(req, "getTopCommentsError") });
    }
  },
};