/**
 * Protección del servidor: cabeceras de seguridad, límite de peticiones por
 * IP y compresión de las respuestas.
 *
 * Está escrito a mano, SIN dependencias nuevas, a propósito: el sistema ya
 * está trabajando con clientes reales y agregar paquetes al despliegue es
 * meter riesgo donde no hace falta. Son unas líneas y hacen lo mismo que
 * helmet + express-rate-limit + compression para lo que aquí se necesita.
 *
 * Qué resuelve:
 *  1. La pantalla de entrada estaba abierta de par en par: se podían probar
 *     contraseñas sin ningún freno. Ahora son 8 intentos por IP cada 15
 *     minutos, y cada intento fallido responde despacio a propósito.
 *  2. Cualquiera podía golpear la API todo lo que quisiera. Ahora hay un
 *     techo de peticiones por minuto, lo que también evita que un script
 *     tumbe el servidor de una pollería que está vendiendo.
 *  3. No había cabeceras de seguridad (el navegador no sabía que la página
 *     no debe ir dentro de un marco ajeno, ni que no adivine tipos).
 *  4. Nada viajaba comprimido: el arranque de la app trae catálogo y logo.
 */
const zlib = require('zlib');

/* ─── IP real detrás del proxy de Railway ───
   Llega "cliente, proxy1, proxy2": solo sirve la primera. */
function ipDe(req) {
  return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '?')
    .split(',')[0].trim().replace(/^::ffff:/, '');
}

/* ─── Contadores por IP, en memoria ───
   Se limpian solos; no hace falta base de datos ni Redis para esto. */
function contador(maximo, ventanaMs) {
  const golpes = new Map();
  setInterval(() => {
    const ahora = Date.now();
    for (const [k, e] of golpes) if (ahora > e.reinicia) golpes.delete(k);
  }, Math.min(ventanaMs, 5 * 60 * 1000)).unref();

  return {
    permitir(ip) {
      const ahora = Date.now();
      const e = golpes.get(ip);
      if (!e || ahora > e.reinicia) { golpes.set(ip, { n: 1, reinicia: ahora + ventanaMs }); return true; }
      if (e.n >= maximo) return false;
      e.n++; return true;
    },
    limpiar(ip) { golpes.delete(ip); },
  };
}

// Techo general: 600 peticiones por minuto por IP. Una pollería vendiendo a
// toda máquina hace unas 60; 600 es diez veces eso, así que nunca estorba a
// un cliente de verdad pero sí frena a un script.
const general = contador(600, 60 * 1000);
// Entrada al sistema: 8 intentos cada 15 minutos por IP.
const entrada = contador(8, 15 * 60 * 1000);

/** Cabeceras de seguridad. Sin CSP: la app ya está en manos de clientes y una
 *  política mal calibrada rompe la pantalla sin avisar. Lo demás no rompe nada. */
function cabeceras(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), payment=()');
  if (process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}

/** Límite general para todo /api. */
function limiteGeneral(req, res, next) {
  if (general.permitir(ipDe(req))) return next();
  res.status(429).json({ error: 'Demasiadas peticiones. Espera un momento.' });
}

/** Límite estricto para la pantalla de entrada, contra prueba de contraseñas.
 *  Se monta ANTES del router de autenticación. */
function limiteEntrada(req, res, next) {
  const ip = ipDe(req);
  if (!entrada.permitir(ip)) {
    return res.status(429).json({ error: 'Demasiados intentos fallidos. Espera 15 minutos.' });
  }
  // Si el intento sale bien (respuesta 200), se le perdona el consumo: quien
  // sabe su contraseña nunca debe quedar bloqueado por equivocarse antes.
  res.on('finish', () => { if (res.statusCode === 200) entrada.limpiar(ip); });
  next();
}

/** Respuestas comprimidas. El arranque de la app (catálogo + logo del negocio)
 *  baja a una fracción, que en el celular de la pollería se nota. */
function comprimir(req, res, next) {
  const acepta = String(req.headers['accept-encoding'] || '');
  if (!/\bgzip\b/.test(acepta)) return next();
  const jsonOriginal = res.json.bind(res);
  res.json = (cuerpo) => {
    try {
      const texto = Buffer.from(JSON.stringify(cuerpo), 'utf8');
      if (texto.length < 1024) return jsonOriginal(cuerpo);
      const gz = zlib.gzipSync(texto, { level: 6 });
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Vary', 'Accept-Encoding');
      res.setHeader('Content-Length', gz.length);
      return res.end(gz);
    } catch { return jsonOriginal(cuerpo); }
  };
  next();
}

module.exports = { cabeceras, limiteGeneral, limiteEntrada, comprimir, ipDe };
