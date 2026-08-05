/* Prueba de punta a punta de la suscripción contra el servidor de desarrollo. */
const BASE = 'http://localhost:3000/api';
let fallos = 0;

async function req(metodo, ruta, { token, body } = {}) {
  const r = await fetch(BASE + ruta, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  return { status: r.status, data };
}

function ok(cond, texto, extra) {
  console.log((cond ? '  OK   ' : '  FALLA') + ' ' + texto + (cond ? '' : '  → ' + JSON.stringify(extra)));
  if (!cond) fallos++;
}

// 1x1 PNG transparente
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

(async () => {
  const admin = (await req('POST', '/login', { body: { usuario: 'admin', password: 'admin123' } })).data;
  ok(!!admin.token, 'login superadmin');
  const dueno = (await req('POST', '/login', { body: { usuario: 'fresqui', password: 'fresqui123' } })).data;
  ok(!!dueno.token, 'login dueño');

  const boot = await req('GET', '/bootstrap', { token: dueno.token });
  ok(boot.data.suscripcion?.estado === 'PRUEBA', 'bootstrap trae la suscripción en PRUEBA', boot.data.suscripcion);

  const cuenta = await req('GET', '/suscripcion', { token: dueno.token });
  ok(cuenta.data.precio_mensual === 150, 'renta mensual $150', cuenta.data);
  ok(/prueba/i.test(cuenta.data.aviso || ''), 'aviso de prueba', cuenta.data.aviso);

  // El dueño sube su comprobante con foto
  const subida = await req('POST', '/suscripcion/comprobante', {
    token: dueno.token, body: { monto: 150, metodo: 'transferencia', referencia: '1234', imagen: PNG } });
  ok(subida.status === 200 && subida.data.pago?.id, 'sube comprobante', subida.data);
  const pagoId = subida.data.pago?.id;

  // El superadmin lo ve en su bandeja
  const bandeja = await req('GET', '/admin/pagos?estado=PENDIENTE', { token: admin.token });
  ok(bandeja.data.some?.(p => p.id === pagoId && p.tiene_comprobante), 'el pago aparece por revisar', bandeja.data);

  const img = await fetch(`${BASE}/admin/pagos/${pagoId}/comprobante`, {
    headers: { Authorization: 'Bearer ' + admin.token } });
  ok(img.ok && (img.headers.get('content-type') || '').startsWith('image/'), 'la foto se descarga', img.status);

  // Un dueño NO debe poder entrar al panel
  const intruso = await req('GET', '/admin/pagos', { token: dueno.token });
  ok(intruso.status === 403, 'el dueño no puede ver el panel', intruso.status);

  // Aprobar: suma el mes y registra el ingreso
  const aprob = await req('POST', `/admin/pagos/${pagoId}/aprobar`, { token: admin.token, body: { meses: 1 } });
  ok(aprob.status === 200 && aprob.data.nueva_fecha_corte, 'aprobar suma el mes', aprob.data);

  const repetido = await req('POST', `/admin/pagos/${pagoId}/aprobar`, { token: admin.token, body: { meses: 1 } });
  ok(repetido.status === 409, 'no se puede aprobar dos veces el mismo pago', repetido.status);

  const cuenta2 = await req('GET', '/suscripcion', { token: dueno.token });
  ok(cuenta2.data.estado === 'ACTIVA', 'la pollería queda ACTIVA', cuenta2.data.estado);
  ok(cuenta2.data.fecha_corte?.slice(0, 10) === aprob.data.nueva_fecha_corte, 'la fecha de corte es la nueva', cuenta2.data.fecha_corte);

  const conta = await req('GET', '/admin/contabilidad', { token: admin.token });
  ok(conta.data.ingresos_mes === 150, 'el ingreso quedó en la contabilidad', conta.data.ingresos_mes);
  ok(conta.data.mrr === 150, 'MRR $150', conta.data.mrr);

  // Cobro manual en efectivo: dos meses de un jalón
  const manual = await req('POST', '/admin/pagos/manual', {
    token: admin.token, body: { negocio_id: 1, monto: 300, meses: 2, metodo: 'efectivo' } });
  ok(manual.status === 200, 'cobro manual', manual.data);
  const conta2 = await req('GET', '/admin/contabilidad', { token: admin.token });
  ok(conta2.data.ingresos_mes === 450, 'suma los dos ingresos', conta2.data.ingresos_mes);

  // Gasto
  await req('POST', '/admin/gastos', { token: admin.token, body: { concepto: 'Railway', monto: 200 } });
  const conta3 = await req('GET', '/admin/contabilidad', { token: admin.token });
  ok(conta3.data.gastos_mes === 200 && conta3.data.utilidad_mes === 250, 'gasto y utilidad', conta3.data);

  // Alta de otra pollería con su usuario y su prueba
  const alta = await req('POST', '/admin/negocios', {
    token: admin.token,
    body: { codigo: 'PRUEBA2', nombre: 'Pollería de Prueba', dueno_nombre: 'Doña Mary',
            dueno_usuario: 'mary', dueno_password: 'mary1234', precio_mensual: 150, dias_prueba: 30 } });
  ok(alta.status === 200, 'alta de negocio nuevo', alta.data);
  const negocios = await req('GET', '/admin/negocios', { token: admin.token });
  const nueva = negocios.data.find?.(n => n.codigo === 'PRUEBA2');
  ok(nueva?.situacion?.estado === 'PRUEBA' && nueva.situacion.dias === 30, 'arranca con 30 días de prueba', nueva?.situacion);
  ok(nueva?.usuarios === 1, 'tiene su primer usuario', nueva?.usuarios);
  const usrs = await req('GET', `/admin/negocios/${nueva?.id}/usuarios`, { token: admin.token });
  ok(usrs.data[0]?.usuario === 'mary' && usrs.data[0]?.rol === 'dueno', 'el primer usuario es el dueño', usrs.data);

  // Bloqueo por falta de pago: se le vence la renta hace 20 días
  await req('PUT', `/admin/negocios/${nueva.id}`, {
    token: admin.token, body: { estado: 'ACTIVA', fecha_corte: '2020-01-01' } });
  const mary = (await req('POST', '/login', { body: { usuario: 'mary', password: 'mary1234' } })).data;
  const bootMary = await req('GET', '/bootstrap', { token: mary.token });
  ok(bootMary.data.suscripcion?.estado === 'SUSPENDIDA', 'vencida hace años = SUSPENDIDA', bootMary.data.suscripcion);
  const venta = await req('POST', '/ventas', { token: mary.token,
    body: { uuid: 'x-' + Date.now(), items: [{ nombre: 'PECHUGA', modo: 'kg', cantidad: 1, precio: 100, subtotal: 100 }], pago: 100 } });
  ok(venta.status === 402, 'suspendida no puede vender', venta.status);
  const pagar = await req('GET', '/suscripcion', { token: mary.token });
  ok(pagar.status === 200, 'pero SÍ puede ver su cuenta para pagar', pagar.status);

  // Restringida (vencida 8 días): vende pero no ve reportes
  const hace8 = new Date(Date.now() - 8 * 86400000).toISOString().slice(0, 10);
  await req('PUT', `/admin/negocios/${nueva.id}`, { token: admin.token, body: { fecha_corte: hace8, dias_gracia: 5 } });
  const bootMary2 = await req('GET', '/bootstrap', { token: mary.token });
  ok(bootMary2.data.suscripcion?.estado === 'RESTRINGIDA', 'vencida 8 días = RESTRINGIDA', bootMary2.data.suscripcion);
  const venta2 = await req('POST', '/ventas', { token: mary.token,
    body: { uuid: 'y-' + Date.now(), items: [{ nombre: 'PECHUGA', modo: 'kg', cantidad: 1, precio: 100, subtotal: 100 }], pago: 100 } });
  ok(venta2.status === 200, 'restringida SÍ puede vender', venta2);
  const rep = await req('GET', '/reportes/resumen?desde=2020-01-01&hasta=2030-01-01', { token: mary.token });
  ok(rep.status === 402, 'restringida NO ve reportes', rep.status);

  // Puente para el panel de socios del sistema de tiendas
  const sinToken = await fetch(BASE + '/socios/resumen');
  ok(sinToken.status === 401 || sinToken.status === 404, 'el puente exige token', sinToken.status);
  if (process.env.SOCIOS_TOKEN) {
    const conToken = await fetch(BASE + '/socios/resumen', { headers: { 'x-socios-token': process.env.SOCIOS_TOKEN } });
    const puente = await conToken.json().catch(() => ({}));
    ok(conToken.ok && puente.negocios?.length >= 2, 'el puente entrega los negocios', puente);
    const malToken = await fetch(BASE + '/socios/resumen', { headers: { 'x-socios-token': 'x'.repeat(process.env.SOCIOS_TOKEN.length) } });
    ok(malToken.status === 401, 'el puente rechaza un token equivocado', malToken.status);
  } else {
    console.log('  (puente de socios: sin SOCIOS_TOKEN en este servidor, se prueba aparte)');
  }

  console.log(fallos ? `\n${fallos} PRUEBA(S) FALLARON` : '\nTodas las pruebas pasaron');
  process.exit(fallos ? 1 : 0);
})();
