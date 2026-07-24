const fs = require('fs');
const path = require('path');

let _query = null;
let _exec = null;

async function init() {
  if (process.env.DATABASE_URL) {
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSL === 'false' ? undefined : { rejectUnauthorized: false }
    });
    _query = (text, params) => pool.query(text, params);
    _exec = (sql) => pool.query(sql);
    console.log('[db] Conectado a Postgres (DATABASE_URL)');
  } else {
    const { PGlite } = await import('@electric-sql/pglite');
    const dataDir = path.join(__dirname, '..', 'data-dev');
    const db = new PGlite(dataDir);
    await db.waitReady;
    _query = (text, params) => db.query(text, params);
    _exec = (sql) => db.exec(sql);
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

module.exports = { init, query, one, rows };
