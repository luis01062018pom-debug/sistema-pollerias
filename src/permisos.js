/**
 * Qué puede hacer cada persona dentro de una pollería.
 *
 * Hasta aquí solo había dos puestos: dueño (todo) y empleado (todo menos
 * precios, empleados y configuración). El dueño ahora puede afinar eso
 * persona por persona: "este solo cobra", "esta cobra y recibe mercancía,
 * pero no ve las ganancias".
 *
 * Dos reglas que no se negocian:
 *   1. Lo que no está marcado se rechaza EN EL SERVIDOR. Esconder el botón
 *      no sirve de nada: basta teclear la dirección a mano.
 *   2. Quien no tenga funciones guardadas conserva EXACTAMENTE lo que podía
 *      hacer antes de este cambio. Nadie se queda fuera por actualizar.
 */

// Las funciones que el dueño puede marcar o desmarcar.
const FUNCIONES = ['vender', 'compras', 'inventario', 'corte', 'reportes'];

// Lo que puede hacer cada puesto si el dueño no marcó nada. Es lo mismo que
// podían hacer antes: por eso 'empleado' los trae todos.
const POR_PUESTO = {
  dueno: FUNCIONES,
  empleado: FUNCIONES,
};

// Direcciones de la API y la función que exige cada una. Precios, empleados
// y configuración no están aquí a propósito: esos siguen siendo del dueño.
const PERMISO_POR_RUTA = [
  [/^\/ventas/, 'vender'],
  [/^\/compras/, 'compras'],
  [/^\/inventario/, 'inventario'],
  [/^\/corte/, 'corte'],
  [/^\/reportes/, 'reportes'],
];

/** Lo que puede hacer ESTE usuario. */
function permisosDe(usuario) {
  if (!usuario) return [];
  let lista = null;
  if (usuario.permisos) {
    try { lista = JSON.parse(usuario.permisos); } catch { lista = null; }
  }
  if (!Array.isArray(lista)) return POR_PUESTO[usuario.rol] || [];
  return [...new Set(lista.filter((p) => FUNCIONES.includes(p)))];
}

/** Lo que llega del navegador cuando el dueño palomea funciones. */
function funcionesPedidas(valor) {
  if (!Array.isArray(valor)) return null;
  return JSON.stringify([...new Set(valor.filter((p) => FUNCIONES.includes(p)))]);
}

/** La función que exige una dirección, o null si no exige ninguna. */
function funcionDeRuta(ruta) {
  const par = PERMISO_POR_RUTA.find(([r]) => r.test(ruta));
  return par ? par[1] : null;
}

module.exports = { FUNCIONES, permisosDe, funcionesPedidas, funcionDeRuta };
