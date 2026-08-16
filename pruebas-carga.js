/**
 * PRUEBA DE CARGA — ¿aguanta 50 pollerías sin alentarse?
 *
 *    npm run carga            (50 negocios × 400 ventas cada uno)
 *    npm run carga -- 70 800  (los que se quieran)
 *    npm run carga -- --limpiar
 *
 * Crea negocios de mentira con meses de ventas y mide lo que de verdad
 * siente el usuario: abrir el sistema, cobrar, ver el corte del día y sacar
 * el reporte del mes. Al terminar borra lo que creó.
 *
 * Lo que se busca NO es un número bonito de milisegundos: es que el tiempo
 * de UNA pollería no crezca porque haya otras 49. Por eso, además de medir,
 * se revisa que las consultas pesadas usen índice y filtren por negocio.
 * Si una consulta recorre la tabla entera (Seq Scan), a los tres meses de
 * ventas la caja se va a sentir lenta y no se sabría por qué.
 *
 * OJO: usa la base de DESARROLLO (data-dev/). Nunca se corre contra la base
 * de producción: crearía cientos de negocios falsos en el padrón real.
 */
const db = require('./src/db');
const bcrypt = require('bcryptjs');

const NEGOCIOS = Number(process.argv[2]) || 50;
const VENTAS = Number(process.argv[3]) || 400;
const PREFIJO = 'ZZCARGA';

if (process.env.DATABASE_URL) {
  console.error('\n✖ Esta prueba NO se corre contra Postgres de producción.');
  console.error('  Quita DATABASE_URL del entorno para que use la base de desarrollo.\n');
  process.exit(1);
}

const crono = () => { const t = process.hrtime.bigint(); return () => Number(process.hrtime.bigint() - t) / 1e6; };
const ms = (n) => n.toFixed(1).padStart(8) + ' ms';

async function sembrar() {
  console.log(`\nCreando ${NEGOCIOS} pollerías de prueba con ${VENTAS} ventas cada una…`);
  const t = crono();
  const { crearCatalogo } = require('./src/seed');
  for (let i = 1; i <= NEGOCIOS; i++) {
    const codigo = `${PREFIJO}${String(i).padStart(3, '0')}`;
    if (await db.one('SELECT id FROM negocios WHERE codigo = $1', [codigo])) continue;
    const n = await db.one(
      `INSERT INTO negocios (codigo, nombre, precio_mensual, estado, fecha_corte, dias_gracia)
       VALUES ($1,$2,150,'ACTIVA',CURRENT_DATE + 30,5) RETURNING id`,
      [codigo, `Pollería de carga ${i}`]);
    await db.query(
      `INSERT INTO usuarios (negocio_id, nombre, usuario, hash, rol)
       VALUES ($1,'Dueño',$2,$3,'dueno')`,
      [n.id, codigo.toLowerCase(), bcrypt.hashSync('carga1234', 6)]);
    await crearCatalogo(n.id, 2500);

    // Ventas repartidas en los últimos 90 días, como un negocio de verdad.
    const piezas = await db.rows('SELECT id, nombre, precio_kilo FROM piezas WHERE negocio_id = $1 LIMIT 6', [n.id]);
    for (let v = 0; v < VENTAS; v++) {
      const dias = Math.floor(Math.random() * 90);
      const total = 50 + Math.random() * 400;
      const venta = await db.one(
        `INSERT INTO ventas (negocio_id, uuid, fecha, total, pago, cambio)
         VALUES ($1, $2, now() - ($3 || ' days')::interval, $4, $4, 0) RETURNING id`,
        [n.id, `carga-${n.id}-${v}`, String(dias), total.toFixed(2)]);
      const p = piezas[v % piezas.length];
      if (p) {
        await db.query(
          `INSERT INTO venta_items (venta_id, pieza_id, nombre, modo, cantidad, precio, subtotal)
           VALUES ($1,$2,$3,'kg',1.5,$4,$5)`,
          [venta.id, p.id, p.nombre, p.precio_kilo, total.toFixed(2)]);
      }
    }
    process.stdout.write(`\r  pollería ${i}/${NEGOCIOS}   `);
  }
  console.log(`\r  listo en ${(t() / 1000).toFixed(1)} s${' '.repeat(20)}`);
}

async function medir() {
  const uno = await db.one(`SELECT id FROM negocios WHERE codigo = $1`, [`${PREFIJO}001`]);
  const nid = uno.id;
  const hoy = new Date().toLocaleDateString('en-CA');

  console.log('\n── LO QUE SIENTE LA POLLERÍA (promedio de 20 vueltas) ──');
  const pruebas = [
    ['Abrir el sistema (catálogo de piezas)', () =>
      db.rows('SELECT * FROM piezas WHERE negocio_id = $1 AND activo = TRUE ORDER BY orden', [nid])],
    ['Cobrar (guardar una venta)', async () => {
      const v = await db.one(
        `INSERT INTO ventas (negocio_id, uuid, fecha, total, pago, cambio)
         VALUES ($1, $2, now(), 100, 100, 0) RETURNING id`,
        [nid, `medicion-${Date.now()}-${Math.random()}`]);
      await db.query('DELETE FROM ventas WHERE id = $1', [v.id]);
    }],
    ['Corte del día', () =>
      db.one(`SELECT COUNT(*)::int n, COALESCE(SUM(total),0)::float8 t FROM ventas
                WHERE negocio_id = $1 AND fecha::date = $2::date`, [nid, hoy])],
    ['Reporte del mes', () =>
      db.rows(`SELECT fecha::date d, COUNT(*)::int n, SUM(total)::float8 t FROM ventas
                 WHERE negocio_id = $1 AND fecha >= date_trunc('month', now())
                 GROUP BY d ORDER BY d`, [nid])],
    ['Lista de negocios del panel', () =>
      db.rows('SELECT id, codigo, nombre FROM negocios WHERE eliminado_en IS NULL ORDER BY nombre')],
  ];
  for (const [nombre, fn] of pruebas) {
    await fn();                       // una vez para calentar
    const t = crono();
    for (let i = 0; i < 20; i++) await fn();
    console.log(`  ${nombre.padEnd(42)} ${ms(t() / 20)}`);
  }
  return nid;
}

/** Lo importante: que una pollería no pague por las otras 49. */
async function revisarPlanes(nid) {
  console.log('\n── ¿LAS CONSULTAS USAN ÍNDICE? ──');
  const casos = [
    ['Ventas de un negocio por fecha',
      `SELECT * FROM ventas WHERE negocio_id = '${nid}' AND fecha >= now() - interval '30 days'`],
    ['Piezas de un negocio',
      `SELECT * FROM piezas WHERE negocio_id = '${nid}' AND activo = TRUE`],
  ];
  let problemas = 0;
  for (const [nombre, sql] of casos) {
    const filas = await db.rows('EXPLAIN ' + sql);
    const plan = filas.map((f) => Object.values(f)[0]).join(' ');
    const usaIndice = /Index Scan|Bitmap/i.test(plan);
    console.log(`  ${usaIndice ? '✔' : '✘'} ${nombre.padEnd(36)} ${plan.split('\n')[0].slice(0, 60)}`);
    if (!usaIndice) problemas++;
  }
  if (problemas) {
    console.log('\n  ⚠ Alguna consulta recorre la tabla completa. Con meses de ventas');
    console.log('    eso se siente en la caja: hace falta un índice por negocio_id.');
  }
  return problemas;
}

async function limpiar() {
  console.log('\nBorrando las pollerías de prueba…');
  const lista = await db.rows(`SELECT id FROM negocios WHERE codigo LIKE '${PREFIJO}%'`);
  for (const n of lista) {
    await db.query('DELETE FROM venta_items WHERE venta_id IN (SELECT id FROM ventas WHERE negocio_id = $1)', [n.id]);
    await db.query('DELETE FROM ventas WHERE negocio_id = $1', [n.id]);
    await db.query('DELETE FROM compra_despiece WHERE compra_id IN (SELECT id FROM compras WHERE negocio_id = $1)', [n.id]);
    await db.query('DELETE FROM compras WHERE negocio_id = $1', [n.id]);
    await db.query('DELETE FROM inventario WHERE negocio_id = $1', [n.id]);
    await db.query('DELETE FROM cortes WHERE negocio_id = $1', [n.id]);
    await db.query('DELETE FROM piezas WHERE negocio_id = $1', [n.id]);
    await db.query('DELETE FROM usuarios WHERE negocio_id = $1', [n.id]);
    await db.query('DELETE FROM negocios WHERE id = $1', [n.id]);
  }
  console.log(`  ${lista.length} pollería(s) de prueba borrada(s).`);
}

(async () => {
  await db.init();
  if (process.argv.includes('--limpiar')) { await limpiar(); process.exit(0); }
  await sembrar();
  const nid = await medir();
  const problemas = await revisarPlanes(nid);
  console.log('\nPara borrar lo que creó esta prueba:  npm run carga -- --limpiar\n');
  process.exitCode = problemas ? 1 : 0;
  process.exit(process.exitCode);
})();
