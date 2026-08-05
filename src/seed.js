const bcrypt = require('bcryptjs');
const { query, one } = require('./db');
const { corteEnDias } = require('./suscripcion');

// Catálogo base tomado de la tabla de despiece de FRESQUIPOLLO (pollo promedio 2,500 g)
const CATALOGO_BASE = [
  { nombre: 'PECHUGA',          por_pollo: 1, rendimiento: 0.31,  precio_kilo: 102,  orden: 1 },
  { nombre: 'PIERNA',           por_pollo: 2, rendimiento: 0.11,  precio_kilo: 66,   orden: 2 },
  { nombre: 'MUSLO',            por_pollo: 2, rendimiento: 0.15,  precio_kilo: 66,   orden: 3 },
  { nombre: 'ALA',              por_pollo: 2, rendimiento: 0.05,  precio_kilo: 66,   orden: 4 },
  { nombre: 'ALÓN',             por_pollo: 2, rendimiento: 0.044, precio_kilo: 40,   orden: 5 },
  { nombre: 'HUACAL/HUESO',     por_pollo: 1, rendimiento: 0.20,  precio_kilo: 15,   orden: 6 },
  { nombre: 'PATAS',            por_pollo: 2, rendimiento: 0.05,  precio_kilo: 25.2, orden: 7 },
  { nombre: 'HÍGADO Y MOLLEJA', por_pollo: 1, rendimiento: 0.05,  precio_kilo: 20,   orden: 8 },
  { nombre: 'MERMA (SANGRE, GRASA)', por_pollo: 1, rendimiento: 0.03, precio_kilo: 0, orden: 99, vendible: false },
  { nombre: 'SURTIDO',      es_extra: true, precio_kilo: 62, orden: 20 },
  { nombre: 'POLLO ENTERO', es_extra: true, precio_kilo: 57, orden: 21 },
  { nombre: 'PECHUGA FRÍA', es_extra: true, precio_kilo: 95, orden: 22 }
];

async function crearCatalogo(negocioId, pesoPromedioG) {
  for (const p of CATALOGO_BASE) {
    const porPollo = p.por_pollo || 0;
    const rend = p.rendimiento || 0;
    const pesoPiezaKg = porPollo > 0 ? (rend * pesoPromedioG / 1000) / porPollo : 0;
    const precioPieza = Math.round(pesoPiezaKg * p.precio_kilo * 100) / 100;
    await query(
      `INSERT INTO piezas (negocio_id, nombre, por_pollo, rendimiento, precio_kilo, precio_pieza,
                           es_extra, vendible, controla_inventario, orden)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [negocioId, p.nombre, porPollo, rend, p.precio_kilo, precioPieza,
       !!p.es_extra, p.vendible !== false, !p.es_extra && p.vendible !== false, p.orden]
    );
  }
}

async function seed() {
  const existe = await one('SELECT id FROM negocios LIMIT 1');
  if (existe) return;

  console.log('[seed] Base vacía: creando superadmin y negocio demo FRESQUIPOLLO...');

  const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
  await query(
    `INSERT INTO usuarios (negocio_id, nombre, usuario, hash, rol) VALUES (NULL,$1,$2,$3,'superadmin')`,
    ['Administrador del sistema', 'admin', bcrypt.hashSync(adminPass, 10)]
  );

  // Arranca con su mes de prueba corriendo, como cualquier cliente nuevo.
  const neg = await one(
    `INSERT INTO negocios (codigo, nombre, peso_promedio_g, costo_kilo, ticket_leyenda,
                           precio_mensual, estado, fecha_corte)
     VALUES ('FRESQUI','FRESQUIPOLLO',2500,40,'GRACIAS POR SU COMPRA',
             150,'PRUEBA',$1::date) RETURNING id`, [corteEnDias(30)]
  );

  await query(
    `INSERT INTO usuarios (negocio_id, nombre, usuario, hash, rol) VALUES ($1,$2,$3,$4,'dueno')`,
    [neg.id, 'Dueño Fresquipollo', 'fresqui', bcrypt.hashSync('fresqui123', 10)]
  );

  await crearCatalogo(neg.id, 2500);

  console.log('[seed] Listo. Usuarios: admin/' + adminPass + ' (superadmin), fresqui/fresqui123 (dueño demo)');
}

module.exports = { seed, crearCatalogo, CATALOGO_BASE };
