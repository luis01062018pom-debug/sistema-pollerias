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
const { one, rows, query } = require('../db');
const { estadoSuscripcion, corteEnDias } = require('../suscripcion');
const { crearCatalogo } = require('../seed');
const { confirmarPago, cobroManual, rechazarPago } = require('../pagos');
const bcrypt = require('bcryptjs');
const cred = require('../credenciales');
const { seguro } = require('../asincrono');

const router = seguro(express.Router());

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
              n.precio_mensual::float8 AS precio_mensual, n.contacto_nombre, n.whatsapp_contacto, n.creado_en,
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

/* Alta de un cliente desde el panel de fundadores.
   Crea la pollería con su catálogo base, su usuario dueño y su periodo de
   prueba, y DEVUELVE la contraseña para poder entregársela. Es el mismo
   contrato que usan las jarcerías, para que el panel dé de alta a los tres
   giros con la misma pantalla. */
router.post('/negocios', async (req, res) => {
  try {
    const b = req.body || {};
    const codigo = String(b.codigo || '').trim().toUpperCase();
    const nombre = String(b.nombre || '').trim();
    if (!codigo || !nombre) return res.status(400).json({ error: 'Faltan la clave y el nombre del negocio' });
    if (!/^[A-Z0-9_-]{2,24}$/.test(codigo)) {
      return res.status(400).json({ error: 'La clave solo lleva letras, números, guion y guion bajo (2 a 24)' });
    }
    if (await one('SELECT id FROM negocios WHERE codigo = $1', [codigo])) {
      return res.status(400).json({ error: `Ya existe un negocio con la clave "${codigo}"` });
    }
    // El usuario del dueño sale de la clave del negocio si no mandan uno.
    const usuario = String(b.usuario || codigo).trim().toLowerCase();
    if (await one('SELECT id FROM usuarios WHERE usuario = $1', [usuario])) {
      return res.status(400).json({ error: `El usuario "${usuario}" ya existe` });
    }
    const password = String(b.password || '') || cred.claveLegible(10);
    const dias = Math.min(Math.max(parseInt(b.dias_prueba, 10) || 0, 0), 365);

    const neg = await one(
      `INSERT INTO negocios (codigo, nombre, precio_mensual, estado, fecha_corte, dias_gracia,
                             contacto_nombre, whatsapp_contacto, color_primario, logo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9,'#263949'),$10) RETURNING id`,
      [codigo, nombre, Number(b.precio_mensual) || 0,
       dias > 0 ? 'PRUEBA' : 'ACTIVA', corteEnDias(dias), Number(b.dias_gracia) || 5,
       b.contacto_nombre || null, b.whatsapp_contacto || null,
       b.color || null,
       typeof b.logo === 'string' && /^data:image\/(png|jpeg|webp);base64,/.test(b.logo) ? b.logo : null]);

    await query(
      `INSERT INTO usuarios (negocio_id, nombre, usuario, hash, rol, clave_cifrada)
       VALUES ($1,$2,$3,$4,'dueno',$5)`,
      [neg.id, b.contacto_nombre || 'Dueño', usuario, bcrypt.hashSync(password, 10), cred.cifrar(password)]);
    await crearCatalogo(neg.id, Number(b.peso_promedio_g) || 2500);

    res.json({
      ok: true,
      negocio: { id: neg.id, codigo, nombre },
      usuarios: [{ usuario, rol: 'dueno', password }],
    });
  } catch (e) { fallo(res, e, 'Error al dar de alta el negocio'); }
});

/* Los accesos de un cliente: quién entra a esa pollería y con qué
   contraseña. "Se me perdió la contraseña" es la llamada más común, y desde
   el panel hay que poder volver a dictarla sin cambiarla.
   Solo llega por aquí, servidor a servidor con el token compartido. */
router.get('/negocios/:id/usuarios', async (req, res) => {
  try {
    const lista = await rows(
      `SELECT id, nombre, usuario, rol, activo, clave_cifrada
         FROM usuarios WHERE negocio_id = $1 ORDER BY rol, nombre`, [req.params.id]);
    res.json({
      ok: true,
      usuarios: lista.map((u) => ({
        id: u.id, nombre: u.nombre, usuario: u.usuario, rol: u.rol, activo: u.activo,
        password: cred.descifrar(u.clave_cifrada),
      })),
    });
  } catch (e) { fallo(res, e, 'Error al listar los accesos'); }
});

/* Ponerle una contraseña nueva a un usuario de ese negocio. Sirve para los
   que se crearon antes de que se guardara la copia recuperable: se genera
   una, se le dicta al cliente y desde entonces sí se puede volver a ver. */
router.post('/negocios/:id/usuarios/:uid/clave', async (req, res) => {
  try {
    const u = await one('SELECT id, usuario FROM usuarios WHERE id = $1 AND negocio_id = $2',
      [req.params.uid, req.params.id]);
    if (!u) return res.status(404).json({ error: 'Ese usuario no es de ese negocio' });
    const nueva = String(req.body.password || '') || cred.claveLegible(10);
    if (nueva.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    await query('UPDATE usuarios SET hash = $1, clave_cifrada = $2 WHERE id = $3',
      [bcrypt.hashSync(nueva, 10), cred.cifrar(nueva), u.id]);
    res.json({ ok: true, usuario: u.usuario, password: nueva });
  } catch (e) { fallo(res, e, 'Error al cambiar la contraseña'); }
});

module.exports = router;
