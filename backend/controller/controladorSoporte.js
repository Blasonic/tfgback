const db = require("../models/db");

function getLang(req) {
  return req.headers["accept-language"]?.startsWith("en") ? "en" : "es";
}

const messages = {
  es: {
    unauthorized: "No autorizado",
    missingFields: "Faltan campos",
    saveError: "Error al guardar el mensaje.",
    listError: "Error al obtener mensajes.",
    invalidData: "Datos inválidos",
    alreadyAnswered: "Ya fue respondido o no existe.",
    answerError: "Error al responder el mensaje.",
  },
  en: {
    unauthorized: "Unauthorized",
    missingFields: "Missing fields",
    saveError: "Error saving the message.",
    listError: "Error retrieving messages.",
    invalidData: "Invalid data",
    alreadyAnswered: "It has already been answered or does not exist.",
    answerError: "Error replying to the message.",
  },
};

function t(req, key) {
  const lang = getLang(req);
  return messages[lang][key] || messages.es[key] || key;
}

async function ensureMysqlUser(uid) {
  await db.query(
    `INSERT INTO users (firebase_uid, role)
     VALUES (?, 'user')
     ON DUPLICATE KEY UPDATE firebase_uid = firebase_uid`,
    [uid]
  );
}

exports.crearMensaje = async (req, res) => {
  const { asunto, mensaje } = req.body;
  const userUid = req.user?.id;

  if (!userUid) {
    return res.status(401).json({
      status: "error",
      message: t(req, "unauthorized"),
    });
  }

  if (!asunto || !mensaje) {
    return res.status(400).json({
      status: "error",
      message: t(req, "missingFields"),
    });
  }

  try {
    await ensureMysqlUser(userUid);

    const [result] = await db.query(
      `INSERT INTO soporte_mensajes (user_uid, asunto, mensaje, status)
       VALUES (?, ?, ?, 'open')`,
      [userUid, asunto, mensaje]
    );

    res.status(201).json({
      status: "ok",
      id: result.insertId,
    });
  } catch (err) {
    console.error("❌ Error en crearMensaje:", err);
    res.status(500).json({
      status: "error",
      message: t(req, "saveError"),
    });
  }
};

exports.listarMensajes = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM soporte_mensajes ORDER BY created_at DESC"
    );
    res.json(rows);
  } catch (err) {
    console.error("❌ Error al listar mensajes:", err);
    res.status(500).json({
      status: "error",
      message: t(req, "listError"),
    });
  }
};

exports.responderMensaje = async (req, res) => {
  const { id, respuesta } = req.body;
  const adminUid = req.user?.id;

  if (!adminUid) {
    return res.status(401).json({
      status: "error",
      message: t(req, "unauthorized"),
    });
  }

  if (!id || !respuesta) {
    return res.status(400).json({
      status: "error",
      message: t(req, "invalidData"),
    });
  }

  try {
    await ensureMysqlUser(adminUid);

    const [resultado] = await db.query(
      `UPDATE soporte_mensajes
       SET respuesta = ?, status = 'answered', answered_by_uid = ?, answered_at = CURRENT_TIMESTAMP
       WHERE id = ? AND (respuesta IS NULL OR respuesta = '')`,
      [respuesta, adminUid, id]
    );

    if (resultado.affectedRows === 0) {
      return res.status(400).json({
        status: "error",
        message: t(req, "alreadyAnswered"),
      });
    }

    res.json({ status: "ok" });
  } catch (err) {
    console.error("❌ Error al responder mensaje:", err);
    res.status(500).json({
      status: "error",
      message: t(req, "answerError"),
    });
  }
};