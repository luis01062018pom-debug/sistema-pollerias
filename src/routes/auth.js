const express = require('express');
const bcrypt = require('bcryptjs');
const { one, query } = require('../db');
const { firmar, requiereAuth } = require('../auth');
const { estadoSuscripcion, mensajeSuscripcion } = require('../suscripcion');
const { seguro } = require('../asincrono');

const router = seguro(express.Router());

// Toda entrada (y todo intento fallido) a una cuenta de superadministrador
// queda escrita. Nunca debe tumbar el inicio de sesión: si la anotación
// falla, se registra en la consola y la vida sigue.
async function anotarAcceso(req, usuario, exito) {
  try {
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '')
      .split(',')[0].trim().replace(/^::ffff:/, '');
    const dispositivo = String(req.headers['user-agent'] || '').slice(0, 200);
    await query('INSERT INTO accesos_admin (usuario, exito, ip, dispositivo) VALUES ($1,$2,$3,$4)',
      [String(usuario).slice(0, 60), !!exito, ip.slice(0, 60), dispositivo]);
  } catch (e) { console.error('[accesos]', e.message); }
}

router.post('/login', async (req, res) => {
  try {
    const { usuario, password } = req.body || {};
    if (!usuario || !password) return res.status(400).json({ error: 'Usuario y contraseña requeridos' });

    const nombreUsuario = String(usuario).trim().toLowerCase();
    const u = await one('SELECT * FROM usuarios WHERE usuario = $1 AND activo = TRUE', [nombreUsuario]);
    if (!u || !bcrypt.compareSync(password, u.hash)) {
      // Si alguien anda probando contraseñas contra una cuenta de
      // superadministrador, tiene que quedar escrito aunque falle.
      const esAdmin = u ? u.rol === 'superadmin'
        : !!(await one("SELECT 1 FROM usuarios WHERE usuario = $1 AND rol = 'superadmin'", [nombreUsuario]));
      if (esAdmin) await anotarAcceso(req, nombreUsuario, false);
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }
    if (u.rol === 'superadmin') await anotarAcceso(req, u.usuario, true);
    if (u.negocio_id) {
      const neg = await one('SELECT activo FROM negocios WHERE id = $1', [u.negocio_id]);
      if (!neg || !neg.activo) return res.status(403).json({ error: 'Este negocio está suspendido. Contacta a soporte.' });
    }
    res.json({ token: firmar(u), rol: u.rol, nombre: u.nombre });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Datos iniciales de la app: usuario, negocio (branding/flags) y catálogo
router.get('/bootstrap', requiereAuth, async (req, res) => {
  try {
    let negocio = null;
    let piezas = [];
    let suscripcion = null;
    if (req.user.negocio_id) {
      negocio = await one(
        `SELECT id, codigo, nombre, logo, color_primario, color_secundario,
                tema, color_acento, color_fondo, ticket_direccion,
                ticket_telefono, ticket_leyenda, whatsapp, peso_promedio_g,
                costo_kilo::float8 AS costo_kilo, flags, activo,
                estado, fecha_corte, dias_gracia, precio_mensual::float8 AS precio_mensual
         FROM negocios WHERE id = $1`, [req.user.negocio_id]);
      if (!negocio || !negocio.activo) return res.status(403).json({ error: 'Negocio suspendido' });
      negocio.flags = JSON.parse(negocio.flags || '{}');

      // La app necesita saber cómo va la cuenta para avisar (y para mostrar
      // la pantalla de pago en lugar del punto de venta si ya se suspendió).
      const situacion = estadoSuscripcion(negocio);
      suscripcion = {
        ...situacion,
        aviso: mensajeSuscripcion(situacion),
        precio_mensual: Number(negocio.precio_mensual),
        fecha_corte: negocio.fecha_corte,
      };
      const { rows } = require('../db');
      piezas = await rows(
        `SELECT id, nombre, por_pollo::float8 AS por_pollo, rendimiento::float8 AS rendimiento,
                precio_kilo::float8 AS precio_kilo, precio_pieza::float8 AS precio_pieza,
                es_extra, vendible, controla_inventario, orden
         FROM piezas WHERE negocio_id = $1 AND activo = TRUE ORDER BY orden, nombre`,
        [req.user.negocio_id]);
    }
    res.json({ user: { nombre: req.user.nombre, rol: req.user.rol }, negocio, piezas, suscripcion });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
