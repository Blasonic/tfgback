const db = require("../models/db");

/**
 * GET /api/fiestas/buscar
 * Búsqueda pública de fiestas publicadas y no borradas
 */
exports.searchAcceptedEvents = async (req, res) => {
  try {
    const limitRaw = Number(req.query.limit) || 12;
    const page = Number(req.query.page) > 0 ? Number(req.query.page) : 1;
    const limit = Math.min(Math.max(limitRaw, 1), 50);

    const {
      q = "",
      categoria = "",
      categoria_detalle = "",
      fechaDesde = "",
      fechaHasta = "",
      sort = "start_at_asc",
    } = req.query;

    const soloFuturos = req.query.soloFuturos === "true";

    const where = [];
    const params = [];

    where.push(`estado = 'published'`);
    where.push(`is_deleted = 0`);

    if (q.trim()) {
      where.push(`
        (
          titulo LIKE ?
          OR descripcion LIKE ?
          OR municipio LIKE ?
          OR direccion LIKE ?
        )
      `);

      const like = `%${q.trim()}%`;
      params.push(like, like, like, like);
    }

    if (categoria.trim()) {
      where.push(`categoria = ?`);
      params.push(categoria.trim());
    }

    if (categoria_detalle.trim()) {
      where.push(`categoria_detalle = ?`);
      params.push(categoria_detalle.trim());
    }

    if (fechaDesde) {
      where.push(`start_at >= ?`);
      params.push(`${fechaDesde} 00:00:00`);
    }

    if (fechaHasta) {
      where.push(`start_at <= ?`);
      params.push(`${fechaHasta} 23:59:59`);
    }

    if (soloFuturos) {
      where.push(`start_at >= NOW()`);
    }

    let orderBy = `ORDER BY start_at ASC`;

    switch (sort) {
      case "start_at_desc":
        orderBy = `ORDER BY start_at DESC`;
        break;
      case "created_at_desc":
        orderBy = `ORDER BY created_at DESC`;
        break;
      case "created_at_asc":
        orderBy = `ORDER BY created_at ASC`;
        break;
      case "titulo_asc":
        orderBy = `ORDER BY titulo ASC`;
        break;
      case "titulo_desc":
        orderBy = `ORDER BY titulo DESC`;
        break;
      default:
        orderBy = `ORDER BY start_at ASC`;
        break;
    }

    const whereSql = `WHERE ${where.join(" AND ")}`;
    const offset = (page - 1) * limit;

    const sql = `
      SELECT
        id,
        titulo,
        descripcion,
        start_at,
        end_at,
        tipo,
        categoria,
        categoria_detalle,
        tags_json,
        estado,
        imagen,
        provincia,
        municipio,
        direccion,
        lat,
        lng,
        created_at,
        updated_at
      FROM fiestas
      ${whereSql}
      ${orderBy}
      LIMIT ? OFFSET ?
    `;

    const sqlCount = `
      SELECT COUNT(*) AS total
      FROM fiestas
      ${whereSql}
    `;

    const [rows] = await db.query(sql, [...params, limit, offset]);
    const [countRows] = await db.query(sqlCount, params);

    const total = countRows[0]?.total || 0;

    return res.status(200).json({
      ok: true,
      eventos: rows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error en searchAcceptedEvents:", error);
    return res.status(500).json({
      ok: false,
      message: "Error al buscar fiestas",
    });
  }
};

/**
 * GET /api/fiestas/filtros
 * Valores disponibles para filtros públicos
 */
exports.getSearchFilters = async (_req, res) => {
  try {
    const [categorias] = await db.query(`
      SELECT DISTINCT categoria
      FROM fiestas
      WHERE estado = 'published'
        AND is_deleted = 0
        AND categoria IS NOT NULL
        AND categoria <> ''
      ORDER BY categoria ASC
    `);

    const [categoriasDetalle] = await db.query(`
      SELECT DISTINCT categoria_detalle
      FROM fiestas
      WHERE estado = 'published'
        AND is_deleted = 0
        AND categoria_detalle IS NOT NULL
        AND categoria_detalle <> ''
      ORDER BY categoria_detalle ASC
    `);

    const [municipios] = await db.query(`
      SELECT DISTINCT municipio
      FROM fiestas
      WHERE estado = 'published'
        AND is_deleted = 0
        AND municipio IS NOT NULL
        AND municipio <> ''
      ORDER BY municipio ASC
    `);

    return res.status(200).json({
      ok: true,
      filtros: {
        categorias: categorias.map((x) => x.categoria),
        categoriasDetalle: categoriasDetalle.map((x) => x.categoria_detalle),
        municipios: municipios.map((x) => x.municipio),
      },
    });
  } catch (error) {
    console.error("Error en getSearchFilters:", error);
    return res.status(500).json({
      ok: false,
      message: "Error al obtener filtros",
    });
  }
};

/**
 * GET /api/fiestas/detalle/:id
 * Detalle público de una fiesta
 */
exports.getAcceptedEventById = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.query(
      `
      SELECT
        id,
        titulo,
        descripcion,
        start_at,
        end_at,
        tipo,
        categoria,
        categoria_detalle,
        tags_json,
        estado,
        imagen,
        provincia,
        municipio,
        direccion,
        lat,
        lng,
        created_at,
        updated_at
      FROM fiestas
      WHERE id = ?
        AND estado = 'published'
        AND is_deleted = 0
      LIMIT 1
      `,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({
        ok: false,
        message: "Fiesta no encontrada",
      });
    }

    return res.status(200).json({
      ok: true,
      evento: rows[0],
    });
  } catch (error) {
    console.error("Error en getAcceptedEventById:", error);
    return res.status(500).json({
      ok: false,
      message: "Error al obtener la fiesta",
    });
  }
};