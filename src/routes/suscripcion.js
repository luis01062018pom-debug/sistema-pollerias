/**
 * Suscripción, del lado de la pollería.
 *
 * IMPORTANTE: estas rutas NO llevan el bloqueo por falta de pago. Son justo
 * las que tiene que poder usar un negocio suspendido para volver a activarse.
 * Si se bloquearan, el cliente que quiere pagar no tendría por dónde hacerlo.
 */
const express = require('express');
const { query, one, rows } = require('../db');
const { requiereAuth, requiereRol } = require('../auth');
const { estadoSuscripcion, mensajeSuscripcion } = require('../suscripcion');
const { seguro } = require('../asincrono');

const router = seguro(express.Router());
router.use(requiereAuth);

const MAX_BYTES = 1_500_000;   // 1.5 MB: una foto de comprobante comprimida sobra

/** GET /api/suscripcion — cómo va mi cuenta y mi historial de pagos. */
router.get('/', async (req, res) => {
  try {
    if (!req.user.negocio_id) return res.status(403).json({ error: 'Ruta solo para usuarios de un negocio' });
    const n = await one(
      `SELECT id, nombre, estado, fecha_corte, dias_gracia,
              precio_mensual::float8 AS precio_mensual, activo
         FROM negocios WHERE id = $1`, [req.user.negocio_id]);
    if (!n) return res.status(404).json({ error: 'Negocio no encontrado' });

    const situacion = estadoSuscripcion(n);
    const pagos = await rows(
      `SELECT id, monto::float8 AS monto, metodo, referencia, estado, creado_en,
              validado_en, motivo_rechazo, periodo_fin
         FROM pagos_suscripcion WHERE negocio_id = $1
        ORDER BY creado_en DESC LIMIT 24`, [req.user.negocio_id]);

    res.json({
      negocio: n.nombre,
      precio_mensual: Number(n.precio_mensual),
      fecha_corte: n.fecha_corte,
      ...situacion,
      aviso: mensajeSuscripcion(situacion),
      pagos,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

/**
 * POST /api/suscripcion/comprobante
 * El dueño sube la foto de su transferencia o su ficha de depósito.
 * La imagen se guarda en la base de datos, no como archivo: el disco del
 * servidor es efímero y se borraría en el siguiente despliegue.
 */
router.post('/comprobante', requiereRol('dueno'), async (req, res) => {
  try {
    const monto = Number(req.body.monto);
    if (!(monto > 0)) return res.status(400).json({ error: 'Escribe cuánto pagaste' });

    let bytes = null, mime = null;
    if (req.body.imagen) {
      const m = String(req.body.imagen).match(/^data:(image\/(png|jpe?g|webp));base64,(.+)$/);
      if (!m) return res.status(400).json({ error: 'La imagen debe ser una foto (JPG, PNG o WEBP)' });
      bytes = Buffer.from(m[3], 'base64');
      mime = m[1];
      if (bytes.length > MAX_BYTES) {
        return res.status(400).json({ error: 'La foto pesa demasiado. Tómala de nuevo con menos calidad.' });
      }
    }

    const metodo = ['transferencia', 'deposito', 'efectivo'].includes(req.body.metodo)
      ? req.body.metodo : 'transferencia';

    const pago = await one(
      `INSERT INTO pagos_suscripcion
         (negocio_id, monto, metodo, referencia, comprobante_bytes, comprobante_mime, estado, subido_por)
       VALUES ($1,$2,$3,$4,$5,$6,'PENDIENTE',$7)
       RETURNING id, monto::float8 AS monto, estado, creado_en`,
      [req.user.negocio_id, monto, metodo, req.body.referencia || null, bytes, mime, req.user.uid]);

    res.json({
      ok: true,
      pago,
      mensaje: 'Recibimos tu comprobante. En cuanto lo revisemos se activa tu mes.',
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al guardar el comprobante' });
  }
});

module.exports = router;
