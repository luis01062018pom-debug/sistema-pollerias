/**
 * Rutas públicas (sin sesión) — solo la identidad visual de cada pollería.
 *
 * ¿Por qué sin sesión? Porque el navegador pide el manifest y los iconos por
 * su cuenta al instalar la app, y en esa petición no manda el token: va sin
 * cabeceras. Por eso se busca por el CÓDIGO del negocio, y por eso aquí no se
 * expone nada más que nombre, colores e iconos.
 */
const express = require('express');
const { one } = require('../db');
const { seguro } = require('../asincrono');

const router = seguro(express.Router());

// El `?v=` no es adorno: los iconos se sirven con caché larga, y sin cambiarle
// el nombre al archivo el navegador seguiría enseñando el logo viejo por horas.
const ICONO_DEFECTO_192 = '/icons/icon-192.png?v=2';
const ICONO_DEFECTO_512 = '/icons/icon-512.png?v=2';

function limpiaCodigo(c) {
  return String(c || '').trim().toUpperCase().slice(0, 40);
}

/** El manifest de instalación con la marca del negocio. */
router.get('/manifest/:codigo', async (req, res) => {
  try {
    const n = await one(
      `SELECT codigo, nombre, color_primario, color_fondo,
              (icono_192 IS NOT NULL) AS tiene_192, (icono_512 IS NOT NULL) AS tiene_512
         FROM negocios WHERE codigo = $1 AND activo = TRUE`, [limpiaCodigo(req.params.codigo)]);
    if (!n) return res.status(404).json({ error: 'Negocio no encontrado' });

    const base = `/api/publico/icono/${encodeURIComponent(n.codigo)}/`;
    const icono192 = n.tiene_192 ? base + '192.png' : ICONO_DEFECTO_192;
    const icono512 = n.tiene_512 ? base + '512.png' : ICONO_DEFECTO_512;

    res.set('Content-Type', 'application/manifest+json; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=300');
    res.json({
      id: '/',
      name: n.nombre,
      short_name: String(n.nombre).slice(0, 12),
      description: 'Punto de venta, despiece, inventario y corte de caja',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      display_override: ['standalone', 'minimal-ui'],
      orientation: 'portrait',
      lang: 'es',
      dir: 'ltr',
      background_color: n.color_fondo || '#f4f3f0',
      theme_color: n.color_primario || '#263949',
      categories: ['business', 'productivity', 'shopping'],
      icons: [
        { src: icono192, sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: icono512, sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: icono512, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
      shortcuts: [
        { name: 'Vender', url: '/?ir=vender' },
        { name: 'Corte de caja', url: '/?ir=corte' },
      ],
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

/** El icono del negocio, ya recortado al tamaño que pide el navegador. */
router.get('/icono/:codigo/:tam.png', async (req, res) => {
  try {
    const col = req.params.tam === '512' ? 'icono_512' : 'icono_192';
    const n = await one(
      `SELECT ${col} AS icono FROM negocios WHERE codigo = $1 AND activo = TRUE`,
      [limpiaCodigo(req.params.codigo)]);
    const datos = n && n.icono;
    if (!datos || !/^data:image\/png;base64,/.test(datos)) {
      return res.redirect(req.params.tam === '512' ? ICONO_DEFECTO_512 : ICONO_DEFECTO_192);
    }
    const buf = Buffer.from(datos.split(',')[1], 'base64');
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=300');
    res.send(buf);
  } catch (e) {
    console.error(e);
    res.redirect(ICONO_DEFECTO_192);
  }
});

module.exports = router;
