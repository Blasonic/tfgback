// controller/controladorComentarios.js
const db = require("../models/db");
const admin = require("../models/firebaseAdmin");

// UID helper (compatible con tu middleware actual)
function getUid(req) {
  return req?.auth?.uid || req?.user?.uid || req?.user?.id || null;
}

// Crea el user en MySQL si no existe (para cumplir FK comentarios.autor_uid -> users.firebase_uid)
async function ensureMysqlUser(firebaseUid) {
  // 1) ¿Ya existe?
  const [rows] = await db.query(
    "SELECT firebase_uid FROM users WHERE firebase_uid = ? LIMIT 1",
    [firebaseUid]
  );
  if (rows.length > 0) return;

  // 2) Si no existe, lo traemos de Firebase Auth (displayName/photoURL si están)
  let username = null;
  let profilePicture = null;

  try {
    const u = await admin.auth().getUser(firebaseUid);
    username = u.displayName || null;
    profilePicture = u.photoURL || null;
  } catch (e) {
    // Si por lo que sea no se puede leer (raro), al menos insertamos el UID
    username = null;
    profilePicture = null;
  }

  // 3) Insert (role tiene default 'user' en tu tabla)
  await db.query(
    `
    INSERT INTO users (firebase_uid, username, profile_picture)
    VALUES (?, ?, ?)
    `,
    [firebaseUid, username, profilePicture]
  );
}

module.exports = {
  // POST /api/comentarios  (auth)
  // UPSERT: 1 comentario por user por fiesta (UNIQUE(fiesta_id, autor_uid))
  crearComentario: async (req, res) => {
    const { fiesta_id, estrellas, texto } = req.body;

    const autor_uid = getUid(req);
    const fiestaId = Number(fiesta_id);
    const estrellasNum = Number(estrellas);

    if (!autor_uid) return res.status(401).json({ message: "No autorizado" });

    if (!Number.isInteger(fiestaId) || fiestaId <= 0) {
      return res.status(400).json({ message: "fiesta_id inválido" });
    }

    if (!Number.isInteger(estrellasNum) || estrellasNum < 1 || estrellasNum > 5) {
      return res.status(400).json({ message: "estrellas debe ser 1-5" });
    }

    // texto opcional, pero si quieres obligarlo:
    // if (typeof texto !== "string" || texto.trim().length === 0) {
    //   return res.status(400).json({ message: "texto obligatorio" });
    // }

    try {
      // Verificar que la fiesta existe
      const [[fiesta]] = await db.query("SELECT id FROM fiestas WHERE id = ?", [fiestaId]);
      if (!fiesta) return res.status(404).json({ message: "Fiesta no encontrada" });

      // ✅ CLAVE: asegurar que existe user en MySQL para que la FK no falle
      await ensureMysqlUser(autor_uid);

      // Insert/Update comentario (1 por user por fiesta)
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

      return res.status(201).json({ message: "Comentario guardado" });
    } catch (error) {
      console.error("Error en crearComentario:", error);

      // Si volviera a pasar una FK por desajuste de datos, que no sea 500 “misterioso”
      if (error.code === "ER_NO_REFERENCED_ROW_2") {
        return res.status(409).json({ message: "Usuario no existe/sincronizado en MySQL" });
      }

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
      return res.status(500).json({ message: "Error al obtener comentarios del evento" });
    }
  },

  // GET /api/comentarios/top (pública)
  getComentariosTop: async (_req, res) => {
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
      return res.status(500).json({ message: "Error al obtener comentarios destacados" });
    }
  },
};