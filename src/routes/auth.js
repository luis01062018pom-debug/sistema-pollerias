const express = require('express');
const bcrypt = require('bcryptjs');
const { one } = require('../db');
const { firmar, requiereAuth } = require('../auth');
const { estadoSuscripcion, mensajeSuscripcion } = require('../suscripcion');

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { usuario, password } = req.body || {};
    if (!usuario || !password) return res.status(400).json({ error: 'Usuario y contraseña requeridos' });

    const u = await one('SELECT * FROM usuarios WHERE usuario = $1 AND activo = TRUE', [String(usuario).trim().toLowerCase()]);
    if (!u || !bcrypt.compareSync(password, u.hash)) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }
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
        `SELECT id, codigo, nombre, logo, color_primario, color_secundario, ticket_direccion,
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
