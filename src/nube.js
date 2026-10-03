/**
 * NUBE — la copia de los respaldos FUERA de nuestro servidor.
 *
 * Por qué existe: un respaldo guardado en el mismo servidor (o en la misma
 * base de datos) no sirve el día que se pierde ese servidor. Aquí cada
 * negocio manda, una vez al día, una copia CIFRADA de sus datos a un
 * almacenamiento de archivos aparte (tipo "S3"). Si Railway desaparece
 * mañana, los datos de cada cliente siguen ahí.
 *
 * Funciona con cualquier almacenamiento compatible con S3. El recomendado es
 * Cloudflare R2: 10 GB gratis, sin cobro por bajar archivos, y la cuenta de
 * Cloudflare ya existe (ahí está el DNS). También sirven Backblaze B2 o AWS.
 *
 * Variables (las mismas en los tres sistemas):
 *   NUBE_ENDPOINT    https://<id-de-cuenta>.r2.cloudflarestorage.com
 *   NUBE_BUCKET      nombre del bucket (p. ej. respaldos-negocios)
 *   NUBE_ACCESS_KEY  ┐ la llave de API del bucket (solo lectura y
 *   NUBE_SECRET_KEY  ┘ escritura de objetos, nada más)
 *   NUBE_REGION      opcional; R2 usa "auto"
 *   NUBE_CLAVE       la contraseña con la que se CIFRA cada archivo. Sin ella
 *                    no se manda nada: Cloudflare (o quien robe la llave)
 *                    nunca puede leer los datos de un cliente.
 *                    ⚠ Anótala aparte: si se pierde, los respaldos no abren.
 *
 * Sin dependencias: la firma de las peticiones (AWS Signature V4) se hace
 * aquí con `crypto`. Este archivo es IDÉNTICO en tiendas, pollerías y
 * jarcerías; si se corrige algo, se copia a los tres.
 */
const crypto = require('crypto');

const TIEMPO_LIMITE = 120_000;

function config() {
  const endpoint = String(process.env.NUBE_ENDPOINT || '').replace(/\/+$/, '');
  return {
    endpoint,
    bucket: process.env.NUBE_BUCKET || '',
    llave: process.env.NUBE_ACCESS_KEY || '',
    secreto: process.env.NUBE_SECRET_KEY || '',
    region: process.env.NUBE_REGION || 'auto',
    clave: process.env.NUBE_CLAVE || '',
  };
}

/** ¿Está todo puesto para mandar respaldos fuera?
 *  `cifradoPropio`: el sistema ya cifra sus archivos por su cuenta (la
 *  jarcería, con BACKUP_PASSWORD) y no necesita NUBE_CLAVE. */
function configurada({ cifradoPropio = false } = {}) {
  const c = config();
  return Boolean(c.endpoint && c.bucket && c.llave && c.secreto && (cifradoPropio || c.clave));
}

/** Qué falta, en palabras, para enseñarlo en el panel. */
function queFalta({ cifradoPropio = false } = {}) {
  const c = config();
  const faltan = [];
  if (!c.endpoint) faltan.push('NUBE_ENDPOINT');
  if (!c.bucket) faltan.push('NUBE_BUCKET');
  if (!c.llave) faltan.push('NUBE_ACCESS_KEY');
  if (!c.secreto) faltan.push('NUBE_SECRET_KEY');
  if (!c.clave && !cifradoPropio) faltan.push('NUBE_CLAVE');
  return faltan;
}

// ── Firma AWS Signature V4 ────────────────────────────────────────────

const sha256 = (datos) => crypto.createHash('sha256').update(datos).digest('hex');
const hmac = (llave, texto) => crypto.createHmac('sha256', llave).update(texto).digest();

/** Codificación de S3: como encodeURIComponent pero también !'()*. */
function codificar(texto) {
  return encodeURIComponent(texto).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

/**
 * Firma una petición. Devuelve las cabeceras que hay que mandar.
 * `ruta` ya viene codificada; `consulta` es un objeto { nombre: valor }.
 */
function firmar({ metodo, host, ruta, consulta = {}, cabeceras = {}, hashCuerpo, fecha = new Date(),
  region, servicio = 's3', llave, secreto }) {
  const amzFecha = fecha.toISOString().replace(/[:-]|\.\d{3}/g, '');   // 20260102T030405Z
  const dia = amzFecha.slice(0, 8);
  const todas = { ...cabeceras, host, 'x-amz-date': amzFecha };
  if (servicio === 's3') todas['x-amz-content-sha256'] = hashCuerpo;

  const nombres = Object.keys(todas).map((n) => n.toLowerCase()).sort();
  const valores = Object.fromEntries(Object.entries(todas).map(([k, v]) => [k.toLowerCase(), String(v).trim().replace(/\s+/g, ' ')]));
  const cabecerasCanonicas = nombres.map((n) => `${n}:${valores[n]}\n`).join('');
  const firmadas = nombres.join(';');
  const consultaCanonica = Object.keys(consulta).sort()
    .map((k) => `${codificar(k)}=${codificar(String(consulta[k]))}`).join('&');

  const peticionCanonica = [metodo, ruta, consultaCanonica, cabecerasCanonicas, firmadas, hashCuerpo].join('\n');
  const alcance = `${dia}/${region}/${servicio}/aws4_request`;
  const aFirmar = ['AWS4-HMAC-SHA256', amzFecha, alcance, sha256(peticionCanonica)].join('\n');
  const llaveFirma = hmac(hmac(hmac(hmac(`AWS4${secreto}`, dia), region), servicio), 'aws4_request');
  const firma = crypto.createHmac('sha256', llaveFirma).update(aFirmar).digest('hex');

  const salida = { ...todas };
  delete salida.host;   // fetch la pone sola
  salida.authorization = `AWS4-HMAC-SHA256 Credential=${llave}/${alcance}, SignedHeaders=${firmadas}, Signature=${firma}`;
  return salida;
}

/** Una petición al bucket. `clave` es la ruta del archivo dentro del bucket. */
async function peticion(metodo, clave = '', { cuerpo, consulta = {}, tipo } = {}) {
  const c = config();
  if (!c.endpoint || !c.bucket || !c.llave || !c.secreto) throw new Error('La nube de respaldos no está configurada');
  const base = new URL(c.endpoint);
  // Estilo de ruta (endpoint/bucket/archivo): es el que acepta R2 y el que
  // no necesita DNS por bucket.
  const ruta = `${base.pathname.replace(/\/+$/, '')}/${codificar(c.bucket)}${clave ? '/' + clave.split('/').map(codificar).join('/') : ''}`;
  const datos = cuerpo === undefined ? Buffer.alloc(0) : Buffer.from(cuerpo);
  const cabeceras = tipo ? { 'content-type': tipo } : {};
  const firmadas = firmar({
    metodo, host: base.host, ruta, consulta, cabeceras,
    hashCuerpo: sha256(datos), region: c.region, llave: c.llave, secreto: c.secreto,
  });
  const qs = Object.keys(consulta).length
    ? '?' + Object.keys(consulta).sort().map((k) => `${codificar(k)}=${codificar(String(consulta[k]))}`).join('&') : '';

  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), TIEMPO_LIMITE);
  try {
    const res = await fetch(`${base.protocol}//${base.host}${ruta}${qs}`, {
      method: metodo,
      headers: firmadas,
      body: metodo === 'PUT' ? datos : undefined,
      signal: control.signal,
    });
    if (!res.ok && !(metodo === 'DELETE' && res.status === 404)) {
      const texto = await res.text().catch(() => '');
      const codigo = (texto.match(/<Code>([^<]+)<\/Code>/) || [])[1] || `HTTP ${res.status}`;
      const err = new Error(`La nube contestó ${codigo}`);
      err.status = res.status;
      throw err;
    }
    return res;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('La nube no contestó a tiempo');
    throw e;
  } finally {
    clearTimeout(reloj);
  }
}

const desescapar = (t) => String(t).replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

async function subir(clave, contenido, tipo = 'application/octet-stream') {
  await peticion('PUT', clave, { cuerpo: contenido, tipo });
  return { clave, tamano: contenido.length };
}

async function bajar(clave) {
  const res = await peticion('GET', clave);
  return Buffer.from(await res.arrayBuffer());
}

async function borrar(clave) {
  await peticion('DELETE', clave);
}

/** Todos los archivos bajo un prefijo: [{ clave, tamano, fecha }]. */
async function listar(prefijo) {
  const archivos = [];
  let token = null;
  for (let vuelta = 0; vuelta < 200; vuelta++) {
    const consulta = { 'list-type': '2', prefix: prefijo, 'max-keys': '1000' };
    if (token) consulta['continuation-token'] = token;
    const xml = await (await peticion('GET', '', { consulta })).text();
    for (const [, bloque] of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
      archivos.push({
        clave: desescapar((bloque.match(/<Key>([\s\S]*?)<\/Key>/) || [])[1] || ''),
        tamano: Number((bloque.match(/<Size>(\d+)<\/Size>/) || [])[1] || 0),
        fecha: (bloque.match(/<LastModified>([^<]+)<\/LastModified>/) || [])[1] || null,
      });
    }
    if (!/<IsTruncated>true<\/IsTruncated>/.test(xml)) break;
    token = desescapar((xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/) || [])[1] || '');
    if (!token) break;
  }
  return archivos;
}

// ── Cifrado de los archivos ──────────────────────────────────────────
// Formato: "NUB1" (4) + sal (16) + iv (12) + etiqueta (16) + datos.
// AES-256-GCM: además de cifrar, detecta si el archivo se alteró.
// La llave sale de NUBE_CLAVE con scrypt y una sal distinta por archivo.

const MAGIA = Buffer.from('NUB1');

function cifrar(contenido, clave = config().clave) {
  if (!clave) throw new Error('Falta NUBE_CLAVE para cifrar el respaldo');
  const sal = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const llave = crypto.scryptSync(clave, sal, 32);
  const c = crypto.createCipheriv('aes-256-gcm', llave, iv);
  const datos = Buffer.concat([c.update(contenido), c.final()]);
  return Buffer.concat([MAGIA, sal, iv, c.getAuthTag(), datos]);
}

function descifrar(archivo, clave = config().clave) {
  if (!clave) throw new Error('Falta la clave (NUBE_CLAVE) para abrir el respaldo');
  if (archivo.length < 48 || !archivo.subarray(0, 4).equals(MAGIA)) {
    throw new Error('Ese archivo no es un respaldo de la nube');
  }
  const sal = archivo.subarray(4, 20);
  const iv = archivo.subarray(20, 32);
  const etiqueta = archivo.subarray(32, 48);
  const llave = crypto.scryptSync(clave, sal, 32);
  const d = crypto.createDecipheriv('aes-256-gcm', llave, iv);
  d.setAuthTag(etiqueta);
  try {
    return Buffer.concat([d.update(archivo.subarray(48)), d.final()]);
  } catch {
    throw new Error('La clave no es la correcta o el archivo está dañado');
  }
}

// ── Dónde va cada archivo y cuánto se guarda ─────────────────────────
//
//   <sistema>/<negocio>/diario/AAAA-MM-DD.bak    uno por día, 35 días
//   <sistema>/<negocio>/mensual/AAAA-MM.bak      el primero de cada mes, SIEMPRE
//
// Así hay para volver a cualquier día del último mes y a cualquier mes de
// la historia del cliente, sin que el almacenamiento crezca sin control.

const DIAS_DIARIOS = 35;

const limpiarParte = (t) => String(t).toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 60) || 'x';
const prefijoDe = (sistema, negocio) => `${limpiarParte(sistema)}/${limpiarParte(negocio)}/`;

function fechaLocal(d = new Date()) {
  // La fecha del archivo es la de México, no la de Greenwich: el respaldo
  // de las 11 de la noche es "de hoy", no "de mañana".
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
}

/**
 * Sube el respaldo de un negocio y poda lo viejo.
 * `contenido` es el archivo SIN cifrar (normalmente JSON comprimido):
 * aquí se cifra antes de que salga del servidor.
 */
async function guardarRespaldo(sistema, negocio, contenido, { yaCifrado = false } = {}) {
  const archivo = yaCifrado ? contenido : cifrar(contenido);
  const prefijo = prefijoDe(sistema, negocio);
  const hoy = fechaLocal();
  const diario = `${prefijo}diario/${hoy}.bak`;
  await subir(diario, archivo);

  // El mensual se escribe una vez por mes (el primer respaldo del mes) y no
  // se vuelve a tocar: es la foto fija de ese mes.
  const mes = hoy.slice(0, 7);
  const lista = await listar(prefijo);
  const mensual = `${prefijo}mensual/${mes}.bak`;
  if (!lista.some((a) => a.clave === mensual)) await subir(mensual, archivo);

  // Poda: los diarios de más de 35 días se borran, pero NUNCA si eso deja
  // menos de 7 — si un negocio dejó de respaldar por un tiempo, no se le
  // borra lo único que tiene.
  const limite = fechaLocal(new Date(Date.now() - DIAS_DIARIOS * 86_400_000));
  const diarios = lista.filter((a) => a.clave.startsWith(`${prefijo}diario/`)).sort((a, b) => a.clave.localeCompare(b.clave));
  const viejos = diarios.filter((a) => a.clave.slice(-14, -4) < limite);
  const sobran = Math.max(0, Math.min(viejos.length, diarios.length - 7));
  for (const a of viejos.slice(0, sobran)) await borrar(a.clave).catch(() => {});

  return { clave: diario, tamano: archivo.length };
}

/** Los respaldos guardados de un negocio: primero los diarios del más nuevo
 *  al más viejo (la fecha va en el nombre), luego los mensuales. Así "el
 *  último" siempre es el diario de hoy, aunque el mensual se haya subido en
 *  el mismo segundo. */
async function respaldosDe(sistema, negocio) {
  const lista = await listar(prefijoDe(sistema, negocio));
  const rango = (a) => (a.clave.includes('/diario/') ? 0 : 1);
  return lista.sort((a, b) => rango(a) - rango(b) || b.clave.localeCompare(a.clave));
}

module.exports = {
  configurada, queFalta, subir, bajar, borrar, listar, cifrar, descifrar,
  guardarRespaldo, respaldosDe, prefijoDe, fechaLocal, firmar,
};
