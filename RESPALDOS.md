# Respaldos: que ningún negocio pierda nada

Los tres sistemas (tiendas, pollerías y jarcerías) respaldan **cada negocio por
separado**, **cifrado** y **fuera de Railway**, en un almacenamiento de archivos
tipo S3. Recomendado: **Cloudflare R2** (10 GB gratis, no cobra por descargar, y la
cuenta de Cloudflare ya existe porque ahí está el DNS).

## Cómo funciona

| Qué | Cuándo | Dónde | Cuánto se guarda |
|---|---|---|---|
| Cada negocio (solo sus datos) | Diario, de 1 a 6 am | `<giro>/<negocio>/diario/AAAA-MM-DD.bak` | 35 días |
| Foto del mes de cada negocio | El primer respaldo del mes | `<giro>/<negocio>/mensual/AAAA-MM.bak` | Para siempre |
| Base completa (gastos, administradores) | Diario | `<giro>/_sistema/…` | Igual |

- **No satura el servidor**: de madrugada, un negocio tras otro con pausa. Si un
  negocio no cambió desde ayer, no se vuelve a subir (salvo una vez por semana).
  El archivo se escribe comprimido por tandas: la memoria que usa es la del
  archivo ya comprimido, no la de todos los datos.
- **No ocupa el servidor**: la historia vive en la nube. Dentro de Railway solo
  quedan 3 respaldos generales (tiendas) y 7 por jarcería.
- **Si algo falla**, la pestaña **Respaldos** del panel lo marca en rojo
  (más de 30 horas sin copia). Si pasan 30 horas, se respalda aunque sea de día.
- Cada archivo va cifrado con AES-256-GCM: ni Cloudflare ni quien robe la llave
  del bucket puede leer los datos de un cliente.

## Ponerlo a funcionar (una sola vez)

1. **Cloudflare → R2 → Create bucket**: `respaldos-negocios` (ubicación automática).
2. En el bucket, **Settings → Bucket lock rules → Add rule**: prefijo vacío,
   *Retain for 30 days*. Con esto **nadie puede borrar** un respaldo antes de
   30 días, ni con la llave robada ni por un error nuestro.
3. **R2 → Manage API tokens → Create API token**: permiso *Object Read & Write*,
   solo para el bucket `respaldos-negocios`. Copia el *Access Key ID*, el
   *Secret Access Key* y el *endpoint* (`https://<id>.r2.cloudflarestorage.com`).
4. Inventa una contraseña larga para cifrar (`NUBE_CLAVE`) y **anótala aparte**
   (en el archivo de secretos y en papel). **Sin ella los respaldos no abren.**
5. En Railway, en los **tres** servicios (`pos-tienda/app`, `sistema-pollerias/app`,
   `jarceria/jarceria`), pon las mismas variables:

   ```
   NUBE_ENDPOINT=https://<id-de-cuenta>.r2.cloudflarestorage.com
   NUBE_BUCKET=respaldos-negocios
   NUBE_ACCESS_KEY=...
   NUBE_SECRET_KEY=...
   NUBE_CLAVE=...        (tiendas y pollerías; la jarcería cifra con su BACKUP_PASSWORD)
   ```

6. Abre el panel → **Respaldos** → "Respaldar ahora" en un negocio de cada giro.
   Debe quedar en verde y el archivo debe aparecer en el bucket.

## Revisar que un respaldo abre (hacerlo una vez al mes)

Un respaldo que nunca se abrió puede estar dañado y nadie se entera hasta el día
que se necesita.

```bash
# Tiendas (en la carpeta del sistema de tiendas, con las variables NUBE_* puestas)
npm run restaurar-negocio -- --nube <id-de-la-tienda> --verificar

# Pollerías
npm run restaurar-negocio -- --nube <id-de-la-pollería> --verificar
```

`--verificar` solo abre el archivo y dice qué trae. **No toca la base.**

## Restaurar UN negocio (sin tocar a los demás)

```bash
npm run restaurar-negocio -- --nube <id> --fecha=2026-10-01 --sobrescribir
npm run restaurar-negocio -- --nube <id> --mes=2026-09 --sobrescribir
npm run restaurar-negocio -- respaldo-descargado.bak --sobrescribir
```

- Borra lo que ese negocio tiene **hoy** y pone lo del respaldo, en una sola
  transacción: o queda completo o no se cambia nada.
- Antes de pisar nada guarda `antes-de-restaurar-….bak` (cómo estaba hoy), por
  si la restauración fue un error.
- Para conectarse a la base de Railway desde la laptop, `DATABASE_URL` debe ser la
  pública del Postgres (`DATABASE_PUBLIC_URL`).
- **Jarcerías**: su archivo es el `.nbak` de siempre. Se descarga desde el panel
  (Respaldos → Descargar) y se restaura con su botón de Ajustes → Respaldos o con
  `node src/restaurar.js`, con la `BACKUP_PASSWORD`.

## Restaurar TODO el sistema de tiendas (desastre total)

```bash
npm run restaurar -- respaldo.json.gz --verificar
npm run restaurar -- respaldo.json.gz --sobrescribir
```

Acepta también el archivo de la nube (`tienda/_sistema/...bak`): lo descifra con
`NUBE_CLAVE` antes de abrirlo.

## Cuánto cuesta

Una tienda muy ocupada genera ~15 MB comprimidos al año. Con 60 negocios, entre
diarios y mensuales, se queda dentro de los 10 GB gratis de R2 los primeros años;
después son centavos de dólar por GB al mes.
