# Sistema de Pollerías (multi-negocio)

Punto de venta PWA para pollerías: despiece automático, inventario, corte de caja,
reportes, ticket por WhatsApp, branding y funciones activables por cliente.

## Cómo correrlo en tu PC (desarrollo)

```bash
npm install
npm start
```

Abre http://localhost:3000. Sin `DATABASE_URL`, los datos se guardan localmente
en `data-dev/` (PGlite, un Postgres embebido — mismo SQL que producción).

**Usuarios iniciales** (se crean solos la primera vez):

| Usuario | Contraseña | Rol |
|---|---|---|
| `admin` | `admin123` (o variable `ADMIN_PASSWORD`) | Superadmin: panel de negocios |
| `fresqui` | `fresqui123` | Dueño del negocio demo FRESQUIPOLLO |

## Despliegue en Railway

1. Sube este folder a un repo de GitHub y créale un servicio en Railway.
2. Agrega un servicio **PostgreSQL** en el mismo proyecto.
3. En el servicio de la app, agrega las variables:
   - `DATABASE_URL` → referencia a la del Postgres de Railway
   - `JWT_SECRET` → una cadena larga y aleatoria
   - `ADMIN_PASSWORD` → contraseña real del superadmin
4. Deploy. La primera vez crea las tablas y el usuario admin automáticamente.

Los deploys **nunca tocan los datos**: viven en el servicio de Postgres.

## Estructura

- `server.js` — Express, sirve la API y la PWA
- `src/schema.sql` — tablas (todas las de negocio llevan `negocio_id`)
- `src/seed.js` — catálogo base de despiece (de la tabla de FRESQUIPOLLO) y usuarios iniciales
- `src/routes/auth.js` — login y bootstrap (branding + flags + catálogo)
- `src/routes/app.js` — compras/despiece, ventas, inventario, corte, reportes, config
- `src/routes/admin.js` — alta de negocios, feature flags, suspender, reset de contraseñas
- `public/` — PWA (instalable en el teléfono, ventas offline con sincronización)

## Flujo diario del cliente

1. **Compra**: "15 pollos, 38 kg a $40" → el sistema calcula el despiece esperado
   (15 pechugas, 30 piernas...) y carga el inventario.
2. **Ventas**: botones por pieza, por kilo o por pieza; funciona sin internet
   (se sincroniza solo al volver la señal).
3. **Corte**: total del día, efectivo contado, diferencia, y qué se vendió.
4. **Reportes**: ventas vs compras por rango de fechas, productos top.
