const db = require("../models/db");

const listarAyuntamientos = async (_req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT *
      FROM ayuntamientos
      WHERE descripcion IS NOT NULL
        AND TRIM(descripcion) <> ''
      ORDER BY municipio ASC
    `);

    res.json(rows);
  } catch (error) {
    console.error("Error listando ayuntamientos:", error);
    res.status(500).json({ message: "Error al obtener ayuntamientos" });
  }
};

const obtenerAyuntamiento = async (req, res) => {
  try {
    const [rows] = await db.query(
      `
      SELECT *
      FROM ayuntamientos
      WHERE id = ?
      LIMIT 1
      `,
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Ayuntamiento no encontrado" });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Error obteniendo ayuntamiento:", error);
    res.status(500).json({ message: "Error al obtener ayuntamiento" });
  }
};

const listarPlanesPorMunicipio = async (req, res) => {
  try {
    const municipio = req.params.municipio;

    const [rows] = await db.query(
      `
      SELECT 
        id,
        titulo,
        descripcion,
        municipio,
        provincia,
        categoria,
        categoria_detalle,
        start_at,
        end_at,
        imagen
      FROM fiestas
      WHERE municipio = ?
      ORDER BY start_at ASC
      `,
      [municipio]
    );

    res.json(rows);
  } catch (error) {
    console.error("Error obteniendo planes del municipio:", error);
    res.status(500).json({ message: "Error al obtener planes del municipio" });
  }
};

module.exports = {
  listarAyuntamientos,
  obtenerAyuntamiento,
  listarPlanesPorMunicipio,
};