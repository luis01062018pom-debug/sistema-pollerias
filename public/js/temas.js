/* Paletas listas para cada cliente.
   El superadmin elige una en el panel y la app entera cambia de cara: barra,
   botones, fondo y hasta el color de la barra del teléfono. También puede
   afinar los colores a mano si el cliente ya tiene los suyos. */
const TEMAS = [
  { id: 'pizarra',  nombre: 'Pizarra y oro',     primario: '#263949', secundario: '#16222e', acento: '#b8934a', fondo: '#f4f3f0' },
  { id: 'brasa',    nombre: 'Naranja pollería',  primario: '#e35205', secundario: '#b8390a', acento: '#ffa41b', fondo: '#fff6ee' },
  { id: 'rojo',     nombre: 'Rojo parrilla',     primario: '#c1121f', secundario: '#8e0b12', acento: '#f4a300', fondo: '#fdf3f2' },
  { id: 'campo',    nombre: 'Verde campo',       primario: '#2f6b3a', secundario: '#1e4726', acento: '#e0a526', fondo: '#f2f7f1' },
  { id: 'mercado',  nombre: 'Azul mercado',      primario: '#1d4e89', secundario: '#123456', acento: '#f2a93b', fondo: '#f1f5fa' },
  { id: 'cafe',     nombre: 'Café y crema',      primario: '#5b3a29', secundario: '#3d2519', acento: '#c9a227', fondo: '#faf5ef' },
];

function temaPorId(id) {
  return TEMAS.find((t) => t.id === id) || TEMAS[0];
}

/** Pinta una paleta en el documento (y en la barra de estado del teléfono). */
function aplicarPaleta({ primario, secundario, acento, fondo }) {
  const raiz = document.documentElement.style;
  const t = TEMAS[0];
  raiz.setProperty('--primario', primario || t.primario);
  raiz.setProperty('--secundario', secundario || t.secundario);
  raiz.setProperty('--acento', acento || t.acento);
  raiz.setProperty('--fondo', fondo || t.fondo);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', primario || t.primario);
}
