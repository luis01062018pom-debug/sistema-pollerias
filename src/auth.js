const jwt = require('jsonwebtoken');

// El secreto de relleno sirve para trabajar en la computadora, pero en el
// servidor es una puerta abierta: cualquiera que lea el código puede
// fabricarse un pase de superadministrador. Si falta la variable en
// producción, el sistema NO arranca — vale más un despliegue que falla y se
// nota que uno que queda abierto y no se nota.
const EN_PRODUCCION = !!(process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT);
if (EN_PRODUCCION && !process.env.JWT_SECRET) {
  console.error('\n✖ Falta la variable JWT_SECRET en el servidor.');
  console.error('  Sin ella, las sesiones se firmarían con el secreto de ejemplo del código');
  console.error('  y cualquiera podría entrar como superadministrador.');
  console.error('  Ponla en Railway (una cadena larga y al azar) y vuelve a desplegar.\n');
  process.exit(1);
}
const SECRET = process.env.JWT_SECRET || 'dev-secret-cambiar-en-produccion';

function firmar(usuario) {
  // Un mes de sesión está bien para la caja de una pollería (que no quiere
  // volver a escribir la contraseña cada mañana), pero NO para la cuenta que
  // manda sobre todos los clientes: esa dura una jornada. Si a alguien se le
  // queda abierta la sesión del panel en un teléfono, caduca el mismo día.
  const duracion = usuario.rol === 'superadmin' ? '12h' : '30d';
  return jwt.sign(
    { uid: usuario.id, negocio_id: usuario.negocio_id, rol: usuario.rol, nombre: usuario.nombre },
    SECRET,
    { expiresIn: duracion }
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
