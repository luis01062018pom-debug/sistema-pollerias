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
      ssl: process.env.PGSSL === 'false' ? undefined : { rejectUnauthorized: false },
      // Con pocas conexiones alcanza y sobra para 70 pollerías, y así Postgres
      // no se queda sin cupo. Los tiempos de espera evitan que una consulta
      // atorada deje la caja esperando para siempre.
      max: Number(process.env.PG_MAX) || 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 8000,
      statement_timeout: 15000,
      query_timeout: 15000,
    });
    // Una conexión que se cae sola (reinicio de Postgres, red) emite 'error'.
    // Sin este manejador, Node se lleva el proceso entero por delante.
    _pool.on('error', (e) => console.error('[db] conexión inactiva perdida:', e.message));
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
  // (Aquí vivía una migración que forzaba la paleta gris en cualquier negocio
  //  con el naranja viejo. Ya cumplió, y ahora estorbaría: con los temas, un
  //  cliente puede querer justo ese naranja y no debe cambiársele solo.)
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
