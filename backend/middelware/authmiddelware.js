const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'Qca200@';

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token requerido' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; 
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Token inválido' });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Acceso solo para administradores' });
  }
  next();
};

// Añadimos alias para que "authMiddleware" apunte a verifyToken
module.exports = {
  verifyToken,
  requireAdmin,
  authMiddleware: verifyToken
};
