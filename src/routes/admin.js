/**
 * Panel de superadmin — el negocio de nosotros (los socios).
 *
 * Aquí se dan de alta las pollerías cliente, se personalizan, se les pone su
 * renta mensual, se validan sus pagos y se lleva la contabilidad. Todo este
 * archivo exige rol superadmin: un dueño de pollería jamás debe poder tocar
 * ninguna de estas rutas.
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const { query, one, rows, transaccion } = require('../db');
const { requiereAuth, requiereRol } = require('../auth');
const { crearCatalogo } = require('../seed');
const { estadoSuscripcion, corteEnDias } = require('../suscripcion');
const { confirmarPago, cobroManual, rechazarPago } = require('../pagos');
const cred = require('../credenciales');

const { seguro } = require('../asincrono');

const router = seguro(express.Router());
router.use(requiereAuth, requiereRol('superadmin'));

const num = (v, def = 0) => (Number.isFinite(Number(v)) ? Number(v) : def);

/** Los errores con `status` vienen de la capa de pagos y son para el usuario. */
function fallo(res, e, mensajeGenerico) {
  if (e && e.status) return res.status(e.status).json({ error: e.message });
  console.error(e);
  return res.status(500).json({ error: mensajeGenerico });
}

// =====================================================================
// NEGOCIOS CLIENTE
// =====================================================================

/* ¿Alguien entró a mi panel sin que yo me diera cuenta?
   Devuelve las últimas entradas al superadministrador. Una dirección que
   nunca se había visto antes se marca: casi siempre es el mismo dueño desde
   otra red, pero es justo lo que hay que mirar dos veces. */
router.get('/accesos', async (req, res) => {
  const ultimos = await rows(
    `SELECT id, fecha, usuario, exito, ip, dispositivo
       FROM accesos_admin ORDER BY fecha DESC LIMIT 40`);
  // IPs con al menos una entrada BUENA anterior a las últimas 40: las demás
  // son direcciones nuevas.
  const conocidas = await rows(
    `SELECT ip, MIN(fecha) AS desde, COUNT(*) AS veces
       FROM accesos_admin WHERE exito = TRUE AND ip IS NOT NULL
      GROUP BY ip HAVING COUNT(*) > 1`);
  const mapa = new Map(conocidas.map(c => [c.ip, c]));
  res.json(ultimos.map(a => ({ ...a, conocida: mapa.has(a.ip) })));
});

router.get('/negocios', async (req, res) => {
  try {
    const lista = await rows(
      `SELECT n.id, n.codigo, n.nombre, n.color_primario, n.color_secundario, n.activo,
              n.tema, n.color_acento, n.color_fondo,
              (n.logo IS NOT NULL) AS tiene_logo,
              (n.icono_512 IS NOT NULL) AS tiene_iconos,
              n.flags, n.creado_en, n.estado, n.fecha_corte, n.dias_gracia,
              n.precio_mensual::float8 AS precio_mensual,
              n.contacto_nombre, n.whatsapp_contacto, n.notas_internas,
              (SELECT COUNT(*)::int FROM usuarios u WHERE u.negocio_id = n.id) AS usuarios,
              (SELECT COUNT(*)::int FROM ventas v WHERE v.negocio_id = n.id AND v.fecha::date = CURRENT_DATE) AS ventas_hoy,
              (SELECT COALESCE(SUM(v.total),0)::float8 FROM ventas v
                WHERE v.negocio_id = n.id AND v.fecha >= date_trunc('month', now())) AS vendido_mes,
              (SELECT MAX(v.fecha) FROM ventas v WHERE v.negocio_id = n.id) AS ultima_venta,
              (SELECT COUNT(*)::int FROM pagos_suscripcion p
                WHERE p.negocio_id = n.id AND p.estado = 'PENDIENTE') AS pagos_pendientes
       FROM negocios n WHERE n.eliminado_en IS NULL ORDER BY n.nombre`);
    for (const n of lista) {
      n.flags = JSON.parse(n.flags || '{}');
      n.situacion = estadoSuscripcion(n);
    }
    res.json(lista);
  } catch (e) { fallo(res, e, 'Error al listar los negocios'); }
});

/**
 * Alta de un cliente nuevo: crea la pollería con su catálogo base y el
 * usuario dueño, y le arranca el periodo de prueba.
 */
router.post('/negocios', async (req, res) => {
  try {
    const { codigo, nombre, dueno_nombre, dueno_usuario, dueno_password } = req.body || {};
    if (!codigo || !nombre || !dueno_usuario || !dueno_password) {
      return res.status(400).json({ error: 'Código, nombre del negocio, usuario y contraseña del dueño son requeridos' });
    }
    if (String(dueno_password).length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }
    const cod = String(codigo).trim().toUpperCase();
    if (await one('SELECT id FROM negocios WHERE codigo = $1', [cod])) {
      return res.status(400).json({ error: 'Ese código de negocio ya existe' });
    }
    const usr = String(dueno_usuario).trim().toLowerCase();
    if (await one('SELECT id FROM usuarios WHERE usuario = $1', [usr])) {
      return res.status(400).json({ error: 'Ese nombre de usuario ya existe' });
    }

    const diasPrueba = Math.min(Math.max(num(req.body.dias_prueba, 30), 0), 365);
    const neg = await one(
      `INSERT INTO negocios (codigo, nombre, precio_mensual, estado, fecha_corte,
                             dias_gracia, contacto_nombre, whatsapp_contacto, notas_internas)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [cod, nombre, num(req.body.precio_mensual, 0),
       diasPrueba > 0 ? 'PRUEBA' : 'ACTIVA', corteEnDias(diasPrueba),
       num(req.body.dias_gracia, 5), dueno_nombre || null,
       req.body.whatsapp_contacto || null, req.body.notas_internas || null]);

    // Se guarda también la copia cifrada: cuando el cliente hable diciendo
    // que perdió su contraseña, hay que poder volver a dictársela.
    await query(
      `INSERT INTO usuarios (negocio_id, nombre, usuario, hash, rol, clave_cifrada)
       VALUES ($1,$2,$3,$4,'dueno',$5)`,
      [neg.id, dueno_nombre || 'Dueño', usr, bcrypt.hashSync(dueno_password, 10),
       cred.cifrar(dueno_password)]);
    await crearCatalogo(neg.id, 2500);

    res.json({ ok: true, negocio_id: neg.id, usuario: usr, password: dueno_password });
  } catch (e) { fallo(res, e, 'Error al crear el negocio'); }
});

router.put('/negocios/:id', async (req, res) => {
  try {
    const b = req.body || {};
    const neg = await one('SELECT id, flags FROM negocios WHERE id = $1', [req.params.id]);
    if (!neg) return res.status(404).json({ error: 'Negocio no encontrado' });

    let flags = null;
    if (b.flags && typeof b.flags === 'object') {
      flags = JSON.stringify({ ...JSON.parse(neg.flags || '{}'), ...b.flags });
    }
    const estado = ['PRUEBA', 'ACTIVA', 'CANCELADA'].includes(b.estado) ? b.estado : null;

    // Quitarle el logo es un acto explícito: mandar `logo: null` no borra nada
    // (COALESCE lo ignora), hay que pedir `quitar_logo`.
    const quitar = b.quitar_logo === true;
    const png = (v) => (typeof v === 'string' && /^data:image\/png;base64,/.test(v) ? v : null);

    await query(
      `UPDATE negocios SET
         nombre = COALESCE($1, nombre),
         activo = COALESCE($2, activo),
         flags = COALESCE($3, flags),
         color_primario = COALESCE($4, color_primario),
         color_secundario = COALESCE($5, color_secundario),
         logo = CASE WHEN $15::boolean THEN NULL ELSE COALESCE($6, logo) END,
         precio_mensual = COALESCE($7, precio_mensual),
         estado = COALESCE($8, estado),
         fecha_corte = COALESCE($9::date, fecha_corte),
         dias_gracia = COALESCE($10, dias_gracia),
         contacto_nombre = COALESCE($11, contacto_nombre),
         whatsapp_contacto = COALESCE($12, whatsapp_contacto),
         notas_internas = COALESCE($13, notas_internas),
         tema = COALESCE($14, tema),
         color_acento = COALESCE($16, color_acento),
         color_fondo = COALESCE($17, color_fondo),
         icono_192 = CASE WHEN $15::boolean THEN NULL ELSE COALESCE($18, icono_192) END,
         icono_512 = CASE WHEN $15::boolean THEN NULL ELSE COALESCE($19, icono_512) END
       WHERE id = $20`,
      [b.nombre ?? null, typeof b.activo === 'boolean' ? b.activo : null, flags,
       b.color_primario ?? null, b.color_secundario ?? null, b.logo ?? null,
       b.precio_mensual === undefined ? null : num(b.precio_mensual, 0), estado,
       b.fecha_corte || null,
       b.dias_gracia === undefined ? null : num(b.dias_gracia, 5),
       b.contacto_nombre ?? null, b.whatsapp_contacto ?? null, b.notas_internas ?? null,
       b.tema ?? null, quitar,
       b.color_acento ?? null, b.color_fondo ?? null,
       png(b.icono_192), png(b.icono_512),
       req.params.id]);
    res.json({ ok: true });
  } catch (e) { fallo(res, e, 'Error al guardar el negocio'); }
});

/** Los usuarios de ese negocio: quién puede entrar y con qué papel. */
router.get('/negocios/:id/usuarios', async (req, res) => {
  try {
    const lista = await rows(
      `SELECT id, nombre, usuario, rol, activo, creado_en
         FROM usuarios WHERE negocio_id = $1 ORDER BY rol, nombre`, [req.params.id]);
    res.json(lista);
  } catch (e) { fallo(res, e, 'Error al listar usuarios'); }
});

router.post('/negocios/:id/usuarios', async (req, res) => {
  try {
    const { nombre, usuario, password, rol } = req.body || {};
    const usr = String(usuario || '').trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,20}$/.test(usr)) {
      return res.status(400).json({ error: 'El usuario debe tener de 3 a 20 letras o números, sin espacios' });
    }
    if (String(password || '').length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }
    if (await one('SELECT id FROM usuarios WHERE usuario = $1', [usr])) {
      return res.status(400).json({ error: 'Ese nombre de usuario ya existe' });
    }
    const u = await one(
      `INSERT INTO usuarios (negocio_id, nombre, usuario, hash, rol)
       VALUES ($1,$2,$3,$4,$5) RETURNING id, nombre, usuario, rol`,
      [req.params.id, nombre || usr, usr, bcrypt.hashSync(password, 10),
       rol === 'dueno' ? 'dueno' : 'empleado']);
    res.json({ ok: true, usuario: u });
  } catch (e) { fallo(res, e, 'Error al crear el usuario'); }
});

/**
 * Dar de baja una pollería.
 *
 * Dos caminos, y la diferencia importa:
 *  - Si nunca vendió ni pagó, se borra de verdad (fue un alta de prueba o un
 *    error de captura y no tiene caso conservarla).
 *  - Si ya tiene historial, se marca la baja: desaparece del panel y nadie
 *    puede entrar, pero sus ventas y los pagos que nos hizo siguen en la
 *    contabilidad. Borrar eso desajustaría los números del negocio.
 *
 * Siempre exige que se escriba el nombre exacto: es lo único que evita
 * borrar al cliente equivocado por un clic distraído.
 */
router.delete('/negocios/:id', async (req, res) => {
  try {
    const n = await one('SELECT id, nombre FROM negocios WHERE id = $1 AND eliminado_en IS NULL',
      [req.params.id]);
    if (!n) return res.status(404).json({ error: 'Ese negocio no existe' });

    const escrito = String((req.body || {}).confirmacion || '').trim();
    if (escrito.toLowerCase() !== String(n.nombre).trim().toLowerCase()) {
      return res.status(400).json({
        error: `Para eliminarlo, escribe su nombre tal cual: ${n.nombre}`,
      });
    }

    const uso = await one(
      `SELECT (SELECT COUNT(*)::int FROM ventas WHERE negocio_id = $1) AS ventas,
              (SELECT COUNT(*)::int FROM pagos_suscripcion WHERE negocio_id = $1) AS pagos`,
      [n.id]);

    if (uso.ventas === 0 && uso.pagos === 0) {
      await transaccion(async (tx) => {
        for (const sql of [
          'DELETE FROM compra_despiece WHERE compra_id IN (SELECT id FROM compras WHERE negocio_id = $1)',
          'DELETE FROM compras WHERE negocio_id = $1',
          'DELETE FROM inventario WHERE negocio_id = $1',
          'DELETE FROM cortes WHERE negocio_id = $1',
          'DELETE FROM piezas WHERE negocio_id = $1',
          'DELETE FROM usuarios WHERE negocio_id = $1',
          'UPDATE contabilidad_saas SET negocio_id = NULL WHERE negocio_id = $1',
          'DELETE FROM negocios WHERE id = $1',
        ]) await tx.query(sql, [n.id]);
      });
      return res.json({ ok: true, borrado: 'completo', nombre: n.nombre });
    }

    await query(
      `UPDATE negocios SET eliminado_en = now(), activo = FALSE, estado = 'CANCELADA'
       WHERE id = $1`, [n.id]);
    res.json({
      ok: true, borrado: 'con historial', nombre: n.nombre,
      ventas: uso.ventas, pagos: uso.pagos,
    });
  } catch (e) { fallo(res, e, 'Error al eliminar el negocio'); }
});

/**
 * Editar un usuario ya existente del cliente: cómo se llama, con qué usuario
 * entra, si es dueño o empleado y si sigue teniendo acceso. Es lo que se pide
 * por teléfono ("ya no trabaja aquí", "quiero que mi hijo también entre").
 */
router.put('/negocios/:id/usuarios/:uid', async (req, res) => {
  try {
    const b = req.body || {};
    const u = await one('SELECT id, usuario, rol FROM usuarios WHERE id = $1 AND negocio_id = $2',
      [req.params.uid, req.params.id]);
    if (!u) return res.status(404).json({ error: 'Usuario no encontrado en ese negocio' });

    let nuevoUsuario = null;
    if (b.usuario !== undefined) {
      nuevoUsuario = String(b.usuario).trim().toLowerCase();
      if (!/^[a-z0-9._-]{3,20}$/.test(nuevoUsuario)) {
        return res.status(400).json({ error: 'El usuario debe tener de 3 a 20 letras o números, sin espacios' });
      }
      if (nuevoUsuario !== u.usuario
          && await one('SELECT id FROM usuarios WHERE usuario = $1', [nuevoUsuario])) {
        return res.status(400).json({ error: 'Ese nombre de usuario ya existe' });
      }
    }
    const rol = ['dueno', 'empleado'].includes(b.rol) ? b.rol : null;

    // No dejar al negocio sin ningún dueño activo: si no, nadie podría entrar
    // a configurar precios ni a subir el comprobante de pago.
    if (u.rol === 'dueno' && (rol === 'empleado' || b.activo === false)) {
      const otros = await one(
        `SELECT COUNT(*)::int AS n FROM usuarios
          WHERE negocio_id = $1 AND rol = 'dueno' AND activo = TRUE AND id <> $2`,
        [req.params.id, u.id]);
      if (!otros.n) return res.status(400).json({ error: 'Es el único dueño activo: primero nombra a otro dueño' });
    }

    await query(
      `UPDATE usuarios SET
         nombre = COALESCE($1, nombre),
         usuario = COALESCE($2, usuario),
         rol = COALESCE($3, rol),
         activo = COALESCE($4, activo)
       WHERE id = $5`,
      [b.nombre ?? null, nuevoUsuario, rol,
       typeof b.activo === 'boolean' ? b.activo : null, u.id]);

    if (b.password) {
      if (String(b.password).length < 6) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
      }
      await query('UPDATE usuarios SET hash = $1 WHERE id = $2',
        [bcrypt.hashSync(String(b.password), 10), u.id]);
    }
    res.json({ ok: true });
  } catch (e) { fallo(res, e, 'Error al guardar el usuario'); }
});

router.post('/negocios/:id/reset-password', async (req, res) => {
  try {
    const { usuario, password } = req.body || {};
    if (!usuario || !password) return res.status(400).json({ error: 'Usuario y nueva contraseña requeridos' });
    if (String(password).length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    const u = await one('SELECT id FROM usuarios WHERE usuario = $1 AND negocio_id = $2',
      [String(usuario).trim().toLowerCase(), req.params.id]);
    if (!u) return res.status(404).json({ error: 'Usuario no encontrado en ese negocio' });
    await query('UPDATE usuarios SET hash = $1, clave_cifrada = $2 WHERE id = $3',
      [bcrypt.hashSync(password, 10), cred.cifrar(password), u.id]);
    res.json({ ok: true });
  } catch (e) { fallo(res, e, 'Error al restablecer la contraseña'); }
});

// =====================================================================
// PAGOS DE LA RENTA MENSUAL
// =====================================================================

router.get('/pagos', async (req, res) => {
  try {
    const estado = ['PENDIENTE', 'APROBADO', 'RECHAZADO'].includes(req.query.estado)
      ? req.query.estado : null;
    const lista = await rows(
      `SELECT p.id, p.negocio_id, p.monto::float8 AS monto, p.metodo, p.referencia, p.estado,
              p.periodo_inicio, p.periodo_fin, p.creado_en, p.validado_en, p.motivo_rechazo,
              (p.comprobante_bytes IS NOT NULL) AS tiene_comprobante,
              n.nombre AS negocio, n.precio_mensual::float8 AS precio_mensual, n.fecha_corte
         FROM pagos_suscripcion p JOIN negocios n ON n.id = p.negocio_id
        WHERE ($1::text IS NULL OR p.estado = $1)
        ORDER BY (p.estado = 'PENDIENTE') DESC, p.creado_en DESC LIMIT 200`, [estado]);
    res.json(lista);
  } catch (e) { fallo(res, e, 'Error al listar los pagos'); }
});

/** La foto que subió la pollería. Se sirve desde la base, sin caché. */
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
    const r = await confirmarPago(req.params.id, {
      validadoPor: req.user.uid, meses: num(req.body.meses, 1),
    });
    res.json({ ok: true, ...r });
  } catch (e) { fallo(res, e, 'Error al aprobar el pago'); }
});

router.post('/pagos/:id/rechazar', async (req, res) => {
  try {
    await rechazarPago(req.params.id, { validadoPor: req.user.uid, motivo: req.body.motivo });
    res.json({ ok: true });
  } catch (e) { fallo(res, e, 'Error al rechazar el pago'); }
});

/** Cobro en efectivo que registramos nosotros: entra y se aprueba solo. */
router.post('/pagos/manual', async (req, res) => {
  try {
    const r = await cobroManual({
      negocio_id: req.body.negocio_id,
      monto: req.body.monto,
      metodo: req.body.metodo,
      referencia: req.body.referencia,
      meses: num(req.body.meses, 1),
      usuarioId: req.user.uid,
    });
    res.json({ ok: true, ...r });
  } catch (e) { fallo(res, e, 'Error al registrar el cobro'); }
});

// =====================================================================
// CONTABILIDAD DEL SaaS
// =====================================================================

router.get('/contabilidad', async (req, res) => {
  try {
    const mes = await one(
      `SELECT COALESCE(SUM(CASE WHEN tipo='INGRESO' THEN monto ELSE 0 END),0)::float8 AS ingresos,
              COALESCE(SUM(CASE WHEN tipo='GASTO'   THEN monto ELSE 0 END),0)::float8 AS gastos
         FROM contabilidad_saas WHERE fecha >= date_trunc('month', CURRENT_DATE)`);
    const historico = await one(
      `SELECT COALESCE(SUM(CASE WHEN tipo='INGRESO' THEN monto ELSE 0 END),0)::float8 AS ingresos,
              COALESCE(SUM(CASE WHEN tipo='GASTO'   THEN monto ELSE 0 END),0)::float8 AS gastos
         FROM contabilidad_saas`);
    // MRR: lo que deberían pagar todos los negocios que no están cancelados.
    const mrr = await one(
      `SELECT COALESCE(SUM(precio_mensual),0)::float8 AS monto, COUNT(*)::int AS cobrando
         FROM negocios WHERE estado <> 'CANCELADA' AND precio_mensual > 0`);
    const porMes = await rows(
      `SELECT to_char(fecha, 'YYYY-MM') AS mes,
              SUM(CASE WHEN tipo='INGRESO' THEN monto ELSE 0 END)::float8 AS ingresos,
              SUM(CASE WHEN tipo='GASTO'   THEN monto ELSE 0 END)::float8 AS gastos
         FROM contabilidad_saas GROUP BY 1 ORDER BY 1 DESC LIMIT 12`);
    const movimientos = await rows(
      `SELECT c.concepto, c.tipo, c.monto::float8 AS monto, c.fecha, n.nombre AS negocio
         FROM contabilidad_saas c LEFT JOIN negocios n ON n.id = c.negocio_id
        ORDER BY c.fecha DESC, c.id DESC LIMIT 50`);
    const negocios = await rows(
      `SELECT id, nombre, estado, fecha_corte, dias_gracia, precio_mensual::float8 AS precio_mensual
         FROM negocios`);

    // Morosos: con la misma regla que usa el sistema para bloquear.
    const morosos = negocios
      .map((n) => ({ ...n, situacion: estadoSuscripcion(n) }))
      .filter((n) => ['GRACIA', 'RESTRINGIDA', 'SUSPENDIDA'].includes(n.situacion.estado))
      .map((n) => ({ id: n.id, nombre: n.nombre, precio_mensual: n.precio_mensual,
                     fecha_corte: n.fecha_corte, ...n.situacion }));

    res.json({
      ingresos_mes: mes.ingresos, gastos_mes: mes.gastos,
      utilidad_mes: mes.ingresos - mes.gastos,
      ingresos_historicos: historico.ingresos, gastos_historicos: historico.gastos,
      mrr: mrr.monto, negocios_cobrando: mrr.cobrando,
      por_mes: porMes, movimientos, morosos,
    });
  } catch (e) { fallo(res, e, 'Error al calcular la contabilidad'); }
});

/** Gastos del negocio: Railway, dominio, lo que se pague. */
router.post('/gastos', async (req, res) => {
  try {
    const monto = num(req.body.monto);
    const concepto = String(req.body.concepto || '').trim();
    if (!(monto > 0)) return res.status(400).json({ error: 'Escribe el monto' });
    if (!concepto) return res.status(400).json({ error: 'Escribe de qué fue el gasto' });
    await query(
      `INSERT INTO contabilidad_saas (concepto, tipo, monto, fecha, registrado_por, nota)
       VALUES ($1,'GASTO',$2,COALESCE($3::date, CURRENT_DATE),$4,$5)`,
      [concepto, monto, req.body.fecha || null, req.user.uid, req.body.nota || null]);
    res.json({ ok: true });
  } catch (e) { fallo(res, e, 'Error al registrar el gasto'); }
});

module.exports = router;
