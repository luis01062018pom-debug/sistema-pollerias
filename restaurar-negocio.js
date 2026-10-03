/**
 * Regresa UNA pollería a como estaba en un respaldo, sin tocar a las demás.
 *
 *   node restaurar-negocio.js <archivo.bak> --verificar
 *   node restaurar-negocio.js --nube <id-de-pollería> --verificar
 *   node restaurar-negocio.js --nube <id> --fecha=2026-10-01 --sobrescribir
 *
 *   --verificar     solo abre el archivo y dice qué trae. NO toca la base.
 *   --sobrescribir  borra lo que esa pollería tiene HOY y pone lo del
 *                   respaldo. Antes guarda una copia de cómo estaba
 *                   (antes-de-restaurar-….bak) por si hay que deshacer.
 *   --fecha=…       con --nube, el respaldo de ese día (si no, el más nuevo).
 *   --mes=AAAA-MM   con --nube, el respaldo mensual de ese mes.
 *
 * Necesita DATABASE_URL (la base a restaurar), NUBE_CLAVE y, con --nube, el
 * resto de las variables NUBE_*. Sin bandera no hace nada, a propósito.
 */
const fs = require('fs');
const path = require('path');
const db = require('./src/db');
const nube = require('./src/nube');
const { leerVolcado, restaurarNegocio, volcarNegocio } = require('./src/volcado');

const args = process.argv.slice(2);
const bandera = (n) => args.includes(`--${n}`);
const valor = (n) => (args.find((a) => a.startsWith(`--${n}=`)) || '').split('=')[1] || null;

async function conseguirArchivo() {
  if (bandera('nube')) {
    const id = args[args.indexOf('--nube') + 1];
    if (!id || id.startsWith('--')) throw new Error('Falta el id de la pollería después de --nube');
    const lista = await nube.respaldosDe('polleria', id);
    if (!lista.length) throw new Error('Esa pollería no tiene respaldos en la nube');
    const fecha = valor('fecha');
    const mes = valor('mes');
    const elegido = fecha ? lista.find((a) => a.clave.endsWith(`/diario/${fecha}.bak`))
      : mes ? lista.find((a) => a.clave.endsWith(`/mensual/${mes}.bak`))
        : lista.find((a) => a.clave.includes('/diario/')) || lista[0];
    if (!elegido) {
      console.log('Respaldos disponibles:\n' + lista.map((a) => `  ${a.clave}`).join('\n'));
      throw new Error('No hay respaldo con esa fecha');
    }
    console.log(`Bajando ${elegido.clave}…`);
    return nube.bajar(elegido.clave);
  }
  const archivo = args.find((a) => !a.startsWith('--'));
  if (!archivo) throw new Error('Falta el archivo');
  if (!fs.existsSync(archivo)) throw new Error(`No encuentro el archivo: ${archivo}`);
  return fs.readFileSync(archivo);
}

async function main() {
  if (!bandera('verificar') && !bandera('sobrescribir')) {
    console.log('Uso:\n'
      + '  node restaurar-negocio.js <archivo.bak> --verificar\n'
      + '  node restaurar-negocio.js --nube <id> [--fecha=AAAA-MM-DD | --mes=AAAA-MM] --verificar\n'
      + '  … y con --sobrescribir en lugar de --verificar para restaurar de verdad.');
    process.exit(1);
  }
  const clave = valor('clave') || process.env.NUBE_CLAVE;
  const datos = leerVolcado(nube.descifrar(await conseguirArchivo(), clave));
  if (datos.sistema !== 'polleria') throw new Error(`Ese respaldo es de ${datos.sistema}, no de una pollería`);

  console.log(`\nPollería: ${datos.negocio.nombre}  (id ${datos.negocio.id})`);
  console.log(`Fecha   : ${new Date(datos.creado_en).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}`);
  console.log(`Trae    : ${datos.filas} renglones`);
  for (const [t, n] of Object.entries(datos.resumen)) if (n) console.log(`          ${t.padEnd(18)} ${n}`);
  if (bandera('verificar')) {
    console.log('\nEl respaldo abre bien. No se tocó nada (usa --sobrescribir para restaurar).');
    return;
  }

  await db.init();
  // Antes de pisar nada, una foto de cómo está HOY por si fue un error.
  const hoy = await db.transaccion(async (cx) => {
    const { rows: [n] } = await cx.query('SELECT nombre FROM negocios WHERE id = $1', [Number(datos.negocio.id)]);
    if (!n) return null;
    return volcarNegocio(cx, { sistema: 'polleria', raiz: 'negocios', columna: 'negocio_id', id: Number(datos.negocio.id), nombre: n.nombre });
  });
  if (hoy) {
    const destino = path.join(process.cwd(), `antes-de-restaurar-polleria-${datos.negocio.id}-${Date.now()}.bak`);
    fs.writeFileSync(destino, nube.cifrar(hoy.contenido, clave));
    console.log(`\nCopia de cómo estaba hoy: ${destino}`);
  }

  const r = await db.transaccion((cx) => restaurarNegocio(cx, datos));
  console.log('\nRestaurada.');
  for (const [t, n] of Object.entries(r.metido)) console.log(`  ${t.padEnd(18)} ${n}`);
  for (const a of r.avisos) console.log(`  aviso: ${a}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error('\n✖', e.message); process.exit(1); });
