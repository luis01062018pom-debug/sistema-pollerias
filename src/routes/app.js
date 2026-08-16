const express = require('express');
const bcrypt = require('bcryptjs');
const { query, one, rows } = require('../db');
const { requiereAuth, requiereRol } = require('../auth');
const permisos = require('../permisos');
const cred = require('../credenciales');
const { estadoSuscripcion, mensajeSuscripcion, SUSPENDIDOS, SOLO_VENTA } = require('../suscripcion');
const { seguro } = require('../asincrono');

const router = seguro(express.Router());

/** La fecha de HOY en la hora del negocio. Con toISOString() se obtiene la
 * de Greenwich: después de las 6 de la tarde en México ya es el día
 * siguiente, y el corte del día salía vacío. */
function hoyLocal(masDias = 0) {
  return new Date(Date.now() + masDias * 86400000).toLocaleDateString('en-CA');
}

router.use(requiereAuth);

// Todas estas rutas operan sobre el negocio del usuario autenticado
function negocioId(req, res) {
  if (!req.user.negocio_id) {
    res.status(403).json({ error: 'Ruta solo para usuarios de un negocio' });
    return null;
  }
  return req.user.negocio_id;
}

/**
 * Cobranza escalonada. Lo que se bloquea por falta de pago es la
 * administración (reportes, inventario, precios, empleados), NUNCA la venta:
 * que una pollería no pueda cobrarle a su cliente por culpa nuestra se
 * comenta en el pueblo. Solo cuando ya pasaron los días de gracia y la
 * semana de aviso se suspende todo, y ahí el único camino es subir el pago
 * (esa ruta vive en /api/suscripcion y no pasa por aquí).
 */
const RUTAS_DE_VENTA = [/^\/ventas/, /^\/corte/, /^\/compras/];

router.use(async (req, res, next) => {
  try {
    if (!req.user.negocio_id) return next();
    const n = await one(
      'SELECT estado, fecha_corte, dias_gracia FROM negocios WHERE id = $1',
      [req.user.negocio_id]);
    const situacion = estadoSuscripcion(n);
    req.suscripcion = situacion;

    const esVenta = RUTAS_DE_VENTA.some((r) => r.test(req.path));
    if (SUSPENDIDOS.includes(situacion.estado)
        || (SOLO_VENTA.includes(situacion.estado) && !esVenta)) {
      return res.status(402).json({
        error: mensajeSuscripcion(situacion),
        suscripcion: situacion,
      });
    }
    next();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

/**
 * Funciones habilitadas por cliente. Cada pollería contrata lo que necesita:
 * unas solo quieren cobrar, otras llevan inventario y reportes. Apagar la
 * función en el panel tiene que apagarla DE VERDAD, no solo esconder el botón
 * (si no, basta con teclear la ruta a mano).
 */
const FUNCION_POR_RUTA = [
  [/^\/compras/, 'compras'],
  [/^\/inventario/, 'inventario'],
  [/^\/corte/, 'corte'],
  [/^\/reportes/, 'reportes'],
  [/^\/empleados/, 'empleados'],
  [/^\/piezas/, 'precios'],
];

/**
 * Quién es y qué puede hacer QUIEN ESTÁ CONECTADO.
 *
 * Se lee de la base en cada petición, no del pase de entrada, por dos
 * razones: el pase dura 30 días y (1) si el dueño le quita una función a un
 * empleado tiene que aplicarse hoy, no el mes que viene; (2) si lo da de
 * baja, deja de entrar de inmediato — antes seguía trabajando con su pase
 * viejo hasta que venciera.
 */
router.use(async (req, res, next) => {
  if (!req.user.negocio_id) return next();          // el superadmin no pasa por aquí
  const u = await one('SELECT rol, permisos, activo FROM usuarios WHERE id = $1', [req.user.uid]);
  if (!u || !u.activo) return res.status(401).json({ error: 'Tu usuario ya no está activo. Habla con el dueño.' });
  req.user.rol = u.rol;
  req.user.permisos = permisos.permisosDe(u);
  next();
});

/** Lo que no está marcado se rechaza aquí, no en la pantalla. */
router.use((req, res, next) => {
  if (!req.user.negocio_id) return next();
  const funcion = permisos.funcionDeRuta(req.path);
  if (!funcion || req.user.permisos.includes(funcion)) return next();
  res.status(403).json({ error: 'Tu usuario no tiene permiso para eso. Habla con el dueño.' });
});

router.use(async (req, res, next) => {
  if (!req.user.negocio_id) return next();
  const par = FUNCION_POR_RUTA.find(([r]) => r.test(req.path));
  if (!par) return next();
  const n = await one('SELECT flags FROM negocios WHERE id = $1', [req.user.negocio_id]);
  let flags = {};
  try { flags = JSON.parse((n && n.flags) || '{}'); } catch (e) { flags = {}; }
  if (flags[par[1]] === false) {
    return res.status(403).json({ error: 'Esa función no está incluida en tu plan. Habla con soporte.' });
  }
  next();
});

/* ============ PIEZAS / CATÁLOGO ============ */

router.put('/piezas/:id', requiereRol('dueno'), async (req, res) => {
  const nid = negocioId(req, res); if (!nid) return;
  const { precio_kilo, precio_pieza, rendimiento, por_pollo, nombre, vendible } = req.body || {};
  const p = await one('SELECT id FROM piezas WHERE id = $1 AND negocio_id = $2', [req.params.id, nid]);
  if (!p) return res.status(404).json({ error: 'Pieza no encontrada' });
  await query(
    `UPDATE piezas SET
       nombre = COALESCE($1, nombre),
       precio_kilo = COALESCE($2, precio_kilo),
       precio_pieza = COALESCE($3, precio_pieza),
       rendimiento = COALESCE($4, rendimiento),
       por_pollo = COALESCE($5, por_pollo),
       vendible = COALESCE($6, vendible)
     WHERE id = $7`,
    [nombre ?? null, precio_kilo ?? null, precio_pieza ?? null, rendimiento ?? null,
     por_pollo ?? null, typeof vendible === 'boolean' ? vendible : null, req.params.id]
  );
  res.json({ ok: true });
});

router.post('/piezas', requiereRol('dueno'), async (req, res) => {
  const nid = negocioId(req, res); if (!nid) return;
  const { nombre, precio_kilo } = req.body || {};
  if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
  const r = await one(
    `INSERT INTO piezas (negocio_id, nombre, precio_kilo, es_extra, controla_inventario, orden)
     VALUES ($1,$2,$3,TRUE,FALSE,50) RETURNING id`,
    [nid, nombre, precio_kilo || 0]);
  res.json({ ok: true, id: r.id });
});

/* ============ COMPRAS + DESPIECE AUTOMÁTICO ============ */

router.post('/compras', async (req, res) => {
  const nid = negocioId(req, res); if (!nid) return;
  try {
    const pollos = parseInt(req.body.pollos, 10);
    const kgTotal = parseFloat(req.body.kg_total);
    const costoKilo = parseFloat(req.body.costo_kilo);
    if (!pollos || pollos <= 0 || !kgTotal || kgTotal <= 0 || !costoKilo || costoKilo <= 0) {
      return res.status(400).json({ error: 'Pollos, kilos y costo por kilo deben ser mayores a cero' });
    }
    const costoTotal = Math.round(kgTotal * costoKilo * 100) / 100;
    const compra = await one(
      `INSERT INTO compras (negocio_id, pollos, kg_total, costo_kilo, costo_total, usuario_id)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, fecha`,
      [nid, pollos, kgTotal, costoKilo, costoTotal, req.user.uid]);

    // Despiece automático según % de rendimiento del catálogo
    const piezas = await rows(
      `SELECT id, nombre, por_pollo::float8 AS por_pollo, rendimiento::float8 AS rendimiento, controla_inventario
       FROM piezas WHERE negocio_id = $1 AND activo = TRUE AND rendimiento > 0`, [nid]);
    const despiece = [];
    for (const p of piezas) {
      const piezasEsp = Math.round(pollos * p.por_pollo * 100) / 100;
      const kgEsp = Math.round(kgTotal * p.rendimiento * 1000) / 1000;
      await query(
        `INSERT INTO compra_despiece (compra_id, pieza_id, piezas_esperadas, kg_esperados)
         VALUES ($1,$2,$3,$4)`, [compra.id, p.id, piezasEsp, kgEsp]);
      if (p.controla_inventario) {
        await query(
          `INSERT INTO inventario (negocio_id, pieza_id, kg) VALUES ($1,$2,$3)
           ON CONFLICT (negocio_id, pieza_id) DO UPDATE SET kg = inventario.kg + $3`,
          [nid, p.id, kgEsp]);
      }
      despiece.push({ pieza_id: p.id, nombre: p.nombre, piezas_esperadas: piezasEsp, kg_esperados: kgEsp });
    }
    res.json({ ok: true, compra_id: compra.id, costo_total: costoTotal, despiece });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al registrar la compra' });
  }
});

// Ajustar el despiece esperado de una compra (corrige también el inventario por la diferencia)
router.put('/compras/:id/despiece', async (req, res) => {
  const nid = negocioId(req, res); if (!nid) return;
  try {
    const compra = await one('SELECT id FROM compras WHERE id = $1 AND negocio_id = $2', [req.params.id, nid]);
    if (!compra) return res.status(404).json({ error: 'Compra no encontrada' });
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    for (const it of items) {
      const actual = await one(
        `SELECT cd.id, cd.kg_esperados::float8 AS kg_esperados, p.controla_inventario
         FROM compra_despiece cd JOIN piezas p ON p.id = cd.pieza_id
         WHERE cd.compra_id = $1 AND cd.pieza_id = $2`, [compra.id, it.pieza_id]);
      if (!actual) continue;
      const kgNuevo = parseFloat(it.kg_esperados) || 0;
      const pzNuevo = parseFloat(it.piezas_esperadas) || 0;
      const deltaKg = kgNuevo - actual.kg_esperados;
      await query(
        `UPDATE compra_despiece SET kg_esperados = $1, piezas_esperadas = $2 WHERE id = $3`,
        [kgNuevo, pzNuevo, actual.id]);
      if (actual.controla_inventario && deltaKg !== 0) {
        await query(
          `INSERT INTO inventario (negocio_id, pieza_id, kg) VALUES ($1,$2,$3)
           ON CONFLICT (negocio_id, pieza_id) DO UPDATE SET kg = inventario.kg + $3`,
          [nid, it.pieza_id, deltaKg]);
      }
    }
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al ajustar el despiece' });
  }
});

router.get('/compras', async (req, res) => {
  const nid = negocioId(req, res); if (!nid) return;
  const lista = await rows(
    `SELECT id, fecha, pollos, kg_total::float8 AS kg_total, costo_kilo::float8 AS costo_kilo,
            costo_total::float8 AS costo_total, creado_en
     FROM compras WHERE negocio_id = $1 ORDER BY creado_en DESC LIMIT 30`, [nid]);
  res.json(lista);
});

/* ============ INVENTARIO ============ */

router.get('/inventario', async (req, res) => {
  const nid = negocioId(req, res); if (!nid) return;
  const inv = await rows(
    `SELECT p.id AS pieza_id, p.nombre, p.por_pollo::float8 AS por_pollo,
            p.rendimiento::float8 AS rendimiento, COALESCE(i.kg,0)::float8 AS kg
     FROM piezas p
     LEFT JOIN inventario i ON i.pieza_id = p.id AND i.negocio_id = p.negocio_id
     WHERE p.negocio_id = $1 AND p.activo = TRUE AND p.controla_inventario = TRUE
     ORDER BY p.orden, p.nombre`, [nid]);
  res.json(inv);
});

/* ============ VENTAS ============ */

router.post('/ventas', async (req, res) => {
  const nid = negocioId(req, res); if (!nid) return;
  try {
    const { uuid, items, pago, offline } = req.body || {};
    if (!uuid || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Venta sin productos' });
    }
    // Idempotencia: si ya existe este uuid (reintento de sincronización), no duplicar.
    // Se busca DENTRO DEL NEGOCIO, no en toda la base: el uuid lo genera el
    // dispositivo del cliente, y si dos pollerías llegaran a repetir uno (un
    // celular clonado, una copia de la app), la venta de la segunda se habría
    // dado por "duplicada" y NO SE HABRÍA REGISTRADO — plata perdida y datos
    // de un negocio contestando a otro.
    const ya = await one('SELECT id FROM ventas WHERE uuid = $1 AND negocio_id = $2', [uuid, nid]);
    if (ya) return res.json({ ok: true, venta_id: ya.id, duplicada: true });

    let total = 0;
    for (const it of items) {
      it.cantidad = parseFloat(it.cantidad);
      it.precio = parseFloat(it.precio);
      if (!it.cantidad || it.cantidad <= 0 || !(it.precio >= 0)) {
        return res.status(400).json({ error: 'Producto con cantidad o precio inválido' });
      }
      it.subtotal = Math.round(it.cantidad * it.precio * 100) / 100;
      total += it.subtotal;
    }
    total = Math.round(total * 100) / 100;
    const pagoNum = parseFloat(pago) || 0;
    const cambio = pagoNum > total ? Math.round((pagoNum - total) * 100) / 100 : 0;

    const fecha = req.body.fecha ? new Date(req.body.fecha) : new Date();
    const venta = await one(
      `INSERT INTO ventas (negocio_id, uuid, fecha, total, pago, cambio, usuario_id, offline)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [nid, uuid, fecha, total, pagoNum, cambio, req.user.uid, !!offline]);

    const negocio = await one('SELECT peso_promedio_g FROM negocios WHERE id = $1', [nid]);

    for (const it of items) {
      await query(
        `INSERT INTO venta_items (venta_id, pieza_id, nombre, modo, cantidad, precio, subtotal)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [venta.id, it.pieza_id || null, it.nombre, it.modo || 'kg', it.cantidad, it.precio, it.subtotal]);

      // Descontar inventario (en kg)
      if (it.pieza_id) {
        const p = await one(
          `SELECT controla_inventario, por_pollo::float8 AS por_pollo, rendimiento::float8 AS rendimiento
           FROM piezas WHERE id = $1 AND negocio_id = $2`, [it.pieza_id, nid]);
        if (p && p.controla_inventario) {
          let kgVendidos = it.cantidad;
          if (it.modo === 'pieza') {
            const pesoPiezaKg = p.por_pollo > 0 ? (p.rendimiento * negocio.peso_promedio_g / 1000) / p.por_pollo : 0;
            kgVendidos = it.cantidad * pesoPiezaKg;
          }
          await query(
            `INSERT INTO inventario (negocio_id, pieza_id, kg) VALUES ($1,$2,$3)
             ON CONFLICT (negocio_id, pieza_id) DO UPDATE SET kg = inventario.kg + $3`,
            [nid, it.pieza_id, -kgVendidos]);
        }
      }
    }
    res.json({ ok: true, venta_id: venta.id, total, cambio });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al guardar la venta' });
  }
});

router.get('/ventas', async (req, res) => {
  const nid = negocioId(req, res); if (!nid) return;
  const fecha = req.query.fecha || null; // YYYY-MM-DD
  const lista = await rows(
    `SELECT v.id, v.fecha, v.total::float8 AS total, v.pago::float8 AS pago, v.cambio::float8 AS cambio,
            v.offline, u.nombre AS vendedor
     FROM ventas v LEFT JOIN usuarios u ON u.id = v.usuario_id
     WHERE v.negocio_id = $1 AND ($2::date IS NULL OR v.fecha::date = $2::date)
     ORDER BY v.fecha DESC LIMIT 100`, [nid, fecha]);
  // Las partidas de las 100 ventas se piden en UNA consulta, no en cien.
  // Antes era una por venta: 101 viajes a Postgres cada vez que alguien abría
  // la pantalla de ventas del día, y eso se siente en el celular de la tienda.
  if (lista.length) {
    const ids = lista.map((v) => v.id);
    const partidas = await rows(
      `SELECT venta_id, nombre, modo, cantidad::float8 AS cantidad,
              precio::float8 AS precio, subtotal::float8 AS subtotal
       FROM venta_items WHERE venta_id = ANY($1::int[]) ORDER BY id`, [ids]);
    const porVenta = new Map(lista.map((v) => [v.id, []]));
    for (const p of partidas) {
      const destino = porVenta.get(p.venta_id);
      if (destino) { delete p.venta_id; destino.push(p); }
    }
    for (const v of lista) v.items = porVenta.get(v.id) || [];
  }
  res.json(lista);
});

/* ============ CORTE DE CAJA ============ */

async function resumenDia(nid, fecha) {
  const tot = await one(
    `SELECT COUNT(*)::int AS num_ventas, COALESCE(SUM(total),0)::float8 AS total_ventas
     FROM ventas WHERE negocio_id = $1 AND fecha::date = $2::date`, [nid, fecha]);
  const porPieza = await rows(
    `SELECT vi.nombre, vi.modo, SUM(vi.cantidad)::float8 AS cantidad, SUM(vi.subtotal)::float8 AS importe
     FROM venta_items vi JOIN ventas v ON v.id = vi.venta_id
     WHERE v.negocio_id = $1 AND v.fecha::date = $2::date
     GROUP BY vi.nombre, vi.modo ORDER BY importe DESC`, [nid, fecha]);
  const compras = await one(
    `SELECT COALESCE(SUM(kg_total),0)::float8 AS kg, COALESCE(SUM(costo_total),0)::float8 AS costo,
            COALESCE(SUM(pollos),0)::int AS pollos
     FROM compras WHERE negocio_id = $1 AND fecha = $2::date`, [nid, fecha]);
  return { ...tot, por_pieza: porPieza, compras };
}

router.get('/corte/hoy', async (req, res) => {
  const nid = negocioId(req, res); if (!nid) return;
  const fecha = req.query.fecha || hoyLocal();
  const r = await resumenDia(nid, fecha);
  const cerrado = await one('SELECT * FROM cortes WHERE negocio_id = $1 AND fecha = $2::date', [nid, fecha]);
  res.json({ fecha, ...r, cerrado: !!cerrado, corte: cerrado || null });
});

router.post('/corte', async (req, res) => {
  const nid = negocioId(req, res); if (!nid) return;
  try {
    const fecha = req.body.fecha || hoyLocal();
    const efectivo = parseFloat(req.body.efectivo_contado) || 0;
    const r = await resumenDia(nid, fecha);
    const diferencia = Math.round((efectivo - r.total_ventas) * 100) / 100;
    await query(
      `INSERT INTO cortes (negocio_id, fecha, num_ventas, total_ventas, efectivo_contado, diferencia, detalles)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (negocio_id, fecha) DO UPDATE SET
         num_ventas = $3, total_ventas = $4, efectivo_contado = $5, diferencia = $6, detalles = $7`,
      [nid, fecha, r.num_ventas, r.total_ventas, efectivo, diferencia, JSON.stringify(r.por_pieza)]);
    res.json({ ok: true, fecha, total_ventas: r.total_ventas, efectivo_contado: efectivo, diferencia });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al cerrar el corte' });
  }
});

/* ============ REPORTES ============ */

router.get('/reportes/resumen', async (req, res) => {
  const nid = negocioId(req, res); if (!nid) return;
  const desde = req.query.desde || hoyLocal(-6);
  const hasta = req.query.hasta || hoyLocal();
  const porDia = await rows(
    `SELECT fecha::date AS dia, COUNT(*)::int AS ventas, SUM(total)::float8 AS total
     FROM ventas WHERE negocio_id = $1 AND fecha::date BETWEEN $2::date AND $3::date
     GROUP BY fecha::date ORDER BY dia`, [nid, desde, hasta]);
  const topPiezas = await rows(
    `SELECT vi.nombre, SUM(vi.cantidad)::float8 AS cantidad, SUM(vi.subtotal)::float8 AS importe
     FROM venta_items vi JOIN ventas v ON v.id = vi.venta_id
     WHERE v.negocio_id = $1 AND v.fecha::date BETWEEN $2::date AND $3::date
     GROUP BY vi.nombre ORDER BY importe DESC LIMIT 10`, [nid, desde, hasta]);
  const comprasTot = await one(
    `SELECT COALESCE(SUM(costo_total),0)::float8 AS costo
     FROM compras WHERE negocio_id = $1 AND fecha BETWEEN $2::date AND $3::date`, [nid, desde, hasta]);
  const ventasTot = porDia.reduce((s, d) => s + d.total, 0);
  res.json({ desde, hasta, por_dia: porDia, top_piezas: topPiezas,
             total_ventas: Math.round(ventasTot * 100) / 100,
             total_compras: comprasTot.costo,
             ganancia_bruta: Math.round((ventasTot - comprasTot.costo) * 100) / 100 });
});

/* ============ CONFIGURACIÓN DEL NEGOCIO (dueño) ============ */

// El dueño solo edita datos operativos; nombre, logo y colores los maneja el superadmin
router.put('/config', requiereRol('dueno'), async (req, res) => {
  const nid = negocioId(req, res); if (!nid) return;
  const b = req.body || {};
  await query(
    `UPDATE negocios SET
       ticket_direccion = COALESCE($1, ticket_direccion),
       ticket_telefono = COALESCE($2, ticket_telefono),
       ticket_leyenda = COALESCE($3, ticket_leyenda),
       whatsapp = COALESCE($4, whatsapp),
       peso_promedio_g = COALESCE($5, peso_promedio_g),
       costo_kilo = COALESCE($6, costo_kilo)
     WHERE id = $7`,
    [b.ticket_direccion ?? null, b.ticket_telefono ?? null, b.ticket_leyenda ?? null,
     b.whatsapp ?? null, b.peso_promedio_g ?? null, b.costo_kilo ?? null, nid]);
  res.json({ ok: true });
});

router.post('/empleados', requiereRol('dueno'), async (req, res) => {
  const nid = negocioId(req, res); if (!nid) return;
  const { nombre, usuario, password } = req.body || {};
  if (!nombre || !usuario || !password) return res.status(400).json({ error: 'Nombre, usuario y contraseña requeridos' });
  if (String(password).length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  const existe = await one('SELECT id FROM usuarios WHERE usuario = $1', [String(usuario).trim().toLowerCase()]);
  if (existe) return res.status(400).json({ error: 'Ese nombre de usuario ya existe' });
  // Se guarda la copia cifrada: el dueño tiene que poder volver a dictarle la
  // contraseña a su empleado cuando se le olvide (que se le va a olvidar).
  await query(
    `INSERT INTO usuarios (negocio_id, nombre, usuario, hash, rol, permisos, clave_cifrada)
     VALUES ($1,$2,$3,$4,'empleado',$5,$6)`,
    [nid, nombre, String(usuario).trim().toLowerCase(), bcrypt.hashSync(password, 10),
     permisos.funcionesPedidas(req.body.permisos), cred.cifrar(password)]);
  res.json({ ok: true });
});

router.get('/empleados', requiereRol('dueno'), async (req, res) => {
  const nid = negocioId(req, res); if (!nid) return;
  const lista = await rows(
    `SELECT id, nombre, usuario, rol, activo, permisos, clave_cifrada
       FROM usuarios WHERE negocio_id = $1 ORDER BY rol, nombre`, [nid]);
  res.json({
    funciones: permisos.FUNCIONES,
    empleados: lista.map((u) => ({
      id: u.id, nombre: u.nombre, usuario: u.usuario, rol: u.rol, activo: u.activo,
      permisos: permisos.permisosDe(u),
      // La contraseña SOLO la ve el dueño, que es el único que llega aquí.
      password: cred.descifrar(u.clave_cifrada),
    })),
  });
});

/** Cambiarle a un empleado sus funciones, su contraseña o darlo de baja. */
router.put('/empleados/:id', requiereRol('dueno'), async (req, res) => {
  const nid = negocioId(req, res); if (!nid) return;
  const u = await one('SELECT id, rol FROM usuarios WHERE id = $1 AND negocio_id = $2',
    [req.params.id, nid]);
  if (!u) return res.status(404).json({ error: 'Ese usuario no es de tu negocio' });
  if (Number(req.params.id) === Number(req.user.uid) && req.body.activo === false) {
    return res.status(400).json({ error: 'No puedes darte de baja a ti mismo' });
  }
  const b = req.body || {};
  if (b.nombre) await query('UPDATE usuarios SET nombre = $1 WHERE id = $2', [String(b.nombre).slice(0, 80), u.id]);
  if (b.permisos !== undefined) {
    await query('UPDATE usuarios SET permisos = $1 WHERE id = $2', [permisos.funcionesPedidas(b.permisos), u.id]);
  }
  if (b.activo !== undefined) {
    await query('UPDATE usuarios SET activo = $1 WHERE id = $2', [!!b.activo, u.id]);
  }
  if (b.password) {
    if (String(b.password).length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    await query('UPDATE usuarios SET hash = $1, clave_cifrada = $2 WHERE id = $3',
      [bcrypt.hashSync(String(b.password), 10), cred.cifrar(String(b.password)), u.id]);
  }
  res.json({ ok: true });
});

/** Una contraseña sugerida, fácil de dictar por teléfono. */
router.get('/empleados-clave-sugerida', requiereRol('dueno'), (req, res) => {
  res.json({ password: cred.claveLegible(10) });
});

module.exports = router;
