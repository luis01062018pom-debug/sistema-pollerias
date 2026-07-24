const express = require('express');
const path = require('path');
const db = require('./src/db');
const { seed } = require('./src/seed');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '5mb' })); // logos en base64

app.use('/api', require('./src/routes/auth'));
app.use('/api', require('./src/routes/app'));
app.use('/api/admin', require('./src/routes/admin'));

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
