# Migraciones de base de datos (Prisma)

El schema vive en `apps/api/prisma/schema.prisma` y las migraciones en `apps/api/prisma/migrations`. Hoy hay tres:

| Migración | Qué hace |
|---|---|
| `20261024235201_init` | Tablas de usuarios y negocios |
| `20261025013009_add_email_verified` | Columna `emailVerified` en usuarios |

| `20261025180000_catalog_sales_cash_fiscal_board_mercadopago` | Sucursales, catálogo, stock, pedidos, pagos, caja, comprobantes, Mercado Pago y QR |

> Todos los comandos se corren desde `apps/api`. Prisma lee `DATABASE_URL` de `apps/api/.env` si no la pasás vos: **fijate siempre a qué base apunta antes de correr nada**.

## 1. Crear un ambiente nuevo (base vacía)

```bash
cd apps/api
DATABASE_URL="<url de la base nueva>" npx prisma migrate deploy
```

Aplica las tres migraciones en orden y deja la base igual al schema actual. No borra nada y se puede correr en cada despliegue: si no hay migraciones pendientes, no hace nada.

## 2. Baseline de una base existente creada con `db push`

Si tu base ya tiene las tablas porque se creó con `prisma db push`, **no corras `migrate deploy` directamente**: intentaría crear tablas que ya existen. Marcá las migraciones como aplicadas. Esto solo escribe en la tabla `_prisma_migrations`; no toca tus datos.

Lo corre el dueño de esa base, contra esa base:

```bash
cd apps/api
export DATABASE_URL="<url de tu base>"

# 1. Confirmá que la base ya coincide con el schema (tiene que decir "No difference detected.")
npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --exit-code

# 2. Marcá las tres migraciones como aplicadas
npx prisma migrate resolve --applied 20261024235201_init
npx prisma migrate resolve --applied 20261025013009_add_email_verified
npx prisma migrate resolve --applied 20261025180000_catalog_sales_cash_fiscal_board_mercadopago

# 3. Verificá (tiene que decir "Database schema is up to date!")
npx prisma migrate status
```

Si el paso 1 muestra diferencias, tu base no está al día con el schema: sincronizala primero (o pedí ayuda) antes de marcar nada.

## 3. Cambios de schema de acá en adelante

- Editá `schema.prisma` y generá la migración con:

  ```bash
  DATABASE_URL="<url de una base local o aislada>" npx prisma migrate dev --name <descripcion_corta>
  ```

- Usá siempre una base local o aislada: `migrate dev` puede pedir resetear la base.
- **No uses más `prisma db push`**: cambia la base sin dejar migración y el próximo ambiente queda desfasado.
- Commiteá la carpeta nueva de `prisma/migrations` junto con el cambio de `schema.prisma`.
- Nunca edites una migración que ya se aplicó en algún ambiente; hacé una nueva.
