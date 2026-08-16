/**
 * Copia recuperable de las contraseñas.
 *
 * El hash con el que se entra (bcrypt) NO se puede revertir: para eso está.
 * Pero "se me perdió la contraseña" es la llamada más común de los clientes,
 * y quien vende el sistema tiene que poder volver a dictársela sin cambiarla.
 *
 * Por eso, además del hash, se guarda una SEGUNDA copia cifrada con
 * AES-256-GCM. Solo se descifra desde el panel de fundadores (por el puente
 * de socios, servidor a servidor). El cliente nunca la ve, y en la base no
 * queda texto legible.
 *
 * La llave sale de CRED_KEY; si no está, de JWT_SECRET (que en el servidor
 * siempre está puesta y no cambia). Si un día se rota esa variable, las
 * copias viejas dejan de poder leerse: no se rompe nada, simplemente el
 * panel dirá que hay que generar una contraseña nueva.
 */
const crypto = require('crypto');

let avisado = false;
function llave() {
  // En el servidor JWT_SECRET siempre está (sin ella el sistema no arranca).
  // En la computadora de desarrollo puede no estar, y entonces se usa una
  // llave de mentira: así lo que se prueba aquí se comporta igual que allá.
  let base = process.env.CRED_KEY || process.env.JWT_SECRET || '';
  if (!base) {
    const enProduccion = !!(process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT);
    if (enProduccion) {
      if (!avisado) { avisado = true; console.warn('⚠  Sin CRED_KEY ni JWT_SECRET: no se podrán recuperar contraseñas.'); }
      return null;
    }
    base = 'llave-de-desarrollo-no-usar-en-produccion';
  }
  return crypto.createHash('sha256').update('credenciales:' + base).digest();
}

function cifrar(texto) {
  const k = llave();
  if (!k || !texto) return null;
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', k, iv);
  const datos = Buffer.concat([c.update(String(texto), 'utf8'), c.final()]);
  return [iv.toString('base64'), c.getAuthTag().toString('base64'), datos.toString('base64')].join('.');
}

function descifrar(guardado) {
  try {
    const k = llave();
    if (!k || !guardado) return null;
    const [iv, tag, datos] = String(guardado).split('.');
    const d = crypto.createDecipheriv('aes-256-gcm', k, Buffer.from(iv, 'base64'));
    d.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([d.update(Buffer.from(datos, 'base64')), d.final()]).toString('utf8');
  } catch { return null; }
}

/** Contraseña fácil de dictar por teléfono: sin 0/O ni 1/l/I. */
function claveLegible(largo = 10) {
  const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const num = '23456789';
  const todo = abc + abc.toLowerCase() + num;
  let s = abc[crypto.randomInt(abc.length)];
  for (let i = 1; i < largo - 1; i++) s += todo[crypto.randomInt(todo.length)];
  return s + num[crypto.randomInt(num.length)];
}

module.exports = { cifrar, descifrar, claveLegible };
