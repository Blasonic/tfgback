const db = require("../models/db");

function safeTags(v) {
  return Array.isArray(v) ? v : [];
}

/**
 * GET /api/fiestas/aceptadas (pública)
 * published + no borradas
 */
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
    res.status(500).json({ message: "Error cargando eventos" });
  }
};

/**
 * POST /api/fiestas/solicitar (auth)
 * Insertamos como "draft" (pendiente de revisión)
 */
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
    return res.status(401).json({ message: "No autorizado" });
  }

  if (!titulo || !descripcion || !start_at || !end_at || !categoria) {
    return res.status(400).json({
      message: "Faltan datos obligatorios (titulo, descripcion, start_at, end_at, categoria)",
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

        // compat: puedes seguir usando tipo en UI si quieres
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

    res.status(201).json({ message: "Solicitud enviada" });
  } catch (error) {
    console.error("Error en requestEvent:", error);
    res.status(500).json({ message: "Error al registrar el evento" });
  }
};

/**
 * GET /api/fiestas/pendientes (admin)
 * draft + no borradas
 */
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
    res.status(500).json({ message: "Error al obtener eventos pendientes" });
  }
};

/**
 * PUT /api/fiestas/aceptar/:id (admin)
 * draft -> published
 */
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
      return res.status(404).json({ message: "Evento no encontrado" });
    }

    res.json({ message: "Evento aceptado" });
  } catch (error) {
    console.error("Error en acceptEvent:", error);
    res.status(500).json({ message: "Error al aceptar evento" });
  }
};

/**
 * DELETE /api/fiestas/:id (admin)
 * soft delete usando columnas que ya tienes
 */
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
      return res.status(404).json({ message: "Evento no encontrado" });
    }

    res.json({ message: "Evento eliminado" });
  } catch (error) {
    console.error("Error en rejectEvent:", error);
    res.status(500).json({ message: "Error al eliminar evento" });
  }
};
