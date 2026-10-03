/**
 * VOLCADO DE UN NEGOCIO — todo lo de UN cliente en un archivo, y de vuelta.
 *
 * Tiendas y pollerías guardan a todos sus clientes en la misma base de
 * Postgres. El respaldo general sirve para recuperar el sistema completo,
 * pero no para lo que de verdad pasa: "a la tienda X se le borró algo,
 * regrésenla a como estaba ayer" SIN tocar a las otras 59. Para eso es esto.
 *
 * Qué entra: el renglón del negocio, todas las tablas que tienen su columna
 * (tienda_id / negocio_id) y las tablas "hijas" que cuelgan de ellas sin
 * tener la columna (las partidas de una venta, el despiece de una compra).
 * Las tablas NO se listan a mano: se le preguntan a la base, así una tabla
 * nueva entra sola al respaldo el día que se agregue.
 *
 * Cómo se escribe: renglón por renglón directo a un compresor, en tandas
 * con un cursor. La memoria que usa es la del archivo YA comprimido, no la
 * de todos los datos: un negocio con años de ventas no ahoga al servidor.
 *
 * Este archivo es IDÉNTICO en el sistema de tiendas y en el de pollerías.
 */
const zlib = require('zlib');
const crypto = require('crypto');

const POR_TANDA = 500;
const J = (v) => JSON.stringify(v);
const NOMBRE_SEGURO = /^[a-z0-9_]+$/;
// Las bitácoras de respaldos no son datos de ningún negocio (y la de
// pollerías tiene una columna negocio_id que la haría parecer de uno).
const SIEMPRE_FUERA = ['respaldos', 'respaldos_negocios'];

/** Las tablas de un negocio y la condición para sacar SUS renglones. */
async function tablasDelNegocio(cx, { raiz, columna, omitir: omitirPedidas = [] }) {
  const omitir = [...SIEMPRE_FUERA, ...omitirPedidas];
  const { rows: cols } = await cx.query(
    `SELECT c.table_name AS tabla
       FROM information_schema.columns c
       JOIN information_schema.tables t
         ON t.table_schema = c.table_schema AND t.table_name = c.table_name
      WHERE c.table_schema = 'public' AND c.column_name = $1 AND t.table_type = 'BASE TABLE'
      ORDER BY 1`, [columna]);
  const directas = cols.map((r) => r.tabla)
    .filter((t) => NOMBRE_SEGURO.test(t) && t !== raiz && !omitir.includes(t));

  // Las hijas: no tienen la columna del negocio, pero tienen una llave
  // foránea hacia una tabla que sí la tiene.
  const fks = (await llavesForaneas(cx)).sort((a, b) => a.hija.localeCompare(b.hija) || a.col.localeCompare(b.col));
  // Una hija puede colgar de varias madres (la partida de una venta apunta
  // a la venta Y a la pieza, y la pieza puede venir vacía): entra si es del
  // negocio por CUALQUIERA de sus llaves.
  const hijas = new Map();
  for (const fk of fks) {
    if (fk.hija === raiz || directas.includes(fk.hija) || omitir.includes(fk.hija)) continue;
    if (!directas.includes(fk.padre)) continue;
    if (![fk.hija, fk.col, fk.padre, fk.col_padre].every((n) => NOMBRE_SEGURO.test(n))) continue;
    if (!hijas.has(fk.hija)) hijas.set(fk.hija, []);
    hijas.get(fk.hija).push(`"${fk.col}" IN (SELECT "${fk.col_padre}" FROM "${fk.padre}" WHERE "${columna}" = $ID)`);
  }

  return [
    { tabla: raiz, donde: '"id" = $ID' },
    ...directas.map((t) => ({ tabla: t, donde: `"${columna}" = $ID` })),
    ...[...hijas].map(([tabla, condiciones]) => ({ tabla, donde: condiciones.map((c) => `(${c})`).join(' OR ') })),
  ];
}

/** Las llaves foráneas del esquema público: [{ hija, col, padre, col_padre }]. */
async function llavesForaneas(cx) {
  const { rows } = await cx.query(
    `SELECT tc.table_name AS hija, kcu.column_name AS col, ccu.table_name AS padre, ccu.column_name AS col_padre
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
       JOIN information_schema.constraint_column_usage ccu
         ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'`);
  return rows;
}

/**
 * Ordena las tablas para que cada una vaya DESPUÉS de las que referencia
 * (primero las madres, luego las hijas). Así al meter datos ninguna choca
 * con una llave foránea, y al borrar basta con recorrer al revés. Si hubiera
 * un ciclo (dos tablas que se apuntan entre sí), esas van al final y las
 * resuelven los reintentos.
 */
function ordenarPorDependencias(nombres, fks) {
  const pendientes = new Set(nombres);
  const madres = new Map(nombres.map((n) => [n, new Set()]));
  for (const fk of fks) {
    if (fk.hija !== fk.padre && pendientes.has(fk.hija) && pendientes.has(fk.padre)) madres.get(fk.hija).add(fk.padre);
  }
  const orden = [];
  while (pendientes.size) {
    const listas = [...pendientes].filter((n) => [...madres.get(n)].every((m) => !pendientes.has(m)));
    if (!listas.length) { orden.push(...pendientes); break; }
    for (const n of listas) { orden.push(n); pendientes.delete(n); }
  }
  return orden;
}

/** El id va escrito en la consulta del cursor, así que se valida aquí. */
function idSeguro(id) {
  const t = String(id);
  if (/^\d{1,12}$/.test(t)) return t;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t)) return `'${t}'`;
  throw new Error('Identificador de negocio inválido');
}

/** Un renglón listo para JSON: los bytes (fotos) viajan en base64. */
function aJSON(fila) {
  const limpia = {};
  for (const [k, v] of Object.entries(fila)) {
    limpia[k] = (Buffer.isBuffer(v) || v instanceof Uint8Array)
      ? { __bytea: Buffer.from(v).toString('base64') } : v;
  }
  return limpia;
}

/**
 * Vuelca UN negocio. `cx` debe venir dentro de una transacción (para que
 * todas las tablas se lean del mismo instante y para poder usar cursores).
 * Devuelve { contenido (gzip), filas, resumen, huella }.
 * La huella resume SOLO los datos (sin la fecha del archivo): si no cambió
 * nada desde el último respaldo, sale igual y no hace falta subirlo otra vez.
 */
async function volcarNegocio(cx, { sistema, raiz, columna, id, nombre, omitir }) {
  const literal = idSeguro(id);
  const tablas = await tablasDelNegocio(cx, { raiz, columna, omitir });

  const gz = zlib.createGzip({ level: 6 });
  const trozos = [];
  gz.on('data', (c) => trozos.push(c));
  const terminado = new Promise((ok, mal) => { gz.on('end', ok); gz.on('error', mal); });
  const escribir = (texto) => new Promise((ok) => { if (gz.write(texto)) ok(); else gz.once('drain', ok); });
  const huella = crypto.createHash('sha256');

  const resumen = {};
  let filas = 0;
  await escribir(`{"formato":"respaldo-negocio","version":1,"sistema":${J(sistema)},`
    + `"negocio":${J({ id: String(id), nombre })},"raiz":${J(raiz)},"columna":${J(columna)},`
    + `"creado_en":${J(new Date().toISOString())},"tablas":{`);

  for (let i = 0; i < tablas.length; i++) {
    const t = tablas[i];
    await escribir(`${i ? ',' : ''}${J(t.tabla)}:[`);
    let n = 0;
    await cx.query(`DECLARE volcado NO SCROLL CURSOR FOR SELECT * FROM "${t.tabla}" WHERE ${t.donde.replace(/\$ID/g, literal)}`);
    try {
      for (;;) {
        const { rows } = await cx.query(`FETCH ${POR_TANDA} FROM volcado`);
        for (const fila of rows) {
          const texto = J(aJSON(fila));
          huella.update(t.tabla).update(texto);
          await escribir(`${n ? ',' : ''}${texto}`);
          n++;
        }
        if (rows.length < POR_TANDA) break;
      }
    } finally {
      await cx.query('CLOSE volcado').catch(() => {});
    }
    await escribir(']');
    resumen[t.tabla] = n;
    filas += n;
  }
  await escribir(`},"resumen":${J(resumen)},"filas":${filas}}`);
  gz.end();
  await terminado;

  if (!resumen[raiz]) throw new Error('Ese negocio no existe en la base');
  return { contenido: Buffer.concat(trozos), filas, resumen, huella: huella.digest('hex') };
}

/**
 * Vuelca la base COMPLETA (todas las tablas), con el mismo escritor por
 * tandas. Es la foto del sistema entero: lo que no es de ningún negocio
 * (nuestros gastos, los administradores) también queda a salvo.
 */
async function volcarSistema(cx, { sistema, omitir: omitirPedidas = [] }) {
  const omitir = [...SIEMPRE_FUERA, ...omitirPedidas];
  const { rows } = await cx.query(
    `SELECT table_name AS tabla FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY 1`);
  const tablas = rows.map((r) => r.tabla).filter((t) => NOMBRE_SEGURO.test(t) && !omitir.includes(t));
  const gz = zlib.createGzip({ level: 6 });
  const trozos = [];
  gz.on('data', (c) => trozos.push(c));
  const terminado = new Promise((ok, mal) => { gz.on('end', ok); gz.on('error', mal); });
  const escribir = (texto) => new Promise((ok) => { if (gz.write(texto)) ok(); else gz.once('drain', ok); });
  const resumen = {};
  let filas = 0;
  await escribir(`{"formato":"respaldo-sistema","version":1,"sistema":${J(sistema)},"creado_en":${J(new Date().toISOString())},"tablas":{`);
  for (let i = 0; i < tablas.length; i++) {
    await escribir(`${i ? ',' : ''}${J(tablas[i])}:[`);
    let n = 0;
    await cx.query(`DECLARE volcado NO SCROLL CURSOR FOR SELECT * FROM "${tablas[i]}"`);
    try {
      for (;;) {
        const { rows: lote } = await cx.query(`FETCH ${POR_TANDA} FROM volcado`);
        for (const fila of lote) { await escribir(`${n ? ',' : ''}${J(aJSON(fila))}`); n++; }
        if (lote.length < POR_TANDA) break;
      }
    } finally {
      await cx.query('CLOSE volcado').catch(() => {});
    }
    await escribir(']');
    resumen[tablas[i]] = n;
    filas += n;
  }
  await escribir(`},"resumen":${J(resumen)},"filas":${filas}}`);
  gz.end();
  await terminado;
  return { contenido: Buffer.concat(trozos), filas, resumen };
}

/** Abre un volcado (ya descifrado): devuelve el objeto con sus tablas. */
function leerVolcado(gzip) {
  const datos = JSON.parse(zlib.gunzipSync(gzip).toString('utf8'));
  if (datos.formato !== 'respaldo-negocio') throw new Error('Ese archivo no es el respaldo de un negocio');
  return datos;
}

/**
 * Regresa UN negocio a como estaba en el volcado, sin tocar a los demás.
 * `cx` debe venir dentro de una transacción y con permiso de borrar: si algo
 * falla a la mitad, no queda nada a medias (todo o nada).
 *
 * 1. Borra lo que ese negocio tiene hoy (hijas primero).
 * 2. Mete lo del respaldo, por tandas de mil renglones.
 * 3. Lo que apunte a algo que ya no existe FUERA del negocio (un producto
 *    del diccionario que se rearmó, el administrador que aprobó un pago y
 *    ya no está) se deja en blanco en vez de impedir la restauración.
 * 4. Los contadores de folios (secuencias) se ponen arriba del id mayor.
 */
async function restaurarNegocio(cx, datos) {
  const { raiz, columna, negocio } = datos;
  if (![raiz, columna].every((n) => NOMBRE_SEGURO.test(n))) throw new Error('Respaldo con nombres inválidos');
  const literal = idSeguro(negocio.id);
  const tablas = await tablasDelNegocio(cx, { raiz, columna });
  const enRespaldo = Object.keys(datos.tablas).filter((t) => NOMBRE_SEGURO.test(t));
  const conocidas = new Set(tablas.map((t) => t.tabla));
  const extranas = enRespaldo.filter((t) => !conocidas.has(t));
  if (extranas.length) throw new Error(`El respaldo trae tablas que esta base no tiene: ${extranas.join(', ')}`);

  const fks = await llavesForaneas(cx);
  const orden = ordenarPorDependencias(tablas.map((t) => t.tabla), fks);

  // 1. Borrar lo de hoy: hijas primero (el orden al revés). Si aun así algo
  //    choca, se reintenta en la siguiente vuelta.
  const borrado = {};
  let pendientes = [...orden].reverse().map((n) => tablas.find((t) => t.tabla === n));
  for (let vuelta = 0; vuelta < 15 && pendientes.length; vuelta++) {
    const atoradas = [];
    for (const t of pendientes) {
      await cx.query('SAVEPOINT paso');
      try {
        const r = await cx.query(`DELETE FROM "${t.tabla}" WHERE ${t.donde.replace(/\$ID/g, literal)}`);
        await cx.query('RELEASE SAVEPOINT paso');
        borrado[t.tabla] = (borrado[t.tabla] || 0) + Number(r.rowCount ?? r.affectedRows ?? 0);
      } catch (e) {
        await cx.query('ROLLBACK TO SAVEPOINT paso');
        if (e.code !== '23503') throw e;
        atoradas.push(t);
      }
    }
    if (atoradas.length === pendientes.length) throw new Error('No se pudo limpiar el negocio antes de restaurar: hay datos enlazados.');
    pendientes = atoradas;
  }

  // Tipos de columna (para los bytes y el JSON) y llaves foráneas hacia
  // tablas que NO vienen en el respaldo.
  const { rows: tipos } = await cx.query(
    `SELECT table_name AS tabla, column_name AS col, data_type AS tipo, column_default AS defecto
       FROM information_schema.columns WHERE table_schema = 'public'`);
  const avisos = [];

  // 2. Meter lo del respaldo: madres primero. La que aun así choque por
  //    una llave foránea se reintenta en la siguiente vuelta.
  const metido = {};
  let porMeter = orden.filter((t) => enRespaldo.includes(t) && (datos.tablas[t] || []).length);
  for (let vuelta = 0; vuelta < 15 && porMeter.length; vuelta++) {
    const atoradas = [];
    for (const tabla of porMeter) {
      const columnasTabla = tipos.filter((c) => c.tabla === tabla);
      const tipoDe = Object.fromEntries(columnasTabla.map((c) => [c.col, c.tipo]));
      let renglones = datos.tablas[tabla].map((fila) => {
        const r = {};
        for (const [k, v] of Object.entries(fila)) {
          if (!(k in tipoDe)) continue;    // columna que ya no existe: se ignora
          if (v && typeof v === 'object' && v.__bytea !== undefined) r[k] = `\\x${Buffer.from(v.__bytea, 'base64').toString('hex')}`;
          else r[k] = v;
        }
        return r;
      });

      // Referencias a tablas de fuera del negocio que ya no existen → en blanco.
      for (const fk of fks.filter((f) => f.hija === tabla && !enRespaldo.includes(f.padre))) {
        if (![fk.padre, fk.col_padre].every((n) => NOMBRE_SEGURO.test(n))) continue;
        const valores = [...new Set(renglones.map((r) => r[fk.col]).filter((v) => v !== null && v !== undefined))];
        if (!valores.length) continue;
        const { rows } = await cx.query(
          `SELECT "${fk.col_padre}"::text AS v FROM "${fk.padre}" WHERE "${fk.col_padre}"::text = ANY($1::text[])`,
          [valores.map(String)]);
        const existen = new Set(rows.map((x) => x.v));
        let blancos = 0;
        renglones = renglones.map((r) => {
          if (r[fk.col] === null || r[fk.col] === undefined || existen.has(String(r[fk.col]))) return r;
          blancos++;
          return { ...r, [fk.col]: null };
        });
        if (blancos) avisos.push(`${tabla}.${fk.col}: ${blancos} referencia(s) a ${fk.padre} que ya no existe(n) quedaron en blanco`);
      }

      await cx.query('SAVEPOINT paso');
      try {
        for (let i = 0; i < renglones.length; i += 1000) {
          await cx.query(
            `INSERT INTO "${tabla}" SELECT * FROM json_populate_recordset(NULL::"${tabla}", $1::json)`,
            [JSON.stringify(renglones.slice(i, i + 1000))]);
        }
        await cx.query('RELEASE SAVEPOINT paso');
        metido[tabla] = renglones.length;
      } catch (e) {
        await cx.query('ROLLBACK TO SAVEPOINT paso');
        if (e.code !== '23503') throw new Error(`No se pudo restaurar ${tabla}: ${e.message}`);
        atoradas.push(tabla);
      }
    }
    if (atoradas.length === porMeter.length) {
      throw new Error(`No se pudo restaurar (${atoradas.join(', ')}): hay datos que apuntan a otros que no están. No se cambió nada.`);
    }
    porMeter = atoradas;
  }

  // 4. Secuencias: que el próximo folio no choque con uno restaurado.
  for (const c of tipos.filter((x) => enRespaldo.includes(x.tabla) && /nextval\('/.test(String(x.defecto || '')))) {
    const secuencia = (String(c.defecto).match(/nextval\('([^']+)'/) || [])[1];
    if (!secuencia || !/^[a-z0-9_."]+$/i.test(secuencia) || !NOMBRE_SEGURO.test(c.col)) continue;
    await cx.query(
      `SELECT setval('${secuencia}', GREATEST((SELECT COALESCE(max("${c.col}"), 1) FROM "${c.tabla}"), (SELECT last_value FROM ${secuencia})))`);
  }

  return { borrado, metido, avisos };
}

module.exports = {
  tablasDelNegocio, volcarNegocio, volcarSistema, leerVolcado, restaurarNegocio, ordenarPorDependencias,
};
