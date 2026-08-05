const express = require('express');
const path = require('path');
const db = require('./src/db');
const { seed } = require('./src/seed');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '5mb' })); // logos en base64

// El orden importa: el router de la app (./src/routes/app) trae el bloqueo por
// falta de pago, y ni el panel de superadmin ni la pantalla para pagar deben
// pasar por él. Por eso van montados antes.
app.use('/api', require('./src/routes/auth'));
app.use('/api/suscripcion', require('./src/routes/suscripcion'));
app.use('/api/socios', require('./src/routes/socios'));
app.use('/api/admin', require('./src/routes/admin'));
app.use('/api', require('./src/routes/app'));

app.use(express.static(path.join(__dirname, 'public')));
app.get('/salud', (req, res) => res.json({ ok: true }));

(async () => {
  try {
    await db.init();
    await seed();
    app.listen(PORT, () => console.log('Sistema de pollerías escuchando en http://localhost:' + PORT));
  } catch (e) {
    console.error('Error fatal al iniciar:', e);
    process.exit(1);
  }
})();
