CREATE TABLE IF NOT EXISTS negocios (
  id SERIAL PRIMARY KEY,
  codigo TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  logo TEXT,
  color_primario TEXT DEFAULT '#263949',
  color_secundario TEXT DEFAULT '#16222e',
  ticket_direccion TEXT DEFAULT '',
  ticket_telefono TEXT DEFAULT '',
  ticket_leyenda TEXT DEFAULT 'GRACIAS POR SU COMPRA',
  whatsapp TEXT DEFAULT '',
  peso_promedio_g INTEGER DEFAULT 2500,
  costo_kilo NUMERIC DEFAULT 40,
  flags TEXT DEFAULT '{"inventario":true,"reportes":true,"whatsapp":true}',
  activo BOOLEAN DEFAULT TRUE,
  creado_en TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  negocio_id INTEGER REFERENCES negocios(id),
  nombre TEXT NOT NULL,
  usuario TEXT UNIQUE NOT NULL,
  hash TEXT NOT NULL,
  rol TEXT NOT NULL DEFAULT 'empleado',
  activo BOOLEAN DEFAULT TRUE,
  creado_en TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS piezas (
  id SERIAL PRIMARY KEY,
  negocio_id INTEGER NOT NULL REFERENCES negocios(id),
  nombre TEXT NOT NULL,
  por_pollo NUMERIC DEFAULT 0,
  rendimiento NUMERIC DEFAULT 0,
  precio_kilo NUMERIC DEFAULT 0,
  precio_pieza NUMERIC DEFAULT 0,
  es_extra BOOLEAN DEFAULT FALSE,
  vendible BOOLEAN DEFAULT TRUE,
  controla_inventario BOOLEAN DEFAULT TRUE,
  orden INTEGER DEFAULT 0,
  activo BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS compras (
  id SERIAL PRIMARY KEY,
  negocio_id INTEGER NOT NULL REFERENCES negocios(id),
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  pollos INTEGER NOT NULL,
  kg_total NUMERIC NOT NULL,
  costo_kilo NUMERIC NOT NULL,
  costo_total NUMERIC NOT NULL,
  usuario_id INTEGER REFERENCES usuarios(id),
  creado_en TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS compra_despiece (
  id SERIAL PRIMARY KEY,
  compra_id INTEGER NOT NULL REFERENCES compras(id),
  pieza_id INTEGER NOT NULL REFERENCES piezas(id),
  piezas_esperadas NUMERIC DEFAULT 0,
  kg_esperados NUMERIC DEFAULT 0
);

CREATE TABLE IF NOT EXISTS inventario (
  negocio_id INTEGER NOT NULL REFERENCES negocios(id),
  pieza_id INTEGER NOT NULL REFERENCES piezas(id),
  kg NUMERIC DEFAULT 0,
  PRIMARY KEY (negocio_id, pieza_id)
);

CREATE TABLE IF NOT EXISTS ventas (
  id SERIAL PRIMARY KEY,
  negocio_id INTEGER NOT NULL REFERENCES negocios(id),
  uuid TEXT UNIQUE NOT NULL,
  fecha TIMESTAMPTZ DEFAULT now(),
  total NUMERIC NOT NULL,
  pago NUMERIC DEFAULT 0,
  cambio NUMERIC DEFAULT 0,
  usuario_id INTEGER REFERENCES usuarios(id),
  offline BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS venta_items (
  id SERIAL PRIMARY KEY,
  venta_id INTEGER NOT NULL REFERENCES ventas(id),
  pieza_id INTEGER REFERENCES piezas(id),
  nombre TEXT NOT NULL,
  modo TEXT NOT NULL DEFAULT 'kg',
  cantidad NUMERIC NOT NULL,
  precio NUMERIC NOT NULL,
  subtotal NUMERIC NOT NULL
);

CREATE TABLE IF NOT EXISTS cortes (
  id SERIAL PRIMARY KEY,
  negocio_id INTEGER NOT NULL REFERENCES negocios(id),
  fecha DATE NOT NULL,
  num_ventas INTEGER DEFAULT 0,
  total_ventas NUMERIC DEFAULT 0,
  efectivo_contado NUMERIC DEFAULT 0,
  diferencia NUMERIC DEFAULT 0,
  detalles TEXT DEFAULT '{}',
  creado_en TIMESTAMPTZ DEFAULT now(),
  UNIQUE (negocio_id, fecha)
);

/* =====================================================================
   SUSCRIPCIÓN (el negocio de nosotros, no el de la pollería)
   Cada negocio paga una renta mensual. El estado NO se guarda: se calcula
   de `fecha_corte` cada vez que se consulta (ver src/suscripcion.js), así
   no puede quedar desincronizado por un proceso nocturno que no corrió.
   La columna `estado` solo guarda lo que decidimos a mano: PRUEBA y CANCELADA.
   ===================================================================== */
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT 'PRUEBA';
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS fecha_corte DATE;
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS dias_gracia INTEGER NOT NULL DEFAULT 5;
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS precio_mensual NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS contacto_nombre TEXT;
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS whatsapp_contacto TEXT;
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS notas_internas TEXT;

/* La foto del comprobante se guarda en la base (bytea), NO en disco: el
   disco de Railway es efímero y se borraría en el siguiente despliegue. */
CREATE TABLE IF NOT EXISTS pagos_suscripcion (
  id SERIAL PRIMARY KEY,
  negocio_id INTEGER NOT NULL REFERENCES negocios(id),
  monto NUMERIC NOT NULL,
  metodo TEXT NOT NULL DEFAULT 'transferencia',
  referencia TEXT,
  comprobante_bytes BYTEA,
  comprobante_mime TEXT,
  estado TEXT NOT NULL DEFAULT 'PENDIENTE',
  periodo_inicio DATE,
  periodo_fin DATE,
  motivo_rechazo TEXT,
  subido_por INTEGER REFERENCES usuarios(id),
  validado_por INTEGER REFERENCES usuarios(id),
  validado_en TIMESTAMPTZ,
  creado_en TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contabilidad_saas (
  id SERIAL PRIMARY KEY,
  negocio_id INTEGER REFERENCES negocios(id),
  pago_id INTEGER REFERENCES pagos_suscripcion(id),
  concepto TEXT NOT NULL,
  tipo TEXT NOT NULL,
  monto NUMERIC NOT NULL,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  nota TEXT,
  registrado_por INTEGER REFERENCES usuarios(id),
  creado_en TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pagos_negocio ON pagos_suscripcion (negocio_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_pagos_estado ON pagos_suscripcion (estado);

/* =====================================================================
   IMAGEN DE CADA CLIENTE
   Cada pollería se ve distinta: su paleta, su logo y —lo importante— SUS
   iconos, para que al instalar la app en el teléfono o en la lap aparezca
   su marca y no la nuestra. Los iconos se guardan ya recortados a 192 y
   512 px (los genera el navegador al subir el logo) porque el servidor no
   tiene librería de imágenes y Railway no debe gastar CPU en eso.
   ===================================================================== */
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS tema TEXT NOT NULL DEFAULT 'pizarra';
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS color_acento TEXT DEFAULT '#b8934a';
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS color_fondo TEXT DEFAULT '#f4f3f0';
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS icono_192 TEXT;
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS icono_512 TEXT;

/* Baja de un cliente. Si ya vendió, su historial NO se borra: el dinero que
   cobramos tiene que seguir cuadrando en la contabilidad. Se marca la fecha
   de baja, desaparece del panel y nadie de ese negocio puede volver a entrar. */
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS eliminado_en TIMESTAMPTZ;

/* Índices de consulta. Sin ellos, una pollería con meses de ventas hace que
   el corte y los reportes recorran la tabla entera cada vez (eso es el "lag"
   que se siente en el teléfono a media venta). */
CREATE INDEX IF NOT EXISTS idx_ventas_negocio_fecha ON ventas (negocio_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_venta_items_venta ON venta_items (venta_id);
CREATE INDEX IF NOT EXISTS idx_compras_negocio_fecha ON compras (negocio_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_piezas_negocio ON piezas (negocio_id, activo);
CREATE INDEX IF NOT EXISTS idx_usuarios_negocio ON usuarios (negocio_id);

/* Bitácora de entradas al panel de superadministrador. La pregunta que
   contesta es "¿alguien entró a mi panel sin que yo me diera cuenta?": se
   guarda cada intento (bueno o malo) con su IP y su dispositivo, y el panel
   marca en rojo las direcciones que nunca se habían visto. */
CREATE TABLE IF NOT EXISTS accesos_admin (
  id SERIAL PRIMARY KEY,
  fecha TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  usuario TEXT NOT NULL,
  exito BOOLEAN NOT NULL DEFAULT FALSE,
  ip TEXT,
  dispositivo TEXT
);
CREATE INDEX IF NOT EXISTS idx_accesos_admin_fecha ON accesos_admin (fecha DESC);
