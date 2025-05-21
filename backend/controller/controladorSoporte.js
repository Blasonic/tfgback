const db = require("../models/db");
const { getUserById } = require("./controladorMongo");

// Crear mensaje de soporte usando el userId del token y correo desde Mongo
exports.crearMensaje = async (req, res) => {
  const { asunto, mensaje } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ status: "error", message: "No autorizado" });
  }

  try {
    console.log("🔑 ID del usuario extraído del token:", userId);

    const userData = await getUserById(userId);
    console.log("📦 Datos del usuario desde Mongo:", userData);

    if (!userData || !userData.email) {
      return res.status(404).json({ status: "error", message: "Correo del usuario no encontrado" });
    }

    const correo = userData.email;

    console.log("✉️ Preparando para insertar mensaje en la base de datos:");
    console.log("📧 Correo:", correo);
    console.log("📨 Asunto:", asunto);
    console.log("📝 Mensaje:", mensaje);

    const [result] = await db.query(
      "INSERT INTO soporte_mensajes (correo, asunto, mensaje) VALUES (?, ?, ?)",
      [correo, asunto, mensaje]
    );

    console.log("✅ Mensaje insertado correctamente. ID:", result.insertId);
    res.json({ status: "ok", id: result.insertId });
  } catch (err) {
    console.error("❌ Error en crearMensaje:", err);
    res.status(500).json({ status: "error", message: "Error al guardar el mensaje." });
  }
};

// Obtener todos los mensajes
exports.listarMensajes = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM soporte_mensajes ORDER BY creado_en DESC");
    res.json(rows);
  } catch (err) {
    console.error("❌ Error al listar mensajes:", err);
    res.status(500).json({ status: "error", message: "Error al obtener mensajes." });
  }
};

// Responder a un mensaje
exports.responderMensaje = async (req, res) => {
  const { id, respuesta } = req.body;
  try {
    const [resultado] = await db.query(
      "UPDATE soporte_mensajes SET respuesta = ? WHERE id = ? AND respuesta IS NULL",
      [respuesta, id]
    );

    if (resultado.affectedRows === 0) {
      return res.status(400).json({ status: "error", message: "Ya fue respondido o no existe." });
    }

    console.log(`📬 Respuesta registrada para mensaje ID ${id}`);
    res.json({ status: "ok" });
  } catch (err) {
    console.error("❌ Error al responder mensaje:", err);
    res.status(500).json({ status: "error", message: "Error al responder el mensaje." });
  }
};
