const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'dev-secret-cambiar-en-produccion';

function firmar(usuario) {
  return jwt.sign(
    { uid: usuario.id, negocio_id: usuario.negocio_id, rol: usuario.rol, nombre: usuario.nombre },
    SECRET,
    { expiresIn: '30d' }
  );
}

function requiereAuth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Sesión requerida' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Sesión inválida o expirada' });
  }
}

function requiereRol(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.rol)) return res.status(403).json({ error: 'Sin permiso' });
    next();
  };
}

module.exports = { firmar, requiereAuth, requiereRol };
