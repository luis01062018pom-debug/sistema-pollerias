/**
 * Puente para el panel de socios del sistema de tiendas.
 *
 * Los dos sistemas (tiendas y pollerías) tienen su propia base de datos y su
 * propio servidor, pero el negocio es uno solo. En vez de duplicar el panel,
 * el panel de fundadores del sistema de tiendas consulta estas rutas y
 * muestra a las pollerías junto a las tiendas: mismos clientes, misma renta,
 * misma bandeja de comprobantes.
 *
 * No usa sesión de usuario: se autentica con un token secreto compartido
 * (SOCIOS_TOKEN) que solo conocen los dos servidores. Si la variable no está
 * puesta, estas rutas simplemente no existen.
 */
const express = require('express');
const { one, rows } = require('../db');
const { estadoSuscripcion } = require('../suscripcion');
const { confirmarPago, cobroManual, rechazarPago } = require('../pagos');

const router = express.Router();

router.use((req, res, next) => {
  const esperado = process.env.SOCIOS_TOKEN;
  if (!esperado) return res.status(404).json({ error: 'No disponible' });
  const dado = req.get('x-socios-token') || '';
  // Comparación de longitud fija para no filtrar el token por el tiempo de respuesta.
  if (dado.length !== esperado.length
      || !require('crypto').timingSafeEqual(Buffer.from(dado), Buffer.from(esperado))) {
    return res.status(401).json({ error: 'Token inválido' });
  }
  next();
});

function fallo(res, e, mensaje) {
  if (e && e.status) return res.status(e.status).json({ error: e.message });
  console.error(e);
  return res.status(500).json({ error: mensaje });
}

/** Todo lo que el panel de socios necesita pintar, en una sola llamada. */
router.get('/resumen', async (req, res) => {
  try {
    const negocios = await rows(
      `SELECT n.id, n.codigo, n.nombre, n.activo, n.estado, n.fecha_corte, n.dias_gracia,
              n.precio_mensual::float8 AS precio_mensual, n.contacto_nombre, n.whatsapp_contacto,
              (SELECT COUNT(*)::int FROM usuarios u WHERE u.negocio_id = n.id) AS usuarios,
              (SELECT COUNT(*)::int FROM ventas v WHERE v.negocio_id = n.id
                 AND v.fecha >= date_trunc('month', now())) AS ventas_mes,
              (SELECT COALESCE(SUM(v.total),0)::float8 FROM ventas v WHERE v.negocio_id = n.id
                 AND v.fecha >= date_trunc('month', now())) AS vendido_mes,
              (SELECT MAX(v.fecha) FROM ventas v WHERE v.negocio_id = n.id) AS ultima_venta
         FROM negocios n ORDER BY n.nombre`);
    for (const n of negocios) n.situacion = estadoSuscripcion(n);

    const pagos = await rows(
      `SELECT p.id, p.negocio_id, p.monto::float8 AS monto, p.metodo, p.referencia, p.estado,
              p.creado_en, p.validado_en, p.periodo_fin, p.motivo_rechazo,
              (p.comprobante_bytes IS NOT NULL) AS tiene_comprobante,
              n.nombre AS negocio
         FROM pagos_suscripcion p JOIN negocios n ON n.id = p.negocio_id
        ORDER BY (p.estado = 'PENDIENTE') DESC, p.creado_en DESC LIMIT 100`);

    const mes = await one(
      `SELECT COALESCE(SUM(CASE WHEN tipo='INGRESO' THEN monto ELSE 0 END),0)::float8 AS ingresos
         FROM contabilidad_saas WHERE fecha >= date_trunc('month', CURRENT_DATE)`);
    const mrr = await one(
      `SELECT COALESCE(SUM(precio_mensual),0)::float8 AS monto, COUNT(*)::int AS cobrando
         FROM negocios WHERE estado <> 'CANCELADA' AND precio_mensual > 0`);

    res.json({
      sistema: 'pollerias',
      negocios,
      pagos,
      pendientes: pagos.filter((p) => p.estado === 'PENDIENTE').length,
      mrr: mrr.monto,
      negocios_cobrando: mrr.cobrando,
      ingresos_mes: mes.ingresos,
    });
  } catch (e) { fallo(res, e, 'Error al armar el resumen'); }
});

router.get('/pagos/:id/comprobante', async (req, res) => {
  try {
    const p = await one(
      'SELECT comprobante_bytes, comprobante_mime FROM pagos_suscripcion WHERE id = $1',
      [req.params.id]);
    if (!p || !p.comprobante_bytes) return res.status(404).json({ error: 'Ese pago no tiene comprobante' });
    res.set('Content-Type', p.comprobante_mime || 'image/jpeg');
    res.set('Cache-Control', 'private, no-store');
    res.send(Buffer.from(p.comprobante_bytes));
  } catch (e) { fallo(res, e, 'Error al leer el comprobante'); }
});

router.post('/pagos/:id/aprobar', async (req, res) => {
  try {
    // validado_por queda en NULL a propósito: quien aprobó fue un socio desde
    // el otro sistema, y su id de usuario no existe en esta base.
    const r = await confirmarPago(req.params.id, { validadoPor: null, meses: req.body.meses });
    res.json({ ok: true, ...r });
  } catch (e) { fallo(res, e, 'Error al aprobar el pago'); }
});

router.post('/pagos/:id/rechazar', async (req, res) => {
  try {
    await rechazarPago(req.params.id, { validadoPor: null, motivo: req.body.motivo });
    res.json({ ok: true });
  } catch (e) { fallo(res, e, 'Error al rechazar el pago'); }
});

router.post('/pagos/manual', async (req, res) => {
  try {
    const r = await cobroManual({
      negocio_id: req.body.negocio_id,
      monto: req.body.monto,
      metodo: req.body.metodo,
      referencia: req.body.referencia,
      meses: req.body.meses,
      usuarioId: null,
    });
    res.json({ ok: true, ...r });
  } catch (e) { fallo(res, e, 'Error al registrar el cobro'); }
});

module.exports = router;
