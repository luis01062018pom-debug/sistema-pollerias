/**
 * RESPALDOS DE LAS POLLERÍAS — fuera del servidor.
 *
 * Antes este sistema no tenía NINGÚN respaldo: si la base de Railway se
 * perdía, se perdía todo, empezando por FRESQUIPOLLO. Ahora:
 *
 *   · Cada pollería, una vez al día de madrugada, se vuelca a un archivo con
 *     SOLO sus datos (src/volcado.js), se cifra y se manda a la nube de
 *     respaldos (src/nube.js). 35 días de diarios + uno por mes para siempre.
 *   · Además, una vez al día, la base COMPLETA (lo que no es de ninguna
 *     pollería: nuestros gastos, los administradores) va a `polleria/_sistema`.
 *
 * Para no cargar el servidor: de madrugada (1 a 6 am de México), una
 * pollería tras otra con una pausa, y si no cambió nada desde ayer no se
 * vuelve a subir (salvo una vez por semana, como prueba de vida). Si pasan
 * 30 horas sin respaldo de alguna, se hace aunque sea de día.
 *
 * Restaurar UNA pollería sin tocar a las demás:
 *   node restaurar-negocio.js --nube <id> --verificar
 */
const { one, rows, query, transaccion } = require('./db');
const nube = require('./nube');
const { volcarNegocio, volcarSistema } = require('./volcado');

const SISTEMA = 'polleria';
const HORAS_ENTRE = 20;
const HORAS_ALERTA = 30;
const DIAS_PRUEBA_DE_VIDA = 7;
const PAUSA_MS = 1500;

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const horasDesde = (f) => (f ? (Date.now() - new Date(f).getTime()) / 3_600_000 : Infinity);

/** Una lectura de la base del mismo instante, sin escribir nada. */
function enFoto(fn) {
  return transaccion(async (cx) => {
    await cx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
    return fn(cx);
  });
}

async function anotar(id, campos) {
  await query(
    `INSERT INTO respaldos_negocios (negocio_id, ultimo_intento) VALUES ($1, now())
     ON CONFLICT (negocio_id) DO NOTHING`, [String(id)]);
  const pares = Object.entries(campos);
  if (!pares.length) return;
  const set = pares.map(([k], i) => `${k} = $${i + 2}`).join(', ');
  await query(`UPDATE respaldos_negocios SET ${set} WHERE negocio_id = $1`, [String(id), ...pares.map(([, v]) => v)]);
}

/** Respalda UNA pollería ahora. */
async function respaldarNegocio(id, { forzar = false } = {}) {
  const antes = await one('SELECT huella, ultima_subida FROM respaldos_negocios WHERE negocio_id = $1', [String(id)]);
  await anotar(id, { ultimo_intento: new Date() });
  try {
    const v = await enFoto(async (cx) => {
      const { rows: [n] } = await cx.query('SELECT nombre FROM negocios WHERE id = $1', [Number(id)]);
      if (!n) throw new Error('Esa pollería no existe');
      return volcarNegocio(cx, { sistema: SISTEMA, raiz: 'negocios', columna: 'negocio_id', id: Number(id), nombre: n.nombre });
    });
    const sinCambios = antes && antes.huella === v.huella && horasDesde(antes.ultima_subida) < DIAS_PRUEBA_DE_VIDA * 24;
    const subido = (!sinCambios || forzar) ? await nube.guardarRespaldo(SISTEMA, id, v.contenido) : null;
    await anotar(id, {
      ultimo_exito: new Date(), error: null, filas: v.filas, huella: v.huella,
      ...(subido ? { tamano: subido.tamano, clave: subido.clave, ultima_subida: new Date() } : {}),
    });
    return { ok: true, filas: v.filas, subido: !!subido, tamano: subido ? subido.tamano : null };
  } catch (e) {
    await anotar(id, { error: String(e.message).slice(0, 300) }).catch(() => {});
    throw e;
  }
}

/** La base completa, una vez al día. */
async function respaldarSistema() {
  const ultimo = await one("SELECT ultimo_exito FROM respaldos_negocios WHERE negocio_id = '_sistema'");
  if (ultimo && horasDesde(ultimo.ultimo_exito) < HORAS_ENTRE) return null;
  await anotar('_sistema', { ultimo_intento: new Date() });
  try {
    const v = await enFoto((cx) => volcarSistema(cx, { sistema: SISTEMA }));
    const subido = await nube.guardarRespaldo(SISTEMA, '_sistema', v.contenido);
    await anotar('_sistema', { ultimo_exito: new Date(), error: null, filas: v.filas, tamano: subido.tamano, clave: subido.clave, ultima_subida: new Date() });
    return subido;
  } catch (e) {
    await anotar('_sistema', { error: String(e.message).slice(0, 300) }).catch(() => {});
    throw e;
  }
}

let corriendo = false;

async function ronda({ todas = false } = {}) {
  if (corriendo || !nube.configurada()) return { hechas: 0 };
  corriendo = true;
  let hechas = 0;
  try {
    const hora = Number(new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City', hour: 'numeric', hour12: false }));
    const madrugada = hora >= 1 && hora < 6;
    const lista = await rows(
      `SELECT n.id, n.estado, r.ultimo_exito, r.ultimo_intento
         FROM negocios n LEFT JOIN respaldos_negocios r ON r.negocio_id = n.id::text
        ORDER BY r.ultimo_exito NULLS FIRST`);
    for (const n of lista) {
      const horas = horasDesde(n.ultimo_exito);
      if (n.estado === 'CANCELADA' && n.ultimo_exito) continue;   // ya no cambia
      const toca = todas || (madrugada && horas >= HORAS_ENTRE) || horas >= HORAS_ALERTA;
      if (!toca || (!todas && n.ultimo_intento && horasDesde(n.ultimo_intento) < 1)) continue;
      try { await respaldarNegocio(n.id); hechas++; } catch (e) { console.error(`[respaldo] pollería ${n.id}:`, e.message); }
      await dormir(PAUSA_MS);
    }
    if (todas || madrugada) await respaldarSistema().catch((e) => console.error('[respaldo] sistema:', e.message));
  } finally {
    corriendo = false;
  }
  if (hechas) console.log(`[respaldo] ${hechas} pollería(s) respaldada(s) en la nube`);
  return { hechas };
}

function programar() {
  if (!nube.configurada()) {
    console.warn(`[respaldo] SIN CONFIGURAR (faltan ${nube.queFalta().join(', ')}): los datos de las pollerías NO tienen copia fuera del servidor.`);
  }
  const vuelta = () => ronda().catch((e) => console.error('[respaldo]', e.message));
  setTimeout(vuelta, 3 * 60_000).unref?.();
  setInterval(vuelta, 60 * 60_000).unref?.();
}

async function estado() {
  const lista = await rows(
    `SELECT n.id, n.nombre, n.estado, r.ultimo_exito, r.ultima_subida, r.tamano, r.filas, r.error, r.ultimo_intento
       FROM negocios n LEFT JOIN respaldos_negocios r ON r.negocio_id = n.id::text
      WHERE n.estado <> 'CANCELADA'
      ORDER BY n.nombre`);
  return lista.map((r) => ({
    id: String(r.id),
    nombre: r.nombre,
    ultimo: r.ultimo_exito,
    ultima_subida: r.ultima_subida,
    tamano: r.tamano ? Number(r.tamano) : null,
    filas: r.filas,
    error: r.error && (!r.ultimo_exito || new Date(r.ultimo_intento) > new Date(r.ultimo_exito)) ? r.error : null,
    alerta: horasDesde(r.ultimo_exito) > HORAS_ALERTA,
  }));
}

module.exports = { respaldarNegocio, respaldarSistema, ronda, programar, estado, SISTEMA };
