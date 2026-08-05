const fs = require('fs');
const path = require('path');

let _query = null;
let _exec = null;
let _pool = null;      // Postgres real (producción)
let _pglite = null;    // Postgres embebido (desarrollo)

async function init() {
  if (process.env.DATABASE_URL) {
    const { Pool } = require('pg');
    _pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSL === 'false' ? undefined : { rejectUnauthorized: false }
    });
    _query = (text, params) => _pool.query(text, params);
    _exec = (sql) => _pool.query(sql);
    console.log('[db] Conectado a Postgres (DATABASE_URL)');
  } else {
    const { PGlite } = await import('@electric-sql/pglite');
    const dataDir = path.join(__dirname, '..', 'data-dev');
    _pglite = new PGlite(dataDir);
    await _pglite.waitReady;
    _query = (text, params) => _pglite.query(text, params);
    _exec = (sql) => _pglite.exec(sql);
    console.log('[db] Usando PGlite local en ' + dataDir + ' (modo desarrollo)');
  }
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await _exec(schema);
  // Migración: negocios creados con la paleta naranja original pasan a la paleta elegante
  await _query(
    `UPDATE negocios SET color_primario = '#263949', color_secundario = '#16222e'
     WHERE color_primario = '#e8590c'`);
}

function query(text, params) {
  return _query(text, params);
}

async function one(text, params) {
  const r = await _query(text, params);
  return r.rows[0] || null;
}

async function rows(text, params) {
  const r = await _query(text, params);
  return r.rows;
}

/**
 * Todo o nada. Se usa donde varios cambios tienen que pasar juntos: aprobar
 * un pago suma el mes a la fecha de corte Y registra el ingreso; si una de
 * las dos fallara sin transacción, quedaría un pago cobrado sin mes, o un
 * mes regalado sin ingreso en la contabilidad.
 */
async function transaccion(fn) {
  if (_pool) {
    const cx = await _pool.connect();
    try {
      await cx.query('BEGIN');
      const r = await fn({ query: (t, p) => cx.query(t, p) });
      await cx.query('COMMIT');
      return r;
    } catch (e) {
      await cx.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      cx.release();
    }
  }
  return _pglite.transaction((tx) => fn({ query: (t, p) => tx.query(t, p) }));
}

module.exports = { init, query, one, rows, transaccion };
