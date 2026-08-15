const express = require('express');
const path = require('path');
const db = require('./src/db');
const { seed } = require('./src/seed');

const app = express();
const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');
app.set('trust proxy', 1); // Railway va detrás de un proxy

// Protección: cabeceras de seguridad, techo de peticiones por IP y respuestas
// comprimidas. Va ANTES de todo lo demás para que ninguna ruta se lo salte.
const proteccion = require('./src/proteccion');
app.use(proteccion.cabeceras);
app.use('/api', proteccion.limiteGeneral);
app.use(proteccion.comprimir);
// La pantalla de entrada aparte, con freno estricto: es la puerta y la que
// más se golpea cuando alguien anda probando contraseñas.
app.use('/api/login', proteccion.limiteEntrada);

app.use(express.json({ limit: '6mb' })); // logos e iconos en base64

// El orden importa: el router de la app (./src/routes/app) trae el bloqueo por
// falta de pago, y ni el panel de superadmin ni la pantalla para pagar deben
// pasar por él. Por eso van montados antes.
app.use('/api/publico', require('./src/routes/publico'));
app.use('/api', require('./src/routes/auth'));
app.use('/api/suscripcion', require('./src/routes/suscripcion'));
app.use('/api/socios', require('./src/routes/socios'));
app.use('/api/admin', require('./src/routes/admin'));
app.use('/api', require('./src/routes/app'));

app.use(express.static(path.join(__dirname, 'public'), {
  // El cascarón lo maneja el service worker (red primero, caché si no hay
  // internet). Los iconos sí pueden reposar en la caché del navegador.
  setHeaders(res, ruta) {
    if (/[\\/](sw\.js|index\.html|manifest\.json)$/.test(ruta)) {
      res.setHeader('Cache-Control', 'no-cache');
    } else if (/[\\/]icons[\\/]/.test(ruta)) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
  },
}));
app.get('/salud', (req, res) => res.json({ ok: true, hora: new Date().toISOString() }));

// Cualquier /api que no exista responde JSON, no el index.html
app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

/**
 * Último filtro. Con `seguro()` en cada router, un error de una ruta llega
 * aquí en vez de reventar el proceso: se pierde ESA petición y la pollería
 * sigue vendiendo.
 */
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[error]', req.method, req.originalUrl, '->', err && err.message);
  if (res.headersSent) return;
  res.status(err && err.status === 400 ? 400 : 500)
     .json({ error: 'Se atoró el servidor con esa operación. Vuelve a intentar.' });
});

/* Un error suelto (una promesa que nadie atrapó, una excepción rara) NO debe
   apagar el sistema a media venta. Se anota en la bitácora y se sigue. */
process.on('unhandledRejection', (e) => console.error('[promesa sin atrapar]', e));
process.on('uncaughtException', (e) => console.error('[excepción suelta]', e));

(async () => {
  try {
    await db.init();
    await seed();
    const servidor = app.listen(PORT, () =>
      console.log('Sistema de pollerías escuchando en http://localhost:' + PORT));

    // Railway manda SIGTERM en cada despliegue: cerrar bonito evita cortar
    // una venta que iba a la mitad.
    for (const senal of ['SIGTERM', 'SIGINT']) {
      process.on(senal, () => {
        console.log('Cerrando por ' + senal + '…');
        servidor.close(() => process.exit(0));
        setTimeout(() => process.exit(0), 8000).unref();
      });
    }
  } catch (e) {
    console.error('Error fatal al iniciar:', e);
    process.exit(1);
  }
})();
