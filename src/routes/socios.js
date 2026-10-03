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
const { one, rows, query, transaccion } = require('../db');
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

/* Lo que llega como imagen se revisa aquí: se va a servir tal cual al
   teléfono del cliente cuando instale la app. Nada de SVG (puede traer
   código) y nada que pese más de lo que ocupa un logo de verdad. */
const LIMITE_IMAGEN = 600 * 1024;
function imagenValida(v) {
  return typeof v === 'string' && v.length <= LIMITE_IMAGEN
    && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v) ? v : null;
}
function pngValido(v) {
  return typeof v === 'string' && v.length <= LIMITE_IMAGEN
    && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(v) ? v : null;
}
function colorValido(v) {
  return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : null;
}

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
              n.notas_internas AS notas,
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

    // Los iconos (192 y 512) son los que usa el teléfono al instalar la app.
    // Antes el alta solo guardaba el logo y la pollería se instalaba con el
    // icono genérico hasta que alguien la editaba a mano.
    const neg = await one(
      `INSERT INTO negocios (codigo, nombre, precio_mensual, estado, fecha_corte, dias_gracia,
                             contacto_nombre, whatsapp_contacto, color_primario, logo,
                             icono_192, icono_512)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9,'#263949'),$10,$11,$12) RETURNING id`,
      [codigo, nombre, Number(b.precio_mensual) || 0,
       dias > 0 ? 'PRUEBA' : 'ACTIVA', corteEnDias(dias), Number(b.dias_gracia) || 5,
       b.contacto_nombre || null, b.whatsapp_contacto || null,
       colorValido(b.color),
       imagenValida(b.logo), pngValido(b.icono_192), pngValido(b.icono_512)]);

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

/* La marca de un cliente: nombre, color, logo y leyenda del ticket.
   La manejamos NOSOTROS desde el panel de fundadores —igual que en tiendas y
   jarcerías—; el dueño ve el resultado pero no lo edita. */
router.get('/negocios/:id/marca', async (req, res) => {
  try {
    const n = await one(
      `SELECT id, codigo, nombre, color_primario, ticket_leyenda, logo,
              (icono_192 IS NOT NULL) AS tiene_iconos
         FROM negocios WHERE id = $1`, [req.params.id]);
    if (!n) return res.status(404).json({ error: 'Ese negocio no existe' });
    res.json({
      ok: true,
      marca: {
        nombre_negocio: n.nombre, color: n.color_primario, mensaje_ticket: n.ticket_leyenda,
        logo: n.logo || (n.tiene_iconos ? `/api/publico/icono/${encodeURIComponent(n.codigo)}/512.png` : ''),
      },
    });
  } catch (e) { fallo(res, e, 'Error al leer la marca'); }
});

router.put('/negocios/:id/marca', async (req, res) => {
  try {
    const b = req.body || {};
    const n = await one('SELECT id FROM negocios WHERE id = $1', [req.params.id]);
    if (!n) return res.status(404).json({ error: 'Ese negocio no existe' });
    const nombre = b.nombre_negocio === undefined ? null : String(b.nombre_negocio).trim().slice(0, 80);
    if (nombre === '') return res.status(400).json({ error: 'El nombre no puede quedar vacío' });
    if (b.logo && !imagenValida(b.logo)) return res.status(400).json({ error: 'Esa imagen no se puede usar como logo' });
    const quitar = b.logo === '';
    await query(
      `UPDATE negocios SET
         nombre = COALESCE($1, nombre),
         color_primario = COALESCE($2, color_primario),
         ticket_leyenda = COALESCE($3, ticket_leyenda),
         logo      = CASE WHEN $7::boolean THEN NULL ELSE COALESCE($4, logo) END,
         icono_192 = CASE WHEN $7::boolean THEN NULL ELSE COALESCE($5, icono_192) END,
         icono_512 = CASE WHEN $7::boolean THEN NULL ELSE COALESCE($6, icono_512) END
       WHERE id = $8`,
      [nombre, colorValido(b.color),
       b.mensaje_ticket === undefined ? null : String(b.mensaje_ticket).slice(0, 120),
       imagenValida(b.logo), pngValido(b.icono_192), pngValido(b.icono_512), quitar, n.id]);
    res.json({ ok: true });
  } catch (e) { fallo(res, e, 'Error al guardar la marca'); }
});

/* Los datos del contrato: contacto, renta, fecha de corte y notas. Con
   `baja: true` se da de baja a un cliente REAL que se va: deja de entrar,
   pero sus ventas y lo que nos pagó se conservan (no es borrar). */
router.put('/negocios/:id', async (req, res) => {
  try {
    const b = req.body || {};
    const n = await one('SELECT id FROM negocios WHERE id = $1', [req.params.id]);
    if (!n) return res.status(404).json({ error: 'Ese negocio no existe' });
    const fecha = b.fecha_corte === undefined || b.fecha_corte === null || b.fecha_corte === ''
      ? null : String(b.fecha_corte);
    if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return res.status(400).json({ error: 'Fecha de corte inválida' });
    const numero = (v, min, max) => (v === undefined || v === null || v === ''
      ? null : Math.min(Math.max(Number(v) || 0, min), max));
    await query(
      `UPDATE negocios SET
         contacto_nombre   = COALESCE($1, contacto_nombre),
         whatsapp_contacto = COALESCE($2, whatsapp_contacto),
         precio_mensual    = COALESCE($3, precio_mensual),
         fecha_corte       = COALESCE($4::date, fecha_corte),
         dias_gracia       = COALESCE($5, dias_gracia),
         notas_internas    = COALESCE($6, notas_internas),
         estado = CASE WHEN $7::boolean THEN 'CANCELADA' ELSE estado END,
         activo = CASE WHEN $7::boolean THEN FALSE ELSE activo END
       WHERE id = $8`,
      [b.contacto_nombre === undefined ? null : String(b.contacto_nombre).slice(0, 80),
       b.whatsapp_contacto === undefined ? null : String(b.whatsapp_contacto).replace(/[^\d+]/g, '').slice(0, 20),
       numero(b.precio_mensual, 0, 100000), fecha, numero(b.dias_gracia, 0, 60),
       b.notas === undefined ? null : String(b.notas).slice(0, 500),
       b.baja === true, n.id]);
    res.json({ ok: true });
  } catch (e) { fallo(res, e, 'Error al guardar los datos'); }
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

/* Borrar un negocio de PRUEBA, de verdad.
 *
 * Ojo con la diferencia: a un cliente real que se va se le pone estado
 * CANCELADA y se conserva todo, porque lo que nos pagó es la contabilidad
 * del negocio. Esto es lo otro: las pollerías de prueba que damos de alta
 * mientras armamos el sistema y que no queremos cargar para siempre.
 *
 * Pide DOS confirmaciones —el nombre tal cual y la palabra BORRAR— y se
 * revisan aquí, que es donde se sabe cómo se llama de verdad ese negocio.
 *
 * Las tablas no se listan a mano: se le preguntan a la base (todas las que
 * tienen columna negocio_id), y como unas dependen de otras se dan varias
 * vueltas hasta que ya no queda nada. Así, el día que se agregue una tabla
 * nueva, también se limpia. Todo en una transacción: o se va completo o no
 * se toca nada.
 */
router.delete('/negocios/:id', async (req, res) => {
  try {
    const n = await one('SELECT id, nombre FROM negocios WHERE id = $1', [req.params.id]);
    if (!n) return res.status(404).json({ error: 'Ese negocio no existe' });

    const escrito = String((req.body || {}).confirmacion || '').trim().toLowerCase();
    if (escrito !== String(n.nombre).trim().toLowerCase()) {
      return res.status(400).json({ error: `Para borrarlo, escribe su nombre tal cual: ${n.nombre}` });
    }
    if (String((req.body || {}).confirmacion2 || '').trim().toUpperCase() !== 'BORRAR') {
      return res.status(400).json({ error: 'Falta la segunda confirmación: escribe BORRAR' });
    }

    // Las tablas salen de la base (las que tienen negocio_id y TAMBIÉN sus
    // hijas, como las partidas de una venta o el despiece de una compra, que
    // no tienen la columna). Antes solo se buscaban las primeras y borrar una
    // pollería que ya había vendido fallaba siempre: sus partidas amarraban
    // a las ventas. Se recorren de hijas a madres.
    const { tablasDelNegocio, ordenarPorDependencias } = require('../volcado');
    const borrado = await transaccion(async (cx) => {
      const tablas = await tablasDelNegocio(cx, { raiz: 'negocios', columna: 'negocio_id' });
      const { rows: fks } = await cx.query(
        `SELECT tc.table_name AS hija, ccu.table_name AS padre
           FROM information_schema.table_constraints tc
           JOIN information_schema.constraint_column_usage ccu
             ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
          WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'`);
      const orden = ordenarPorDependencias(tablas.map((t) => t.tabla), fks).reverse();
      const cuenta = {};
      for (const nombre of orden) {
        const t = tablas.find((x) => x.tabla === nombre);
        const r = await cx.query(`DELETE FROM "${t.tabla}" WHERE ${t.donde.replace(/\$ID/g, String(Number(n.id)))}`);
        const cuantos = Number(r.rowCount ?? r.affectedRows ?? 0);
        if (cuantos) cuenta[t.tabla] = cuantos;
      }
      return cuenta;
    });

    console.log(`🗑  Pollería "${n.nombre}" borrada desde el panel:`, JSON.stringify(borrado));
    res.json({ ok: true, nombre: n.nombre, borrado });
  } catch (e) { fallo(res, e, 'Error al borrar el negocio'); }
});

/* ── Respaldos de cada pollería (fuera del servidor) ──
   El panel de fundadores enseña aquí si cada pollería tiene su copia del día
   en la nube, puede pedir una al momento y bajar la última. */
const respaldo = require('../respaldo');
const nube = require('../nube');

router.get('/respaldos', async (req, res) => {
  try {
    res.json({ ok: true, nube_configurada: nube.configurada(), falta: nube.queFalta(), negocios: await respaldo.estado() });
  } catch (e) { fallo(res, e, 'Error al leer los respaldos'); }
});

router.post('/respaldos/:id', async (req, res) => {
  try {
    if (!nube.configurada()) return res.status(503).json({ error: 'La nube de respaldos no está configurada' });
    res.json(await respaldo.respaldarNegocio(Number(req.params.id), { forzar: true }));
  } catch (e) { fallo(res, e, 'Error al respaldar'); }
});

router.get('/respaldos/:id/ultimo', async (req, res) => {
  try {
    if (!nube.configurada()) return res.status(503).json({ error: 'La nube de respaldos no está configurada' });
    const lista = await nube.respaldosDe('polleria', String(Number(req.params.id)));
    if (!lista.length) return res.status(404).json({ error: 'Esa pollería todavía no tiene respaldo en la nube' });
    res.set('Content-Type', 'application/octet-stream');
    res.set('Cache-Control', 'private, no-store');
    res.send(await nube.bajar(lista[0].clave));
  } catch (e) { fallo(res, e, 'Error al bajar el respaldo'); }
});

module.exports = router;
