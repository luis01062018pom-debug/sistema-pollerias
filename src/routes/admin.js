const express = require('express');
const bcrypt = require('bcryptjs');
const { query, one, rows } = require('../db');
const { requiereAuth, requiereRol } = require('../auth');
const { crearCatalogo } = require('../seed');

const router = express.Router();
router.use(requiereAuth, requiereRol('superadmin'));

router.get('/negocios', async (req, res) => {
  const lista = await rows(
    `SELECT n.id, n.codigo, n.nombre, n.color_primario, n.color_secundario, n.activo, n.flags, n.creado_en,
            (SELECT COUNT(*)::int FROM usuarios u WHERE u.negocio_id = n.id) AS usuarios,
            (SELECT COUNT(*)::int FROM ventas v WHERE v.negocio_id = n.id AND v.fecha::date = CURRENT_DATE) AS ventas_hoy
     FROM negocios n ORDER BY n.nombre`);
  for (const n of lista) n.flags = JSON.parse(n.flags || '{}');
  res.json(lista);
});

router.post('/negocios', async (req, res) => {
  try {
    const { codigo, nombre, dueno_nombre, dueno_usuario, dueno_password } = req.body || {};
    if (!codigo || !nombre || !dueno_usuario || !dueno_password) {
      return res.status(400).json({ error: 'Código, nombre del negocio, usuario y contraseña del dueño son requeridos' });
    }
    const cod = String(codigo).trim().toUpperCase();
    if (await one('SELECT id FROM negocios WHERE codigo = $1', [cod])) {
      return res.status(400).json({ error: 'Ese código de negocio ya existe' });
    }
    const usr = String(dueno_usuario).trim().toLowerCase();
    if (await one('SELECT id FROM usuarios WHERE usuario = $1', [usr])) {
      return res.status(400).json({ error: 'Ese nombre de usuario ya existe' });
    }
    const neg = await one(
      `INSERT INTO negocios (codigo, nombre) VALUES ($1,$2) RETURNING id`, [cod, nombre]);
    await query(
      `INSERT INTO usuarios (negocio_id, nombre, usuario, hash, rol) VALUES ($1,$2,$3,$4,'dueno')`,
      [neg.id, dueno_nombre || 'Dueño', usr, bcrypt.hashSync(dueno_password, 10)]);
    await crearCatalogo(neg.id, 2500);
    res.json({ ok: true, negocio_id: neg.id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al crear el negocio' });
  }
});

router.put('/negocios/:id', async (req, res) => {
  const b = req.body || {};
  const neg = await one('SELECT id, flags FROM negocios WHERE id = $1', [req.params.id]);
  if (!neg) return res.status(404).json({ error: 'Negocio no encontrado' });

  let flags = null;
  if (b.flags && typeof b.flags === 'object') {
    flags = JSON.stringify({ ...JSON.parse(neg.flags || '{}'), ...b.flags });
  }
  await query(
    `UPDATE negocios SET
       nombre = COALESCE($1, nombre),
       activo = COALESCE($2, activo),
       flags = COALESCE($3, flags),
       color_primario = COALESCE($4, color_primario),
       color_secundario = COALESCE($5, color_secundario),
       logo = COALESCE($6, logo)
     WHERE id = $7`,
    [b.nombre ?? null, typeof b.activo === 'boolean' ? b.activo : null, flags,
     b.color_primario ?? null, b.color_secundario ?? null, b.logo ?? null, req.params.id]);
  res.json({ ok: true });
});

router.post('/negocios/:id/reset-password', async (req, res) => {
  const { usuario, password } = req.body || {};
  if (!usuario || !password) return res.status(400).json({ error: 'Usuario y nueva contraseña requeridos' });
  const u = await one('SELECT id FROM usuarios WHERE usuario = $1 AND negocio_id = $2',
    [String(usuario).trim().toLowerCase(), req.params.id]);
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado en ese negocio' });
  await query('UPDATE usuarios SET hash = $1 WHERE id = $2', [bcrypt.hashSync(password, 10), u.id]);
  res.json({ ok: true });
});

module.exports = router;
