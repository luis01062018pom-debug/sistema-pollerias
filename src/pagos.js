/**
 * Confirmación de un pago de renta mensual.
 *
 * Esta es la función que dispara hoy nuestro clic en el panel; el día que se
 * integre un cobro automático (Mercado Pago), su webhook llamará exactamente
 * a esta misma función y no habrá que tocar nada más.
 */
const { query, one, transaccion } = require('./db');
const { sumarMeses } = require('./suscripcion');

async function confirmarPago(pagoId, { validadoPor, meses = 1 }) {
  // Se acota aquí, no en cada ruta: un 0 o un número raro movería la fecha
  // de corte hacia atrás y el negocio quedaría suspendido por un pago que sí hizo.
  const periodos = Math.min(Math.max(Math.round(Number(meses) || 1), 1), 12);

  return transaccion(async (cx) => {
    const { rows: [pago] } = await cx.query(
      `SELECT p.*, n.nombre AS negocio, n.fecha_corte, n.precio_mensual
         FROM pagos_suscripcion p JOIN negocios n ON n.id = p.negocio_id
        WHERE p.id = $1 FOR UPDATE OF p`, [pagoId]);
    if (!pago) { const e = new Error('Ese pago no existe'); e.status = 404; throw e; }
    if (pago.estado === 'APROBADO') { const e = new Error('Ese pago ya estaba aprobado'); e.status = 409; throw e; }

    // El mes se suma a la fecha de corte de ESE negocio, no a la de hoy: así
    // quien contrató un día 14 sigue cortando los días 14.
    const { inicio, fin } = sumarMeses(pago.fecha_corte, periodos);

    await cx.query(
      `UPDATE pagos_suscripcion
          SET estado = 'APROBADO', validado_por = $2, validado_en = now(),
              periodo_inicio = $3, periodo_fin = $4, motivo_rechazo = NULL
        WHERE id = $1`,
      [pagoId, validadoPor, inicio, fin]);

    // Al aprobar un pago el negocio queda ACTIVO: se acabó la prueba y se
    // levanta cualquier suspensión por falta de pago.
    await cx.query(
      `UPDATE negocios SET estado = 'ACTIVA', fecha_corte = $2, activo = TRUE WHERE id = $1`,
      [pago.negocio_id, fin]);

    await cx.query(
      `INSERT INTO contabilidad_saas (negocio_id, pago_id, concepto, tipo, monto, fecha, registrado_por)
       VALUES ($1,$2,$3,'INGRESO',$4,CURRENT_DATE,$5)`,
      [pago.negocio_id, pagoId, `Mensualidad ${pago.negocio}`, pago.monto, validadoPor]);

    return {
      negocio: pago.negocio,
      negocio_id: pago.negocio_id,
      monto: Number(pago.monto),
      meses: periodos,
      nueva_fecha_corte: fin,
    };
  });
}

/** Cobro que registramos nosotros (efectivo en la mano): se aprueba solo. */
async function cobroManual({ negocio_id, monto, metodo, referencia, meses, usuarioId }) {
  if (!negocio_id) { const e = new Error('Elige el negocio'); e.status = 400; throw e; }
  if (!(Number(monto) > 0)) { const e = new Error('Escribe el monto'); e.status = 400; throw e; }
  const neg = await one('SELECT id FROM negocios WHERE id = $1', [negocio_id]);
  if (!neg) { const e = new Error('Ese negocio no existe'); e.status = 404; throw e; }

  const pago = await one(
    `INSERT INTO pagos_suscripcion (negocio_id, monto, metodo, referencia, estado, subido_por)
     VALUES ($1,$2,$3,$4,'PENDIENTE',$5) RETURNING id`,
    [negocio_id, Number(monto), metodo || 'efectivo', referencia || null, usuarioId || null]);

  return confirmarPago(pago.id, { validadoPor: usuarioId, meses });
}

async function rechazarPago(pagoId, { validadoPor, motivo }) {
  const m = String(motivo || '').trim();
  if (m.length < 5) { const e = new Error('Escribe por qué se rechaza'); e.status = 400; throw e; }
  const r = await query(
    `UPDATE pagos_suscripcion
        SET estado = 'RECHAZADO', validado_por = $2, validado_en = now(), motivo_rechazo = $3
      WHERE id = $1 AND estado = 'PENDIENTE'`, [pagoId, validadoPor, m]);
  // pg dice rowCount; PGlite (desarrollo) dice affectedRows.
  const afectadas = r.rowCount ?? r.affectedRows ?? 0;
  if (!afectadas) { const e = new Error('Ese pago no existe o ya fue validado'); e.status = 404; throw e; }
  return { ok: true };
}

module.exports = { confirmarPago, cobroManual, rechazarPago };
