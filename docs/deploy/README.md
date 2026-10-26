# Desplegar el ambiente de prueba (staging)

Con esta guía levantás UNNA completo para que otra persona lo pruebe, **sin pagar nada**:

| Pieza | Dónde | Plan |
|---|---|---|
| Base de datos (Postgres) | Supabase | Free |
| API (NestJS) | Render, servicio `unna-api` | Free |
| Web (Next.js) | Render, servicio `unna-web` | Free |

Tardás unos 30 minutos. Los recursos los creás vos desde tu cuenta; nada se crea solo.

> **Es un ambiente de prueba.** Facturación (ARCA) y cobros (Mercado Pago) están simulados. No cargues datos reales de clientes ni cobres de verdad.

## Antes de empezar

- [ ] Cuenta en [Supabase](https://supabase.com) y en [Render](https://render.com).
- [ ] El repo en GitHub, con acceso desde tu cuenta de Render.
- [ ] `openssl` en tu máquina (viene en macOS y Linux) para generar los secretos.
- [ ] Una API key de [Resend](https://resend.com) (plan gratis). **La API no arranca sin `RESEND_API_KEY`**; ver el paso 3.

---

## 1. Crear la base en Supabase

1. En Supabase: **New project**.
2. **Region**: `East US (North Virginia)`. El blueprint pone la API en Render `virginia`; si están en la misma zona, cada consulta tarda menos.
3. **Database password**: generá una fuerte y guardala en tu gestor de contraseñas. La vas a necesitar en el paso 1.5.
4. Esperá a que el proyecto termine de crearse.
5. Tocá **Connect** y copiá la URL de **Session pooler**. Tiene esta forma:

   ```text
   postgresql://postgres.<ref-del-proyecto>:<tu-password>@aws-0-us-east-1.pooler.supabase.com:5432/postgres
   ```

6. Agregale `?sslmode=require` al final. Ese es tu `DATABASE_URL`:

   ```text
   postgresql://postgres.<ref>:<tu-password>@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require
   ```

### Qué conexión usar y por qué

| Conexión de Supabase | ¿Sirve? | Motivo |
|---|---|---|
| **Session pooler** (puerto 5432) | ✅ Usá esta | Funciona por IPv4 y soporta todo lo que necesita Prisma, incluido `migrate deploy`. |
| Direct connection (`db.<ref>.supabase.co:5432`) | ⚠️ Solo si tenés IPv4 | En el plan gratis es solo IPv6 y Render no siempre llega por IPv6. |
| Transaction pooler (puerto 6543) | ❌ No | No soporta bien las migraciones de Prisma (`migrate deploy`). |

### TLS (Prisma + Supabase)

- Supabase exige conexión cifrada. `sslmode=require` hace que Prisma cifre la conexión.
- **No bajes la seguridad**: nada de `sslmode=disable` ni `sslaccept=accept_invalid_certs`.
- Si la contraseña tiene caracteres especiales (`@`, `#`, `/`, `:`…), codificalos en la URL (por ejemplo `@` → `%40`).
- Si aparece `P1011` (error de TLS) o `P1001` (no llega a la base), revisá primero que sean el host y el puerto del **Session pooler** y que el proyecto no esté pausado.

### Migraciones

No tenés que correr nada a mano: **la API aplica las migraciones cada vez que arranca** (`prisma migrate deploy`, en `apps/api/scripts/start-prod.sh`).

- Base nueva y vacía: crea todas las tablas.
- Sin migraciones pendientes: no hace nada.
- Si falla, la API no arranca y el error queda en los logs de Render.

Si en cambio apuntás a una base **que ya existía** (creada con `prisma db push`), hacé primero el baseline que explica [migraciones.md](./migraciones.md). Si no, la migración intenta crear tablas que ya existen.

---

## 2. Crear los servicios en Render con el blueprint

El archivo [`render.yaml`](../../render.yaml) del repo define los dos servicios (`unna-api` y `unna-web`), en plan gratis, construidos con Docker desde la raíz del monorepo.

1. En Render: **New → Blueprint**.
2. Conectá GitHub si todavía no lo hiciste y elegí el repo.
3. Elegí la rama a desplegar. Render encuentra `render.yaml` en la raíz.
4. Revisá que la lista muestre `unna-api` y `unna-web`, los dos **Free**.
5. Completá los secretos (paso 3) y tocá **Apply**.

> Render pide los secretos (`sync: false`) **solo la primera vez** que aplicás el blueprint. Después, cualquier cambio se hace a mano en **Environment** de cada servicio.

---

## 3. Completar los secretos

### Las URLs públicas

Cada servicio queda en `https://<nombre>.onrender.com`. Si el nombre ya está tomado, Render le agrega un sufijo (por ejemplo `https://unna-api-x1y2.onrender.com`). Escribí lo que esperás ahora y, si cambió, corregilo después (ver [Si una URL salió distinta](#si-una-url-salió-distinta)).

### Generar los secretos

Corré esto en tu terminal. Cada comando da un valor distinto; **no reutilices el mismo valor para dos variables**.

```bash
openssl rand -base64 48   # JWT_SECRET
openssl rand -base64 48   # JWT_REFRESH_SECRET
openssl rand -base64 32   # MP_TOKEN_ENCRYPTION_KEY (tienen que ser exactamente 32 bytes)
```

Pegalos directo en Render. No los guardes en el repo, ni en un `.env` commiteado, ni en un chat.

### Qué va en cada variable

**Servicio `unna-api`**

| Variable | Valor |
|---|---|
| `DATABASE_URL` | La URL del Session pooler del paso 1.6, con `?sslmode=require` |
| `JWT_SECRET` | Generado con `openssl rand -base64 48` |
| `JWT_REFRESH_SECRET` | Otro generado con `openssl rand -base64 48` |
| `MP_TOKEN_ENCRYPTION_KEY` | Generado con `openssl rand -base64 32` |
| `FRONTEND_URL` | URL de la web, sin barra final: `https://unna-web.onrender.com` |
| `RESEND_API_KEY` | Tu API key de Resend (`re_...`) |

**Servicio `unna-web`**

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_API_URL` | URL de la API, sin `/api/v1` y sin barra final: `https://unna-api.onrender.com` |

Ya vienen fijas en el blueprint, no las toques: `NODE_ENV=production`, `UNNA_ENV=staging`, `TRUST_PROXY=1` (API) y `NEXT_PUBLIC_UNNA_ENV=staging` (web).

Sobre `RESEND_API_KEY`: la API no arranca sin un valor. Con una key real de Resend se mandan los mails (por ejemplo, recuperar contraseña). Con un valor de relleno que empiece con `re_`, la API arranca pero esos mails fallan.

Variables opcionales (agregalas a mano en **Environment** si las necesitás): `EMAIL_FROM` y `EMAIL_REPLY_TO` (remitente de Resend, que tiene que ser un dominio verificado), `JWT_EXPIRES_IN` (por defecto `15m`), `JWT_REFRESH_EXPIRES_IN` (`7d`), `JWT_RESET_SECRET` (si no está, usa `JWT_SECRET`) y `PUBLIC_BOARD_RATE_LIMIT` (`120`). La lista completa con comentarios está en [`.env.example`](../../.env.example).

### Si una URL salió distinta

- **Cambió la URL de la API:** en `unna-web` corregí `NEXT_PUBLIC_API_URL` y guardá con **Save, rebuild, and deploy**. La web necesita reconstruirse porque ese valor queda fijo al compilar.
- **Cambió la URL de la web:** en `unna-api` corregí `FRONTEND_URL` y guardá. Si no coincide, el navegador bloquea las llamadas a la API (CORS).

---

## 4. Verificar

1. En `unna-api` → **Logs**, tiene que aparecer `All migrations have been successfully applied.` (la primera vez) o `No pending migrations to apply.`, y después `API running`.
2. Abrí `https://<tu-api>.onrender.com/api/docs`: tiene que verse Swagger. Render usa esa misma ruta como health check.
3. Abrí `https://<tu-web>.onrender.com`: abajo a la izquierda tiene que verse **"Ambiente de prueba"**.
4. Creá una cuenta y hacé un pedido de punta a punta.

---

## Límites del plan gratis

| Servicio | Límite | Qué significa para vos |
|---|---|---|
| Render | Se apaga tras **15 minutos sin tráfico** | La primera visita después tarda **~1 minuto** en despertar. Avisale a quien prueba. |
| Render | Disco efímero | Las imágenes de productos que se suben **se pierden** en cada deploy, reinicio o apagado. |
| Render | 750 horas gratis por mes y por workspace | Un servicio apagado no consume horas. Si se agotan, Render suspende los servicios gratis hasta el mes siguiente. |
| Render | Sin shell ni pre-deploy | Por eso las migraciones corren al arrancar la API. |
| Supabase | Se pausa tras **~7 días sin actividad** | Reactivalo desde el panel de Supabase (**Restore**). Mientras está pausado, la API no arranca. |

Fuentes: [Render free](https://render.com/docs/free), [Render deploys](https://render.com/docs/deploys).

---

## Qué está simulado en staging

Con `UNNA_ENV=staging` la API corre en modo producción pero usa simuladores en vez de los servicios reales:

| Integración | En staging | Qué ves |
|---|---|---|
| ARCA (facturación) | Simulador | Se emiten comprobantes simulados: **no tienen validez fiscal**. |
| Mercado Pago (QR) | Simulador | El POS muestra **"Simular pago"** para marcar el QR como pagado. No se mueve plata real; no conectes una cuenta real. |

Sin `UNNA_ENV=staging`, la API con `NODE_ENV=production` **se niega a arrancar** si faltan las credenciales reales. Así un deploy de producción nunca queda con simuladores por error.

---

## Probar las imágenes en tu máquina (opcional)

Las imágenes de producción se construyen desde la **raíz del repo** (compilan `packages/domain`, `packages/shared` y la app):

```bash
docker build -f apps/api/Dockerfile -t unna-api .
docker build -f apps/web/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=http://localhost:3001 \
  --build-arg NEXT_PUBLIC_UNNA_ENV=staging \
  -t unna-web .
```

- La API escucha en `$PORT` (Render la fija sola) y arranca con `sh scripts/start-prod.sh`: aplica las migraciones y después levanta la API. Fuera de Docker, lo mismo es `npm run start:migrate` en `apps/api`.
- La web corre `next start -p ${PORT:-3000}`.
- Las dos corren con el usuario `node`, no con root.
- **Fijate a qué base apunta `DATABASE_URL` antes de correr la API**: aplica migraciones apenas arranca.

## Desarrollo local

`docker compose up` sigue usando los servidores de desarrollo, con `apps/api/Dockerfile.dev` y `apps/web/Dockerfile.dev` (los mismos que antes, renombrados). Los `Dockerfile` sin sufijo son solo para producción.

## Problemas comunes

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| `Missing API key. Pass it to the constructor new Resend(...)` | Falta `RESEND_API_KEY` | Cargala en `unna-api` (paso 3). |
| `P1001: Can't reach database server` | URL mal copiada o Supabase pausado | Revisá host y puerto del Session pooler; reactivá el proyecto. |
| `MP_TOKEN_ENCRYPTION_KEY es obligatoria en producción` o `... inválida: debe ser 32 bytes en base64` | Falta la clave o no tiene 32 bytes | Generala con `openssl rand -base64 32`. |
| `... el simulador ... no puede usarse en producción` | Falta `UNNA_ENV=staging` | Cargá `UNNA_ENV` con el valor exacto `staging`. |
| La web carga pero el login falla (CORS en la consola) | `FRONTEND_URL` no coincide con la URL de la web | Corregila, sin barra final. |
| La web llama a `localhost:3001` | `NEXT_PUBLIC_API_URL` vacía al compilar | Cargala y usá **Save, rebuild, and deploy**. |
| La primera carga tarda ~1 minuto | El servicio gratis estaba dormido | Es normal en el plan gratis. |
