const db = require('../models/db');

// Helper: asegura que exista el usuario en MySQL (para que no rompa la FK)
async function ensureMysqlUser(uid) {
  // OJO: esto asume que users.firebase_uid es PK o UNIQUE (normal)
  // y que username puede ser NULL (cache mínima).
  await db.query(
    `INSERT INTO users (firebase_uid, role)
     VALUES (?, 'user')
     ON DUPLICATE KEY UPDATE firebase_uid = firebase_uid`,
    [uid]
  );
}

// POST /api/soporte/crear (auth)
exports.crearMensaje = async (req, res) => {
  const { asunto, mensaje } = req.body;
  const userUid = req.user?.id; // uid firebase

  if (!userUid) {
    return res.status(401).json({ status: 'error', message: 'No autorizado' });
  }
  if (!asunto || !mensaje) {
    return res.status(400).json({ status: 'error', message: 'Faltan campos' });
  }

  try {
    // ✅ 1) Asegura que el user exista en users (evita error FK)
    await ensureMysqlUser(userUid);

    // ✅ 2) Inserta soporte
    const [result] = await db.query(
      `INSERT INTO soporte_mensajes (user_uid, asunto, mensaje, status)
       VALUES (?, ?, ?, 'open')`,
      [userUid, asunto, mensaje]
    );

    res.status(201).json({ status: 'ok', id: result.insertId });
  } catch (err) {
    console.error('❌ Error en crearMensaje:', err);
    res.status(500).json({ status: 'error', message: 'Error al guardar el mensaje.' });
  }
};

// GET /api/soporte/lista (admin)
exports.listarMensajes = async (req, res) => {
  try {
    // ✅ tu tabla usa created_at (según capturas)
    const [rows] = await db.query('SELECT * FROM soporte_mensajes ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    console.error('❌ Error al listar mensajes:', err);
    res.status(500).json({ status: 'error', message: 'Error al obtener mensajes.' });
  }
};

// POST /api/soporte/responder (admin)
exports.responderMensaje = async (req, res) => {
  const { id, respuesta } = req.body;
  const adminUid = req.user?.id;

  if (!adminUid) return res.status(401).json({ status: 'error', message: 'No autorizado' });
  if (!id || !respuesta) return res.status(400).json({ status: 'error', message: 'Datos inválidos' });

  try {
    // ✅ asegura admin en users también (si tienes FK answered_by_uid)
    await ensureMysqlUser(adminUid);

    const [resultado] = await db.query(
      `UPDATE soporte_mensajes
       SET respuesta = ?, status = 'answered', answered_by_uid = ?, answered_at = CURRENT_TIMESTAMP
       WHERE id = ? AND (respuesta IS NULL OR respuesta = '')`,
      [respuesta, adminUid, id]
    );

    if (resultado.affectedRows === 0) {
      return res.status(400).json({ status: 'error', message: 'Ya fue respondido o no existe.' });
    }

    res.json({ status: 'ok' });
  } catch (err) {
    console.error('❌ Error al responder mensaje:', err);
    res.status(500).json({ status: 'error', message: 'Error al responder el mensaje.' });
  }
};
