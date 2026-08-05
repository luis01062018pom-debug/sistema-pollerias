/**
 * Estado de la suscripción de un negocio (la renta mensual que nos paga).
 *
 * DECISIÓN DE DISEÑO: el estado NO se guarda con un proceso nocturno que
 * recorra los negocios. Se calcula de la fecha de corte cada vez que hace
 * falta. Un CronJob puede no ejecutarse, fallar en silencio o dejar a un
 * cliente en un estado equivocado sin que nadie lo note; una cuenta se
 * calcula siempre igual y no puede desincronizarse.
 *
 * La escalera de cobranza está pensada para no dejar sin vender a nadie:
 * primero se avisa, luego se bloquean los reportes, y hasta el final se
 * suspende. Que una pollería pierda ventas por nuestra cobranza se comenta
 * en el pueblo, y el boca a boca es nuestro único canal de venta.
 */

const DIAS_RESTRINGIDA = 7;   // días de "solo puedes vender" antes de suspender

/** Fecha (YYYY-MM-DD) sin pasar por toISOString(), que se va a Greenwich. */
function comoFecha(d) {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

function hoyCero() {
  const h = new Date();
  h.setHours(0, 0, 0, 0);
  return h;
}

/**
 * Deja cualquier fecha_corte en 'YYYY-MM-DD'.
 *
 * Esto NO es adorno: una columna DATE no tiene hora, pero cada driver la
 * entrega distinto. node-postgres la convierte a un Date en medianoche LOCAL
 * y PGlite (desarrollo) en medianoche UTC. Sin normalizar, `String(fecha)`
 * daba "Fri Sep 04 2026..." , la resta salía NaN y TODOS los negocios
 * aparecían suspendidos. Se distingue por la hora UTC: si es exactamente
 * medianoche UTC, la fecha buena son las partes UTC; si no, las locales.
 */
function soloFecha(v) {
  if (!v) return null;
  if (v instanceof Date) {
    if (v.getUTCHours() === 0 && v.getUTCMinutes() === 0) {
      return [
        v.getUTCFullYear(),
        String(v.getUTCMonth() + 1).padStart(2, '0'),
        String(v.getUTCDate()).padStart(2, '0'),
      ].join('-');
    }
    return comoFecha(v);
  }
  return String(v).slice(0, 10);
}

function estadoSuscripcion(negocio) {
  if (!negocio) return { estado: 'SUSPENDIDA', dias: 0 };
  if (negocio.estado === 'CANCELADA') return { estado: 'CANCELADA', dias: 0 };

  // Sin fecha de corte no hay reloj corriendo: cliente de cortesía o interno.
  // Nunca se le bloquea nada; es el caso del negocio de prueba de la casa.
  const fecha = soloFecha(negocio.fecha_corte);
  if (!fecha) return { estado: 'CORTESIA', dias: null };

  const corte = new Date(`${fecha}T00:00:00`);
  const dias = Math.round((corte - hoyCero()) / 86_400_000);

  if (negocio.estado === 'PRUEBA' && dias >= 0) return { estado: 'PRUEBA', dias };

  const gracia = Number(negocio.dias_gracia ?? 5);
  const vencidos = -dias;

  if (dias >= 0) return { estado: 'ACTIVA', dias };
  if (vencidos <= gracia) return { estado: 'GRACIA', dias };
  if (vencidos <= gracia + DIAS_RESTRINGIDA) return { estado: 'RESTRINGIDA', dias };
  return { estado: 'SUSPENDIDA', dias };
}

/** Mensaje para el dueño de la pollería, en su idioma, no en jerga de sistemas. */
function mensajeSuscripcion({ estado, dias }) {
  if (estado === 'PRUEBA') {
    return dias === 0
      ? 'Hoy termina tu mes de prueba. Sube tu comprobante para seguir sin cortes.'
      : `Estás en tu mes de prueba gratis: te quedan ${dias} días.`;
  }
  if (estado === 'ACTIVA' && dias <= 5) {
    return `Tu mensualidad vence en ${dias} día${dias === 1 ? '' : 's'}.`;
  }
  if (estado === 'GRACIA') {
    return 'Tu pago está pendiente. Sube tu comprobante para no perder los reportes.';
  }
  if (estado === 'RESTRINGIDA') {
    return 'Pago pendiente: puedes seguir vendiendo, pero los reportes y el '
      + 'inventario están bloqueados. Sube tu comprobante para reactivarlos.';
  }
  if (estado === 'SUSPENDIDA' || estado === 'CANCELADA') {
    return 'El servicio está suspendido por falta de pago. Sube tu comprobante '
      + 'para reactivarlo. Tus datos están guardados.';
  }
  return null;
}

/** Los estados en los que el negocio ya no puede usar la app (solo pagar). */
const SUSPENDIDOS = ['SUSPENDIDA', 'CANCELADA'];
/** Los estados en los que puede vender pero no ver administración. */
const SOLO_VENTA = ['RESTRINGIDA'];

/**
 * Suma meses a una fecha de corte cuidando dos trampas del calendario:
 * quien contrató un día 31 no puede cortar el 31 de febrero (JavaScript se
 * pasaría al 3 de marzo y le estaríamos regalando días), y a quien lleva
 * meses vencido no se le regalan los meses atrasados: se cuenta desde hoy.
 */
function sumarMeses(fechaCorte, meses) {
  const hoy = hoyCero();
  const fecha = soloFecha(fechaCorte);
  const actual = fecha ? new Date(`${fecha}T00:00:00`) : hoy;
  const base = actual > hoy ? actual : hoy;
  const nuevo = new Date(base);
  const dia = nuevo.getDate();
  nuevo.setMonth(nuevo.getMonth() + meses);
  if (nuevo.getDate() !== dia) nuevo.setDate(0);
  return { inicio: comoFecha(base), fin: comoFecha(nuevo) };
}

/** Fecha de corte para un periodo de prueba de N días a partir de hoy. */
function corteEnDias(dias) {
  const d = hoyCero();
  d.setDate(d.getDate() + Number(dias || 30));
  return comoFecha(d);
}

module.exports = {
  estadoSuscripcion, mensajeSuscripcion, sumarMeses, corteEnDias, comoFecha, soloFecha,
  DIAS_RESTRINGIDA, SUSPENDIDOS, SOLO_VENTA,
};
