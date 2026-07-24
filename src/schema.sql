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
