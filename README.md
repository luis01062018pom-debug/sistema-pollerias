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

## Renta mensual (suscripción)

Cada pollería paga una renta al mes. El estado **no se guarda**: se calcula de
`fecha_corte` cada vez que se consulta (`src/suscripcion.js`), así no puede
desincronizarse por un proceso nocturno que no corrió.

| Estado | Qué significa | Qué puede hacer el cliente |
|---|---|---|
| `PRUEBA` | mes gratis corriendo | todo |
| `ACTIVA` | pagada | todo |
| `CORTESIA` | sin fecha de corte (cliente interno) | todo, nunca se bloquea |
| `GRACIA` | venció hace ≤ 5 días | todo, con aviso |
| `RESTRINGIDA` | venció hace ≤ 12 días | **sigue vendiendo**; sin reportes ni inventario |
| `SUSPENDIDA` | venció hace más | solo subir su comprobante |

Nunca se le corta la venta a un cliente por cobranza mientras haya margen: que
una pollería no pueda cobrarle a su gente por culpa nuestra se comenta en el pueblo.

El dueño sube la foto de su transferencia desde **Mi cuenta** (se comprime a
1200 px en su teléfono y se guarda como `bytea` en Postgres, no en disco: el
disco de Railway es efímero). El superadmin la aprueba en la pestaña **Pagos**;
aprobar suma el mes a la fecha de corte y registra el ingreso en una sola
transacción (`src/pagos.js`). Ese mismo `confirmarPago()` es el que llamará un
webhook de Mercado Pago el día que se automatice el cobro.

## Un solo panel para los dos sistemas

El panel de fundadores del **sistema de tiendas** también administra las
pollerías: las lee por el puente `/api/socios` (`src/routes/socios.js`),
autenticado con el token compartido `SOCIOS_TOKEN`. Desde ahí se ven los
clientes, su renta y sus comprobantes, y se aprueban sin cambiar de página.
Si la variable no está puesta, el puente no existe.

## Respaldos (fuera del servidor)

Cada pollería se respalda sola, cifrada, todos los días de madrugada en la nube de
respaldos (Cloudflare R2). Para activarlo hay que poner las variables `NUBE_*`.
Todo el detalle —cómo configurarlo, revisarlo y restaurar UNA pollería sin tocar
a las demás (`npm run restaurar-negocio`)— está en [RESPALDOS.md](RESPALDOS.md).

## Despliegue en Railway

1. Sube este folder a un repo de GitHub y créale un servicio en Railway.
2. Agrega un servicio **PostgreSQL** en el mismo proyecto.
3. En el servicio de la app, agrega las variables:
   - `DATABASE_URL` → referencia a la del Postgres de Railway
   - `JWT_SECRET` → una cadena larga y aleatoria
   - `ADMIN_PASSWORD` → contraseña real del superadmin
   - `SOCIOS_TOKEN` → token compartido con el panel de fundadores (opcional)
4. Deploy. La primera vez crea las tablas y el usuario admin automáticamente.

Los deploys **nunca tocan los datos**: viven en el servicio de Postgres.
**Verifica siempre `railway variables` después de publicar**: un despliegue sin
`DATABASE_URL` no falla de forma visible, arranca en modo desarrollo con la base
vacía y cuesta el doble de RAM.

## Pruebas

Con el servidor de desarrollo corriendo y la base local recién creada:

```bash
npm run prueba
```

Recorre el ciclo completo de la renta: prueba, comprobante, aprobación, bloqueo
escalonado, contabilidad y puente de socios.

## Estructura

- `server.js` — Express, sirve la API y la PWA
- `src/schema.sql` — tablas (todas las de negocio llevan `negocio_id`)
- `src/seed.js` — catálogo base de despiece (de la tabla de FRESQUIPOLLO) y usuarios iniciales
- `src/suscripcion.js` — cálculo del estado de la renta y la escalera de cobranza
- `src/pagos.js` — aprobar un pago: suma el mes y registra el ingreso, todo o nada
- `src/routes/auth.js` — login y bootstrap (branding + flags + catálogo + suscripción)
- `src/routes/app.js` — compras/despiece, ventas, inventario, corte, reportes, config
- `src/routes/suscripcion.js` — la cuenta del cliente y su comprobante
- `src/routes/admin.js` — negocios, usuarios, renta, validación de pagos y contabilidad
- `src/routes/socios.js` — puente para el panel de fundadores del sistema de tiendas
- `public/` — PWA (instalable en el teléfono, ventas offline con sincronización)

## Flujo diario del cliente

1. **Compra**: "15 pollos, 38 kg a $40" → el sistema calcula el despiece esperado
   (15 pechugas, 30 piernas...) y carga el inventario.
2. **Ventas**: botones por pieza, por kilo o por pieza; funciona sin internet
   (se sincroniza solo al volver la señal).
3. **Corte**: total del día, efectivo contado, diferencia, y qué se vendió.
4. **Reportes**: ventas vs compras por rango de fechas, productos top.
