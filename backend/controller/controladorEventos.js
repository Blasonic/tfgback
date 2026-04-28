const db = require("../models/db");

function safeTags(v) {
  return Array.isArray(v) ? v : [];
}

function getLang(req) {
  return req.headers["accept-language"]?.startsWith("en") ? "en" : "es";
}

const messages = {
  es: {
    loadEventsError: "Error cargando eventos",
    unauthorized: "No autorizado",
    missingRequired:
      "Faltan datos obligatorios (titulo, descripcion, start_at, end_at, categoria)",
    requestSent: "Solicitud enviada",
    registerEventError: "Error al registrar el evento",
    pendingEventsError: "Error al obtener eventos pendientes",
    eventNotFound: "Evento no encontrado",
    eventAccepted: "Evento aceptado",
    acceptEventError: "Error al aceptar evento",
    eventDeleted: "Evento eliminado",
    deleteEventError: "Error al eliminar evento",
  },
  en: {
    loadEventsError: "Error loading events",
    unauthorized: "Unauthorized",
    missingRequired:
      "Required data is missing (titulo, descripcion, start_at, end_at, categoria)",
    requestSent: "Request sent",
    registerEventError: "Error registering the event",
    pendingEventsError: "Error retrieving pending events",
    eventNotFound: "Event not found",
    eventAccepted: "Event accepted",
    acceptEventError: "Error accepting event",
    eventDeleted: "Event deleted",
    deleteEventError: "Error deleting event",
  },
};

function t(req, key) {
  const lang = getLang(req);
  return messages[lang][key] || messages.es[key] || key;
}

exports.listAcceptedEvents = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT *
       FROM fiestas
       WHERE estado = 'published'
         AND is_deleted = 0
       ORDER BY start_at ASC`
    );

    res.json(rows);
  } catch (error) {
    console.error("Error en listAcceptedEvents:", error);
    res.status(500).json({ message: t(req, "loadEventsError") });
  }
};

exports.requestEvent = async (req, res) => {
  const {
    titulo,
    descripcion,
    start_at,
    end_at,
    categoria,
    categoria_detalle,
    tags,
    imagen,
    provincia,
    municipio,
    direccion,
    lat,
    lng,
  } = req.body;

  const creado_por_uid = req.user?.id;

  if (!creado_por_uid) {
    return res.status(401).json({ message: t(req, "unauthorized") });
  }

  if (!titulo || !descripcion || !start_at || !end_at || !categoria) {
    return res.status(400).json({
      message: t(req, "missingRequired"),
    });
  }

  try {
    await db.query(
      `INSERT INTO fiestas
        (titulo, descripcion, start_at, end_at, tipo,
         categoria, categoria_detalle, tags_json,
         estado, creado_por_uid, imagen, provincia, municipio, direccion, lat, lng,
         is_deleted)
       VALUES
        (?, ?, ?, ?, ?,
         ?, ?, ?,
         'draft', ?, ?, ?, ?, ?, ?, ?,
         0)`,
      [
        titulo.trim(),
        descripcion.trim(),
        start_at,
        end_at,
        categoria,
        categoria,
        categoria_detalle?.trim() || null,
        JSON.stringify(safeTags(tags)),
        creado_por_uid,
        imagen?.trim() || null,
        (provincia || "Madrid").trim(),
        municipio?.trim() || null,
        direccion?.trim() || null,
        typeof lat === "number" ? lat : null,
        typeof lng === "number" ? lng : null,
      ]
    );

    res.status(201).json({ message: t(req, "requestSent") });
  } catch (error) {
    console.error("Error en requestEvent:", error);
    res.status(500).json({ message: t(req, "registerEventError") });
  }
};

exports.getPendingEvents = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT *
       FROM fiestas
       WHERE estado = 'draft'
         AND is_deleted = 0
       ORDER BY created_at DESC`
    );

    res.json(rows);
  } catch (error) {
    console.error("Error en getPendingEvents:", error);
    res.status(500).json({ message: t(req, "pendingEventsError") });
  }
};

exports.acceptEvent = async (req, res) => {
  try {
    const [r] = await db.query(
      `UPDATE fiestas
       SET estado = 'published'
       WHERE id = ?
         AND is_deleted = 0`,
      [req.params.id]
    );

    if (r.affectedRows === 0) {
      return res.status(404).json({ message: t(req, "eventNotFound") });
    }

    res.json({ message: t(req, "eventAccepted") });
  } catch (error) {
    console.error("Error en acceptEvent:", error);
    res.status(500).json({ message: t(req, "acceptEventError") });
  }
};

exports.rejectEvent = async (req, res) => {
  try {
    const adminUid = req.user?.id || null;

    const [r] = await db.query(
      `UPDATE fiestas
       SET is_deleted = 1,
           deleted_at = NOW(),
           deleted_by_uid = ?
       WHERE id = ?
         AND is_deleted = 0`,
      [adminUid, req.params.id]
    );

    if (r.affectedRows === 0) {
      return res.status(404).json({ message: t(req, "eventNotFound") });
    }

    res.json({ message: t(req, "eventDeleted") });
  } catch (error) {
    console.error("Error en rejectEvent:", error);
    res.status(500).json({ message: t(req, "deleteEventError") });
  }
};