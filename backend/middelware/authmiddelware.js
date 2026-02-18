const admin = require('../models/firebaseAdmin');

// Verifica Bearer token de Firebase y deja el payload en req.user (para no cambiar mucho tu código)
const verifyToken = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const [type, token] = header.split(' ');

    if (type !== 'Bearer' || !token) {
      return res.status(401).json({ message: 'Token Bearer requerido' });
    }

    const decoded = await admin.auth().verifyIdToken(token);

    // Para mantener compatibilidad con tu proyecto:
    // - antes: req.user.id venía del JWT
    // - ahora: id = uid de Firebase
    req.user = {
      id: decoded.uid,
      uid: decoded.uid,
      email: decoded.email || null,
      admin: decoded.admin === true,
      claims: decoded,
    };

    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token inválido o expirado' });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user?.admin === true) return next();
  return res.status(403).json({ message: 'Acceso solo para administradores' });
};

// Alias para compatibilidad con tus imports actuales
module.exports = {
  verifyToken,
  requireAdmin,
  authMiddleware: verifyToken,
};
