# UNNA Platform - Réplica de fu.do

## Specs

### S1: Landing Page Pública
Alcance vigente (reescrito por S11 y L30–L31; el pedido original está literal en L1):
- Hero para cafés take away con el lema "El sistema para cafés take away." y la bajada "Vendé rápido en el mostrador, cobrá fácil y controlá tus cobros y tu stock."
- Funcionalidades separadas en "Disponible hoy" (solo lo que existe) y "Próximamente" (marcado como tal).
- Tipos de café (take away, especialidad, pocas mesas, panaderías con café, carritos, cadenas).
- Sin estadísticas, testimonios ni clientes que UNNA no tenga.
- CTA final a crear cuenta.

### S2: Página de Registro (Crear Cuenta)
Replicar https://fu.do/es-ar/crear-cuenta/ con formulario validado:
- **Nombre del negocio**: obligatorio, 3-45 chars, alfanumérico + & - _
- **Tu nombre**: obligatorio, 3-45 chars
- **Teléfono**: obligatorio, formato válido AR
- **Email**: obligatorio, formato válido
- **Contraseña**: obligatorio, min 8 chars, mayúscula, minúscula, número
- **Confirmar contraseña**: obligatorio, debe coincidir
- **Checkbox**: Aceptar Condiciones y Políticas (obligatorio)
- Mensaje: "Sin tarjeta de crédito. Cancelá cuando quieras."

### S3: Backend API (NestJS + Supabase)
- Autenticación: registro, login, JWT, refresh tokens
- **Auth avanzado**: recuperar contraseña, verificación email, roles/permisos (owner, admin, manager, cashier, waiter)
- Validación server-side mirrorando reglas del frontend
- Persistencia en Supabase (PostgreSQL)
- Arquitectura hexagonal + DDD + SRP + DRY

### S4: Frontend (Next.js + React + TypeScript)
- Landing page responsive
- Página de registro con validación en tiempo real
- Integración con API backend
- Tailwind CSS para styling

### S5: Business Onboarding (Post-registro)
Flow completo tras registro para configurar el negocio:
- **Datos fiscales AR**: CUIT (validado algoritmo 11), Condición IVA (RI/Monotributo/Exento/CF), IIBB, Punto de venta (4 dígitos), Domicilio fiscal
- **Sucursales**: Nombre, dirección, teléfono, email, horarios, esPrincipal
- **Horarios de atención**: Por día (lunes-domingo), abierto/cierra, cerrado todo el día
- **Configuración inicial**: Nombre comercial, logo, moneda, zona horaria, idioma
- **Validaciones**: CUIT único por business, al menos 1 sucursal principal, horarios consistentes
- **Endpoints**: POST /business/onboard, GET /business/me, PATCH /business/me, POST /business/me/sucursales, PATCH /business/me/sucursales/:id

### S6: Productos / Carta
"T23: Productos/Carta management (categorías, productos, modificadores, precios, stock)"

### S7: Ventas / POS
"T24: Ventas/POS module (orders, payments, receipts)"

### S8: Lint en CI antes de promover a producción
"Re organiza trodas las ramas, dejemo main como la de produccion , develop como la de desarrollo y borra todas las obsoleta" — opción elegida: "Primero arreglar lint: Configurar ESLint y corregir los ~300 errores previos antes de promover."

### S9: Deuda técnica pendiente
Opción elegida por el usuario: "Deuda técnica pendiente: Pagos concurrentes en transacción, tipo de movimiento de stock por defecto, tipos de Order.create, warnings del dashboard." (respuesta a "¿Con qué seguimos en la app?").

### S10: Frontend de catálogo y POS + bloqueo completo de pedidos
Usuario: "1. Frontend de catálogo y POS: es la que recomiendo. El catálogo y las ventas ya funcionan en
    la API, pero nadie los puede usar desde la web. y Completar el bloqueo de pedidos: sumar al bloqueo agregar o quitar ítems, el descuento y la
    cancelación."
Defaults de producto (decididos por el orquestador, no pedidos explícitamente):
- Catálogo en `/dashboard/catalogo` con pestañas Productos, Categorías, Modificadores, Stock. Precios se ingresan en pesos y viajan en centavos.
- POS en `/dashboard/pos`: grilla de productos activos por categoría; el primer producto crea el pedido y los siguientes se agregan; los totales siempre vienen del servidor; diálogo de modificadores respeta mínimo/máximo/obligatorio; cobro con pagos divididos y saldo restante; al quedar pagado se emite ticket; lista de pedidos abiertos para retomar; acciones de estado (confirmar, preparar, listo, entregar, cancelar con motivo).
- Negocio actual = primero de `GET /businesses` (como sucursales/horarios).

### S11: Posicionamiento — café take away
Usuario: "La diferencia con nuestra competencia q esto seria mas para cafe take away no para restaurnte o lo demas"

### S12: Facturación ARCA + caja y turnos
Usuario: "Si" (a "¿Arrancamos con facturación ARCA junto con caja y turnos?"). Respuestas a las decisiones:
- Conexión ARCA: "Delegación al CUIT de UNNA (Recomendado)".
- Homologación: "Q es un  CUIT con certificado de homologación ??" → explicado; se construye con ARCA simulado detrás de un puerto hasta tener credenciales (prueba real pendiente).
- Caja: "No, caja abierta obligatoria (Recomendado)".
- Comprobantes: "B, C y A (Recomendado)".
Reglas de diseño (orquestador):
- Caja: un turno abierto por sucursal; fondo inicial, ingresos/retiros, cierre con esperado vs declarado por medio de pago; cada pago queda asociado al turno; sin caja abierta no se crean pedidos ni se cobran; cierre y pagos serializados.
- Facturación: responsable inscripto emite A (cliente con CUIT) o B; monotributo/exento emite C; IVA discriminado por alícuota en A/B; numeración secuencial por (punto de venta, tipo) a partir del último autorizado, bajo bloqueo; CAE y vencimiento guardados; QR ARCA; si ARCA rechaza o falla, el pedido sigue pagado y el comprobante se puede reintentar. Ticket no fiscal con numeración secuencial (ya no aleatoria).

### S13: Modo hora pico + pantalla de barra + pantalla pública de pedidos
Usuario: "Si" (a arrancar por modo hora pico con pantalla de barra y aviso de "listo"). Respuestas:
- Aviso de listo: "Pantalla pública de pedidos (Recomendado)".
- Entrada a barra: "Al cobrarlo (Recomendado)".
- Favoritos: "Fijados + más vendidos (Recomendado)".
Reglas de diseño (orquestador):
- Favoritos: el dueño fija productos (marca en el producto); se completan con los más vendidos de los últimos días (pedidos cobrados).
- POS: franja de favoritos, "/" enfoca la búsqueda y Enter agrega el primer resultado, repetir el último pedido, nombre del cliente opcional.
- Barra: por sucursal, solo pedidos cobrados y no cerrados de hoy, en columnas Nuevos / En preparación / Listos, con acciones que usan los estados existentes; se actualiza sola.
- Pantalla pública: sin sesión, con un token secreto por sucursal que el dueño genera y puede regenerar; muestra solo número corto del pedido, primer nombre del cliente y estado (en preparación / listo), de hoy y cobrados. Endpoint público: riesgo de seguridad.

### S18: Llamadas externas fuera del lock + detalles de listas
Usuario: "Soluciona estos dos errores: 1. Sacar las llamadas a Mercado Pago y ARCA del lock del pedido. Es el riesgo de performance más importante que queda; toca cobros y facturación, así que va como tarea propia. 2. Dos detalles de la web: el \"Ver más\" de caja si cambiás de sucursal en el medio, y un error de stock que queda visible después de reintentar." → "Primero eso, después lo nuevo (Recomendado)".
Reglas (orquestador):
- Crear un cobro QR no llama a Mercado Pago con el lock del pedido tomado: se valida y reserva el cobro en una transacción corta, se llama a Mercado Pago sin lock y se guarda el resultado en otra transacción corta. Siguen valiendo: un solo cobro pendiente por pedido, idempotencia con Mercado Pago, un solo pago por orden.
- Emitir un comprobante no llama a ARCA con locks tomados: se reserva el número en una transacción corta, se autoriza en ARCA sin lock y se confirma (o se libera / deja reintentable) en otra transacción corta. Siguen valiendo: numeración correlativa sin huecos ni duplicados, un solo comprobante aprobado por pedido, rechazos y timeouts dejan borrador reintentable.
- Caja: "Ver más" nunca mezcla cajas de otra sucursal; al cambiar de sucursal el historial y su cursor se reinician y una respuesta tardía de la sucursal anterior se descarta.
- Stock: un error de "Ver más" desaparece al reintentar con éxito o al cambiar de producto.

### S19: Landing al día, footer sin links rotos y contraste
Usuario: "La landing está desactualizada: todavía muestra como \"Próximamente\" ARCA, caja, QR y modo hora pico, que ya están hechos." y "Footer y contraste: hay links del footer a páginas que no existen y badges con texto blanco sobre el verde claro, que no pasan contraste."
Reglas (orquestador):
- "Disponible hoy" incluye facturación ARCA, caja y turnos, cobro con QR de Mercado Pago, modo hora pico y pantalla de pedidos; "Próximamente" solo lo que falta (tarjeta de sellos, costo por taza; pedido anticipado hasta que S20 esté mergeado).
- Ningún link del footer apunta a una página que no existe (se quitan o apuntan a secciones reales).
- Texto blanco nunca sobre #16a34a: usar #15803d (unna-green-dark) u otro par con contraste AA, verificado por test.

### S20: Pedido anticipado
Usuario: "Hace la numero 6" (pedido anticipado). Respuestas: "Online con Mercado Pago al pedir (Recomendado)", "Página de seguimiento (Recomendado)", "Lo antes posible (Recomendado)".
Reglas (orquestador):
- Cada sucursal puede activar el pedido anticipado; tiene un link público (y su QR para imprimir) con el menú de productos activos.
- El cliente arma el pedido (con opciones del café), deja su nombre, y paga online con Mercado Pago desde el celular en la cuenta del café; sin pago aprobado el pedido no llega a la barra.
- Pagado, el pedido entra a la barra con el nombre del cliente y tipo "retiro", y cuenta como venta de la caja abierta de la sucursal.
- El cliente queda en una página de seguimiento que se actualiza sola: recibido → en preparación → listo para retirar, con tiempo estimado.
- Solo se aceptan pedidos con la sucursal abierta (horario) y con caja abierta; si no, el link lo explica.
- Endpoints públicos con límite por IP; precios siempre del servidor; el cliente no ve datos de otros pedidos.

### S17: Mejoras rápidas de performance
Usuario: "ANaliza toda la performance de la app y rendimiento" → informe; "ok hacelo" a la recomendación: "hacer 1, 2, 3 y 6, más los índices" (el 4, locks con Mercado Pago/ARCA, queda como tarea propia).
Reglas (orquestador), con lo medido: GET orders 73 ms y 1 MB sin comprimir con ~750 pedidos; barra p95 253 ms con 10 pantallas.
- Listados paginados: `GET orders`, `GET receipts`, `GET cash-sessions` y `GET stock/movements` aceptan `limit` (por defecto 50, máximo 200) y `cursor` (id del último elemento recibido); orden más reciente primero; la respuesta sigue siendo un array y el header `X-Next-Cursor` trae el cursor de la página siguiente cuando hay más. Los listados de pedidos y comprobantes no incluyen ítems (traen `itemCount`); el detalle sí.
- `GET orders` acepta `open=true` (pedidos no cerrados); el POS pide los abiertos de hoy con `open=true` y `from` = inicio del día.
- Respuestas HTTP comprimidas (gzip) cuando el cliente lo acepta.
- El guard de dueño del negocio consulta solo `id` y `ownerId`, sin cargar el negocio completo; mismos códigos y mensajes (404 "Negocio no encontrado", 403 "No tenés permisos sobre este negocio").
- Índices: pedidos por negocio + estado de pago + fecha; ítems por producto; comprobantes por pedido; movimientos de stock por producto + fecha. Con una migración nueva.
- Health check liviano `GET /api/v1/health` (sin base de datos); Render apunta a él; Swagger apagado en producción salvo staging.
- La barra, la pantalla pública y el cobro QR pausan el polling con la pestaña oculta y refrescan al volver.
- Guía de deploy: `connection_limit` en `DATABASE_URL`.

### S16: Ambiente de prueba desplegable (gratis)
Usuario: "Ya se puede hacer el deploy de db , bacj y front para pasarselo a alguien para que lo pruebe ? o  no ?". Respuestas: plataformas "Solo plataformas gratuitas"; cuándo: "Después del QR (Recomendado)"; "ok" a Supabase (base) + Render (API y web).
Reglas de diseño (orquestador):
- Migraciones Prisma completas: una base vacía queda igual al schema actual solo con `prisma migrate deploy`; las bases existentes creadas con `db push` se marcan como aplicadas (baseline) sin perder datos.
- Build de producción del API y la web desde el monorepo (paquetes domain y shared compilados), sin modo desarrollo.
- Modo staging explícito (`UNNA_ENV=staging`): con NODE_ENV=production permite los simuladores de ARCA y Mercado Pago y muestra "Ambiente de prueba" en la web; sin esa variable producción sigue negándose a arrancar con simuladores.
- Despliegue: Supabase (Postgres) + Render (API y web, plan gratis), con blueprint y guía paso a paso; los recursos los crea el usuario o se crean con su confirmación.

### S15: Cobro con QR de Mercado Pago
Usuario: "qr de lercado pago". Respuestas:
- Cuenta: "La del café, vía 'Conectar con MP' (Recomendado)".
- Tipo de QR: "Híbrido: QR impreso + QR en pantalla (Recomendado)".
Reglas de diseño (orquestador):
- Integración con la Orders API vigente (POST /v1/orders, type "qr", modo híbrido); las APIs QR anteriores están en migración.
- Cada negocio conecta su propia cuenta con OAuth; los tokens se guardan cifrados (AES-256-GCM) y nunca se devuelven ni se loguean; el negocio puede desconectar.
- Cada sucursal tiene su tienda y su caja (POS) en Mercado Pago, creadas por UNNA; el QR fijo de la caja se puede imprimir desde el panel.
- En el POS, "Cobrar con QR" crea la orden de Mercado Pago por el saldo pendiente y muestra el QR en pantalla; el cliente puede pagar con ese o con el impreso.
- El pago se confirma solo por datos consultados a Mercado Pago (webhook con firma validada + consulta de la orden); se registra una sola vez como pago del pedido, en la caja abierta, con la referencia de Mercado Pago.
- Se puede cancelar un cobro QR pendiente; un pedido pagado por QR que se anula necesita devolución.
- Sin credenciales de la aplicación (MP_CLIENT_ID/MP_CLIENT_SECRET) se usa un simulador, que nunca corre en producción. Endpoint público (webhook) y credenciales: riesgo de seguridad.

### S14: Refactor de arquitectura (sin cambio de comportamiento)
Usuario: "Hay archivo s de mas de 400 lineas y estas usando los patrones de Hexagonal srp dry y ddd ??" → elige "Refactor antes del merge".
Reglas (orquestador):
- Ningún archivo de código de más de 400 líneas; un archivo por clase de caso de uso, controlador y adaptador del catálogo.
- Hexagonal/DDD: el "no encontrado" deja de detectarse por texto ("no encontrad"); los casos de uso devuelven errores tipados y el filtro HTTP mapea por tipo, con los mismos mensajes y códigos HTTP que hoy.
- SRP en web: el POS se divide en hooks/componentes con una responsabilidad; `lib/api.ts` se divide por recurso manteniendo su API pública.
- Comportamiento idéntico: mismos tests verdes sin cambiar sus aserciones, smoke 82/82.

## Architecture Constraints (MANDATORIOS)

- **Hexagonal Architecture**: Domain core aislado, ports/adapters para infraestructura (DB, HTTP, external APIs)
- **DDD**: Bounded contexts claros (Auth, Business, Billing, Delivery, Inventory, Reporting), Aggregates, Entities, Value Objects, Domain Events, Repositories
- **SRP**: Una clase = una responsabilidad. Servicios pequeños y enfocados.
- **DRY**: Código compartido en kernel/domain, nada de duplicación entre módulos.

## Stack

- **Backend**: NestJS + TypeScript + Supabase (PostgreSQL) + Prisma ORM
- **Frontend**: Next.js 14+ (App Router) + React 18 + TypeScript + Tailwind CSS
- **Auth**: JWT + bcrypt + Supabase Auth (opcional) o custom
- **Validación**: class-validator (backend) + Zod (frontend)

## Project Structure (Monorepo)

```
unna/
├── apps/
│   ├── api/          # NestJS backend
│   └── web/          # Next.js frontend
├── packages/
│   ├── domain/       # Domain kernel (shared types, value objects, events)
│   ├── shared/       # Shared utilities, DTOs, constants
│   └── ui/           # Shared React components (opcional)
├── odd/
│   └── tasks/
│       └── unna-platform.md
└── turbo.json        # Turborepo config
```

## Tasks

| ID | Spec | Route | Description | Commit |
|----|------|-------|-------------|--------|
| T1 | S1,S2 | setup | Inicializar monorepo Turborepo + estructura hexagonal base | f5aec59 |
| T2 | S3 | backend | Domain kernel: Value Objects (Email, Phone, Password, BusinessName), Domain Events, Aggregate Roots | f5aec59 |
| T3 | S3 | backend | Auth Context: User Aggregate, Register/Login Use Cases, JWT Port/Adapter, Repository Port/Adapter (Prisma/Supabase) | f5aec59 |
| T4 | S3 | backend | Business Context: Business Aggregate, Onboarding Use Case | |
| T5 | S3 | backend | API Controllers + Validation Pipes + Global Exception Filter | f5aec59 |
| T6 | S3 | backend | Prisma Schema + Supabase Connection + Migrations | f5aec59 |
| T7 | S4 | frontend | Next.js App + Tailwind + Shared UI Components (Button, Input, Checkbox, Form) | f5aec59 |
| T8 | S1 | frontend | Landing Page: Hero, 3 Pilares, Funcionalidades, Testimonios, Stats, Business Types, CTA | f5aec59 |
| T9 | S2 | frontend | Register Page: Formulario con Zod validation, React Hook Form, API integration | f5aec59 |
| T10 | S1,S2 | integration | E2E: Registro completo frontend→backend→DB | f5f4309, 0e0087d |
| T11 | - | polish | README, .env.example, Docker compose, CI/CD básico | f5aec59 |
| T12 | S3 | backend | Auth avanzado: ForgotPassword + ResetPassword UseCases + endpoints | 3a25849 |
| T13 | S3 | backend | Auth avanzado: VerifyEmail UseCase + endpoint + emailVerified en User | 470c4fb |
| T14 | S3 | backend | Auth avanzado: Roles/Permisos (UserRole VO, hierarchy, hasRole, canManage) | 61a87a3 |
| T15 | S3 | backend | Auth avanzado: Tests unit + E2E para forgot/reset/verify/roles | 5482859 |
| T16 | S5 | backend | Domain: Business Aggregate + Value Objects (CUIT, Address, Schedule, BusinessSettings) | 74d0fb7 |
| T17 | S5 | backend | UseCase: OnboardBusiness (datos fiscales + sucursales + horarios) | 74d0fb7 |
| T18 | S5 | backend | UseCase: UpdateBusinessSettings + ManageSucursales + ManageHorarios | c50febe
| T19 | S5 | backend | Controller: POST /business/onboard, GET/PATCH /business/me, sucursales CRUD | 74d0fb7 |
| T20 | S5 | backend | Prisma: Business, Sucursal, Horario models + migrations | 74d0fb7 |
| T21 | S5 | frontend | Onboarding Wizard (4 steps: fiscal → sucursales → horarios → confirmación) | dbcc245 |
| T22 | S5 | integration | Tests unit + E2E onboarding completo | dbcc245 |
| T23 | S6 | backend | Catálogo: categorías, productos, modificadores, listas de precios, stock (dominio + Prisma + API) | 6578d11, e28e1cd, 8b44f4d |
| T24 | S7 | backend | Ventas/POS: pedidos, pagos (split), comprobantes; precios server-side; guard de dueño | 6578d11, 846d915, e28e1cd, 6a7adf0 |
| T27a | S8 | worker | Lint apps/api/src/business (197) | a5f65e7 |
| T27b | S8 | worker | Lint apps/api/src/{auth,common,email} + packages (75) | e887951, 81d611d |
| T27c | S8 | worker | Lint apps/web (25) | 082760e |
| T28a | S9 | worker | Pagos: chequeo de saldo + guardado en transacción con lock del pedido (sin sobrepago concurrente) | 203ecca |
| T28b | S9 | worker | Order.create sin status/orderId en el input (sin casts en ventas); dirección del comprobante reconstituida | 203ecca |
| T28c | S9 | worker | DTOs class-validator para bodies del catálogo (sin errores internos en 400) | f4b40cc |
| T28d | S9 | inline | removeStock: type por defecto 'out' | de72f1a |
| T28e | S9 | inline | DELETE sucursal inexistente → 404 | de72f1a |
| T28f | S9 | inline | Warnings exhaustive-deps del dashboard | 3e7f444 |
| T28g | S9 | inline | uploads/ en .gitignore | see L23 |
| T29a | S10 | inline | GET /businesses y /businesses/:id reales (presenter), tipos + métodos de catálogo/ventas en lib/api | 17c11fb, 31203d5 |
| T29b | S10 | worker | UI de catálogo (/dashboard/catalogo) | 5a8e7c3 |
| T29c | S10 | worker | UI de POS (/dashboard/pos) | 3341df9 |
| T29d | S10 | worker | Lock del pedido en addItem/removeItem/applyDiscount/changeStatus (la ruta DELETE de ítem ya existía) | 831fcf5 |
| T30a | S12 | inline | Contratos: modelos Prisma (CashSession, CashMovement, Payment.cashSessionId, campos fiscales del Receipt, secuencias) y puertos de dominio | 1d47ff0 |
| T30b | S12 | worker | Caja backend: agregado CashSession, adapter, casos de uso, endpoints; pedidos y pagos exigen caja abierta | b8732d5 |
| T30c | S12 | worker | Facturación backend: reglas A/B/C, IVA por alícuota, numeración secuencial, QR, ARCA simulado, emisión | df544d5 |
| T30d | S12 | inline | Integración: módulo, smoke real (caja, facturas, carreras de numeración y cierre) | df544d5, 8fde4ef |
| T30e | S12 | worker | Web: caja (abrir, movimientos, cerrar) y POS con comprobante fiscal (CAE, QR) | 481962e |
| T30f | S12 | worker | Adaptador ARCA real (WSAA + WSFEv1) con tests de XML; prueba en homologación bloqueada por credenciales | 8fde4ef |
| T31a | S13 | worker | Backend: favoritos, más vendidos, cola de barra, token de pantalla y endpoint público | e5570f1, 8837894 |
| T31b | S13 | worker | Web: POS modo hora pico + favoritos en catálogo | e109b4d |
| T31c | S13 | worker | Web: pantalla de barra + pantalla pública | 6d999ab |
| T31d | S13 | inline | Integración, smoke real (incl. aislamiento del endpoint público), PRs | see L36 |
| T32a | S14 | worker | API: separar casos de uso, controladores y adaptadores del catálogo en un archivo por clase | de521bd |
| T32b | S14 | worker | Web: dividir POS (hooks/componentes) y lib/api.ts por recurso | 267c657 |
| T32c | S14 | worker | Dominio: OrderItem y ReceiptItem en archivos propios | 6a0521e |
| T32d | S14 | inline | Errores tipados (NotFound) en lugar del regex de texto; integración, smoke, revisión y PRs | cbf77f9 |
| T31e | S13 | inline | Fix renovación de sesión concurrente (revisión); propuestas aprobadas: dashboard sin chrome público, POS en "Para llevar" | 02ceca2, 2c71785, 1fc3bda |
| T33a | S15 | worker | API: conexión OAuth con Mercado Pago (tokens cifrados, refresh, desconectar), tienda y caja por sucursal, puerto + adaptador real + simulador | 3826b3d |
| T33b | S15 | worker | API: cobro QR (orden híbrida, estado, cancelar), webhook público con firma, registro de pago idempotente | a628929, ad7804e |
| T33c | S15 | worker | Web: conectar Mercado Pago en configuración, cobro QR en el POS, QR imprimible por sucursal | f812706, c2676b8, 7ac4c8a |
| T33d | S15 | inline | Integración, smoke con simulador, revisión, PRs | see L40 |
| T34a | S16 | worker | Migraciones Prisma completas + baseline de bases existentes, verificadas en schema aislado | 5a0cb34 |
| T34b | S16 | worker | Modo staging (simuladores permitidos solo con UNNA_ENV=staging) + aviso en la web | b12e0ac |
| T34c | S16 | worker | Build de producción del monorepo (Dockerfiles, render.yaml) y guía de despliegue | f815abd, 273e627 |
| T34d | S16 | inline | Integración, smoke contra base creada con migraciones, revisión, PR, despliegue con el usuario | see L42 |
| T35a | S17 | worker | API: paginación, open=true, compresión, guard liviano, índices + migración, health, Swagger, guía | 50c534f, e67791b |
| T35b | S17 | worker | Web: pausar polling con pestaña oculta; POS pide abiertos de hoy; caja y stock con "Ver más" | 564037b, 891a657 |
| T35c | S17 | inline | Integración, medición antes/después, smoke, revisión, PR | see L44 |
| T36a | S18 | worker | API: cobro QR y emisión ARCA sin llamadas externas dentro del lock | |
| T36b | S18 | inline | Web: "Ver más" de caja al cambiar de sucursal; error de stock al reintentar | |
| T37 | S19 | inline | Landing, footer y contraste | |
| T38a | S20 | explore | Investigar pago online de Mercado Pago (Orders API online / Checkout) con OAuth | |
| T38b | S20 | worker | API: menú público, pedido anticipado, pago online, webhook, seguimiento | |
| T38c | S20 | worker | Web: página pública de pedido y de seguimiento; activar y QR en el panel | |
| T38d | S20 | inline | Integración, smoke, revisión, PRs | |

## Log

**L1**: Usuario solicita replicar fu.do (landing + registro) con NestJS, Supabase, Next.js, React. Arquitectura hexagonal + DDD + SRP + DRY obligatoria.
**L2**: Nombre del proyecto cambiado a **UNNA** (una sola plataforma).
**L3**: Fix 3 auth bugs: confirmPassword validation, acceptTerms boolean, phone 500→400 via DomainExceptionFilter.
**L4**: Auth avanzado Phase 1: EmailPort + ResendAdapter (Commit 1/5).
**L5**: Auth avanzado Phase 1: ForgotPassword + ResetPassword UseCases + endpoints (Commit 2/5).
**L6**: Auth avanzado Phase 1: VerifyEmail UseCase + endpoint + emailVerified migration (Commit 3/5).
**L7**: Auth avanzado Phase 1: Roles/Permisos (UserRole VO, hierarchy, hasRole, canManage) (Commit 4/5).
**L8**: Auth avanzado Phase 1: Tests unit + E2E para forgot/reset/verify/roles (Commit 5/5).
**L9**: Inicio Fase 2 - Business Onboarding (S5): Domain VOs, OnboardBusiness UseCase, endpoints, wizard frontend.
**L10**: Business Onboarding completo: UpdateSettings, ManageSucursales CRUD, ManageHorarios, endpoints REST completos.
**L11**: Usuario: "T23: Productos/Carta management (categorías, productos, modificadores, precios, stock)".
**L12**: Usuario: "T24: Ventas/POS module (orders, payments, receipts)".
**L13**: Incidente durante T24: reinstalar Prisma subió a 8.0.0-rc.27/@prisma/client 7.10.1; revertido a 5.22.0 (package.json + package-lock desde git). Causa real del error de schema: relación `product` agregada por sed en `Payment`.
**L14**: Defectos de T23 detectados y corregidos en T24: `UserRepositoryPort` alterado (rompía auth), adapters devolvían objetos planos, `deleteMany` dentro de `upsert.create`, controllers devolvían 500, sin verificación de dueño del negocio (riesgo de autorización), default de lista de precios no se desmarcaba.
**L15**: Usuario pregunta si se usan subagentes; respuesta: trabajo inline hasta ahora; se corre verificación independiente por el riesgo de autorización.
**L16**: Smoke HTTP real (schema aislado) encontró: onboarding 500 (`deleteMany` en `upsert.create`, previo T17), `PATCH settings` 500 (VOs no reconstituidos, previo T18), items/descuento modificables tras pago parcial (T24). Riesgo de pérdida de datos: el adapter de negocio recreaba sucursales en cada save y `Order/Receipt→Sucursal` era Cascade → pasan a Restrict y upsert por sucursal. Resultado final 31/31; suites api 22, domain 74, web 42, e2e auth 12 (schema aislado).
**L17**: Verificación independiente (gentle-ai-verify): S6 FAIL por cross-tenant (dueño de B, con su propio businessId e ids de A, leía/sobrescribía stock, movimientos, productos por categoría; parentId/modifierGroupIds/components/uploadImage sin validar negocio), S7 CONCERN (cancelar con pago parcial, orderNumber `@unique` global con colisiones, FK P2003 → 500). Corregido con TDD (RED observado): validación de pertenencia en CategoryUseCase/ProductUseCase/StockUseCase, cancelación rechazada con pagos registrados, `@@unique([businessId, orderNumber])` + reintento ante colisión, P2002/P2003 → 409 en `unwrap` y filtro global, upload de imagen con `memoryStorage` (antes rechazaba toda imagen: el validador de magic numbers no tiene buffer con diskStorage) y escritura sólo tras validar producto. Tests nuevos: `catalog-tenant.use-case.spec.ts` (9), `sales.use-case.spec.ts` (2). Smoke ampliado 46/46; suites api 33, domain 74, web 42, e2e auth 12. Pendiente: race de pagos concurrentes sin transacción, numeración secuencial de comprobantes (T26), DTOs class-validator en catálogo, DELETE de sucursal inexistente devuelve 200 (previo T18), `uploads/` sin `.gitignore`.**L18**: Usuario: "Hacelo" (commits). Rama `feat/t21-t24-catalog-sales` desde `main`: 4c0421c rebranding FUDO→UNNA (trabajo previo, commit aparte), dbcc245 web T21/T22/T18, 6578d11 dominio T23/T24, 846d915 fix adapter de negocio (riesgo de datos, commit propio), e28e1cd schema, 8b44f4d API catálogo T23 (verificado aislado: tsc 0, 31 tests), 6a7adf0 API ventas T24. Los slices superan ~400 líneas (≈9.7k en total): para revisión conviene PRs encadenados por commit.
**L19**: Usuario: "Si jace push pr encadentado y merge a develop p la rama princiapl". `origin/main` y `origin/develop` sólo tenían un `.gitkeep` sin historia común; se une con merge `--allow-unrelated-histories` (rama `chore/connect-history`). CI local antes del push: build web fallaba (metadata en página `'use client'` de onboarding; `useSearchParams` sin Suspense en horarios) → corregido dentro de dbcc245 (fixup). Lint de CI falla en todo el repo por ausencia de configuración ESLint (previo, fuera de alcance).
**L20**: Usuario: "Re organiza trodas las ramas, dejemo main como la de produccion , develop como la de desarrollo y borra todas las obsoleta". Cadena #1–#8 mergeada en develop (02fe7c3); quedan sólo main y develop; borradas unna-mvp y ramas de la cadena (todas contenidas en develop). Al preguntar si promover develop→main, eligió "Primero arreglar lint". Config `.eslintrc.json` raíz (eslint:recommended + @typescript-eslint/recommended + next/core-web-vitals en web) en rama chore/eslint-setup; ~300 errores previos, se corrigen sin bajar reglas.
**L21**: Lint corregido con 3 workers en paralelo (superficies disjuntas), sin bajar reglas ni `eslint-disable`: business 197, auth/common/email+packages 75, web 25 → 0 errores (quedan 2 warnings `exhaustive-deps`). Hallazgos: `HorarioEditor` nunca llamaba `onSubmit` ("Guardar horarios" no guardaba, T18) → fix TDD 22788a6; `findByOwnerId` con `toDomain` sin bind → corregido en a5f65e7. Integración: lint 4/4, build 4/4, tsc ×4, tests domain 74, shared 9, web 44, api 33, smoke HTTP 46/46 (schema aislado, eliminado). Pendiente: `removeStock` sin `type` por defecto, tipo de `Order.create` exige `status`/`orderId` que completa el propio método (obliga a un cast).
**L22**: Usuario: "deja todo en develop y sigamos con la app". PR #10 (develop→main) cerrado: main exige 1 aprobación con enforce_admins y no hay otro colaborador. A "¿Con qué seguimos en la app?" eligió "Deuda técnica pendiente". Rama chore/tech-debt; numeración secuencial de comprobantes queda para T26.
**L23**: T28 completo. Pagos serializados por pedido (transacción + `SELECT … FOR UPDATE`) verificado contra Postgres: 10 pagos concurrentes que superan la mitad del saldo → 1 aceptado, 9 rechazados ("saldo pendiente"), 1 guardado; 5 concurrentes que suman el saldo → todos aceptados y pedido pagado. DTOs del catálogo (body malformado → 400 de validación; `priceDelta` negativo permitido, corregido sobre la versión del worker). T28f destapó un bug real: horarios ignoraba `?sucursal=` (closure viejo) → fix TDD. T28g `.gitignore` en el commit de cierre. Verificación: lint 4/4, build 4/4, tsc ×4, tests domain 74, shared 9, web 47, api 108, smoke 52/52. Pendiente conocido: addItem/removeItem/applyDiscount/cancel siguen sin el lock del pedido; timeout de transacción de Prisma (5 s) bajo mucha contención.
**L24**: Usuario eligió frontend de catálogo y POS + completar el bloqueo de pedidos (S10). Hallazgos previos: `GET /businesses` devolvía siempre `[]` y `GET /businesses/:id` era un stub (las páginas de sucursales/horarios no podían cargar el negocio en uso real); el negocio se serializaba como `{ props }`. (Corrección: la ruta `DELETE …/orders/:orderId/items/:itemId` ya existía; el grep inicial no incluía `@Delete`.) Respuestas reales capturadas en `apps/web/src/__tests__/fixtures/api-shapes.json` como contrato.
**L25**: T29 completo. Revisión de integración: dos parsers de pesos con reglas distintas (catálogo rechazaba "1.500", POS lo aceptaba) → unificados en `lib/money.ts`. Prueba en navegador (Playwright) contra API real en schema aislado: catálogo (categoría, grupo con opción negativa, producto "1.500" → $1.500,00, stock), POS (modificador obligatorio, totales del servidor, descuento, pago dividido, ticket, cancelación con pagos rechazada, retomar pedido), sucursales/horarios ahora cargan el negocio. Encontró bug: opción con `priceDelta` negativo rompía la venta ("Monto no puede ser negativo") → fix TDD en ventas (831fcf5) y dominio (fa2d791). Verificación: lint 4/4, build 4/4, tsc ×4, tests domain 77, shared 9, web 115, api 126, smoke 57/57 (carreras pago vs addItem: 1 ítem primero / 9 pago primero; pago vs cancel x10 sin inconsistencias). Pendiente: numeración del ticket (T26), manifest.json/favicon 404 (previo), saldo de un pedido retomado se calcula en el cliente.
**L26**: Cadena T29 mergeada en develop (#12–#15, f4a96ad); retargetear un PR no dispara CI (evento `edited`) → cerrar/reabrir. Usuario: "En paralelo crea un manual de marca incluyendo el loggo para la app y la marca y ponelo en un .md". Creado `docs/brand/manual-de-marca.md` + `docs/brand/assets/` (símbolo propio: dos personas alrededor de un bowl que forma la U; logo horizontal, con lema, negativo, ícono de app; hoja renderizada). Contraste medido: `.btn-primary` blanco sobre `#16a34a` = 3,30:1 (no cumple AA) → manual recomienda `#15803d` (5,02:1); `favicon.ico`/`manifest.json` siguen en 404. Ambos quedan como pendientes de la app. Usuario: "Hace todos los commit y add etc y actualiza develop".
**L27**: Usuario: "Hace esto : - Botón principal: el texto blanco sobre el verde #16a34a no llega al contraste mínimo de accesibilidad (WCAG AA). El manual recomienda usar #15803d. - favicon.ico y manifest.json: dan 404. Se pueden generar a partir del ícono de app del manual. Despues hace una comparacion con la competencia : https://fu.do/es-ar/ Feuture , UI/UX , Comprotyamoento . etc Modelo de negocio". Botón primario y secundario a `#15803d` (test de contraste contra tokens de Tailwind, RED 3,30 → GREEN 5,02); `apps/web/public/` con favicon.ico, apple-touch-icon, íconos PWA (incl. maskable) y manifest.json, servidos 200 en build de producción. Pendiente: etiquetas/pestañas con blanco sobre `#16a34a` (10 lugares).
**L28**: PR #17 mergeado (c621be9). Comparación con Fudo en `docs/competencia/fudo-vs-unna.md` (funcionalidades, UI/UX, comportamiento, modelo de negocio) desde páginas públicas de fu.do (home, funcionalidades, precios jun-2026), reseñas App Store (3,3/5, 32) y terceros; sin crear cuenta en Fudo. Conclusión: brecha en ARCA, caja/turnos, comandas/KDS, mesas, reportes, app móvil; ventajas de UNNA: multi-sucursal incluido e integridad de datos verificada. Modelo de precio de UNNA queda como decisión del usuario.
**L29**: PR #18 ya estaba mergeado (0460397) cuando llegó la aclaración; comparación reescrita para el segmento café take away (S11): necesidades del segmento, cobertura de Fudo vs especialistas (Frambuesa, Nikao, GestResto; también Payper, Madi Digital, bcnsoft), precios para un café (Fudo $36.000 con facturación), diferenciales (modo hora pico, pedido anticipado + aviso de "listo", sellos incluidos, ARCA+QR en el cobro, costo por taza) y prioridades de producto reordenadas. Hallazgo: "café take away" define el mercado pero no diferencia por sí solo. Abierto: landing y manual de marca siguen diciendo "Todo tu restaurante".
**L30**: Usuario: "Si modifica take away. y decime q feuture faltan". Lema decidido: "El sistema para cafés take away." / "Vendé rápido en el mostrador, cobrá fácil y controlá tu caja y tu stock." Cambiados: metadatos del layout, footer, dashboard, crear-cuenta, ejemplos de formularios ("Ej: Café del Centro"), esencia del manual de marca; nueva `public/og-image.jpg`. Hallazgo: la landing (copia de fu.do) afirmaba "35.000+ restaurantes", "#1", "350M+ transacciones", testimonios y "Terminal UNNA" que no son de UNNA, y referenciaba imágenes inexistentes → reescritura (worker) que separa "Disponible hoy" de "Próximamente".
**L31**: Lema ajustado: "controlá tu caja y tu stock" → "controlá tus cobros y tu stock", porque caja y turnos todavía es "Próximamente" y la frase prometía algo inexistente (señalado por el worker de la landing). S1 reescrito al alcance vigente. Landing nueva: 12 tests; web 129/129.
**L32**: Usuario aprobó ARCA + caja y turnos (S12). Rama feat/arca-cash desde develop (76f7ac8).
**L33**: T30b/T30c integrados. Módulo: InvoicingUseCase, ReceiptIssueUnitOfWorkPort, ReceiptRepositoryPort → adaptador fiscal, FiscalAuthorizerPort por fábrica que impide el simulador con NODE_ENV=production (4 tests). Borrado el camino viejo (SalesUseCase.issueReceipt/getReceipt/listReceipts, Receipt.issue(), PrismaReceiptRepositoryAdapter). Smoke contra Postgres 70/70: venta sin caja 400, 5 aperturas simultáneas → 1, cierre esperado=apertura+efectivo+ingresos−retiros con diferencia 0, factura B (CAE, IVA = total, QR verificado), factura A (docType 80), C desde RI → 400 sin escribir, 8 facturas B concurrentes → números consecutivos sin huecos, ticket secuencial. Salvedad: en la carrera cierre vs pagos ganó siempre el cierre (0 aceptados/5 rechazados): invariante cumplido pero sin intercalación demostrada; se ajusta la prueba. Usuario: "dale" a node-forge para el adaptador ARCA real.
**L34**: T30 completo (falta prueba real en homologación: bloqueada por certificado del usuario; el certificado de ARCA es gratis). node-forge 1.4.0 fijo, solo para firmar (GHSA-86w9-cpqp-85rv afecta la verificación, sin fix). Agregado RG 5616 (CondicionIVAReceptorId): factura A exige condición del cliente; B/C sin condición = consumidor final. Carrera cierre vs pagos con intercalación demostrada (pagos escalonados: 1/4, 2/3, 3/2 aceptados/rechazados, invariante OK). Integración final: lint 4/4, build 4/4, tsc ×4, tests domain 140, shared 9, api 214, web 151, smoke 70/70. Pendientes: ticket de WSAA en memoria (se pierde al reiniciar / varias instancias), invalidar ticket ante token rechazado (Err 600–602), identificación obligatoria en B sobre el umbral, imagen QR en el comprobante (requiere dependencia).
**L35**: Cadena T30 mergeada (#21–#25, develop cfc7e27); runs de push en develop: todos success. Usuario: "Asegurate que pasen todas las actions despues de todos los push y merge" → cada merge se verifica también con el run de push en develop (Lint & TypeCheck, Tests, Build). S13 arranca en feat/peak-hour.
**L36**: S13 completo. Usuario: "Agrega el  @nestjs/throttler" → 6.7.1 fijo, solo en el endpoint público (120/min por IP, PUBLIC_BOARD_RATE_LIMIT; TRUST_PROXY para IP real detrás del proxy). Integración: refresh de sesión en la barra (pantalla de todo el día; regresión del login detectada antes de commitear y fijada con test), pantalla pública sin header/footer del sitio (SiteChrome). Navegador: barra (columnas, "Empezar" mueve el pedido), pantalla pública sin sesión (solo número y primer nombre; token inválido → "Pantalla no disponible"; nada en localStorage), POS con favoritos (fijado primero, luego más vendidos); bug de números desbordando la tarjeta en /pantalla corregido (1024/1280/1920 px). Verificación: tests sin caché domain 171, shared 9, api 270, web 207; smoke 82/82. Propuestas abiertas: quitar header/footer públicos del dashboard; POS arranca en "Para llevar".
**L37**: Revisión nativa de S13 en 3 cortes (corte entero excedía el presupuesto): backend, POS y barra/pantalla aprobados, 24 observaciones no bloqueantes. Corregida la renovación de sesión concurrente (02ceca2). Usuario: "para las fos propuestas tendoy el ok. y hace revisiom nativa" → 2c71785. Usuario pregunta por archivos >400 líneas y patrones; auditoría: 7 archivos >400 (product-catalog.use-case 729 con 5 clases, product.repository.adapter 554 con 6, catalog.controller 453 con 5, pos/page 475 con 26 estados, receipt 441, order 433, api.ts 408), 404 por regex de texto en use-case-result.ts:42. Elige "Refactor antes del merge" → S14.
**L38**: S14 completo. Archivos de código >400 líneas: 0 (product-catalog.use-case 729 → 5 archivos, mayor 191; product.repository.adapter 554 → 131 + 5 adaptadores; catalog.controller 453 → 5 controladores; pos/page 475 → 144 + 5 hooks y 5 componentes; api.ts 408 → 21 + lib/api-client por recurso; order.ts 310; receipt.ts 358). 404 por tipo (NotFoundError del dominio) en vez del regex "no encontrad"; RED 2 fallos → GREEN; grep sin restos. Integración: lint/build/tsc 4/4, tests sin caché domain 172, shared 9, api 278, web 214; smoke 82/82. Revisión nativa en 5 cortes (fix+propuestas, dominio, API, web, errores): todos aprobados; observación de resiliencia aplicada (timeout del refresh compartido, 1fc3bda). Pendientes de backlog: migraciones Prisma desde el init (cambios con db push), filtro de validación por fragmentos de texto, corte de medianoche en la barra.
**L39**: Usuario: "qr de lercado pago". Exploración: medios mercado_pago/qr existen solo como registro manual (sales.use-case.ts:19); Mercado Pago unificó QR en la Orders API. Decisiones: cuenta del café vía OAuth, QR híbrido → S15.
**L40**: S15 completo (con simulador). Investigación de la Orders API en docs/integraciones/mercadopago-qr.md (7eb105c, 1ff8142, 786bfd3). Conexión OAuth con PKCE, tokens AES-256-GCM, tienda y caja por sucursal (3826b3d); cobro QR híbrido, webhook firmado, pago único compartiendo registerOrderPayment con los pagos manuales, cobro "pagado sin registrar" visible si la caja se cerró, serialización de la activación (a628929); web: conectar, QR imprimible y "Cobrar con QR" en el POS (f812706); botón "Simular pago" solo con simulador (7ac4c8a). Bug del smoke: regex del id simulado demasiado amplia (no era bug de la app). Integración: lint/build/tsc 4/4, tests sin caché domain 189, shared 9, api 432, web 234; smoke 82/82 y smoke QR 25/25 (conexión, state de un solo uso, aislamiento entre negocios, webhook sin firma 401, dos pagos concurrentes = un pago). Revisión nativa en 4 cortes, todos aprobados; aplicada la observación del webhook (503 para que Mercado Pago reintente, ad7804e). Usuario: "Podes levantar el front y back para ver la app" → stack local con simulador. Pendiente para producción: migraciones Prisma, credenciales reales de Mercado Pago (aplicación, webhook, usuarios de prueba), validar campos de ubicación y MCC con cuenta de prueba, el API no arranca en producción sin MP_* ni ARCA.
**L41**: #28 mergeado (develop 8d7e0e2, Actions OK en PR y push). Usuario: "ok" → S16 ambiente de prueba gratis (Supabase + Render).
**L42**: S16 listo para desplegar. Los tres workers se colgaron (T34a y T34c tras un comando de shell; T34b generando argumentos): T34a dejó la migración, verificada inline en schema aislado (base vacía con migrate deploy = schema; baseline de base con db push = sin diferencias); T34b dejó el modo staging casi completo, completado inline (.env.example) y verificado (API 465, web 246, lint OK); T34c sin cambios → usuario: "Relanzá el worker" → relanzado con límites duros (perl alarm) → Dockerfiles multi-stage, render.yaml (validado contra el schema oficial), guía docs/deploy/README.md; imágenes construidas y API aplicando las 3 migraciones en Postgres descartable. Integración: lint/build/tsc OK; tests domain 189, shared 9, api 465, web 246; smoke 82/82 y QR 25/25 sobre una base creada solo con migrate deploy (s16_tmp, puerto 3098). Revisión nativa 2 cortes aprobados (9 observaciones). Hallazgos: docker compose up de desarrollo ya estaba roto antes (no resuelve @unna/domain); RESEND_API_KEY obligatoria para arrancar; uploads de imágenes se pierden en Render free (disco efímero); un fallo de migración al arrancar deja el servicio reiniciando. Pendiente: crear cuentas Supabase y Render (usuario).
**L43**: Análisis de performance (medido: GET orders 5→73 ms y 1 MB sin gzip con ~750 pedidos; barra p95 253 ms con 10 pantallas; venta 26 ms; bundles 88–144 kB). Usuario: "ok hacelo" → S17.
**L44**: S17 completo. Medición con ~730 pedidos (misma suite antes/después): GET orders 73 ms y 1 MB sin comprimir → 4,5 ms y 28 KB por página con gzip; barra 10 pantallas p95 253 → 143 ms; venta 26 → 16 ms; 10 cajeros 118 → 187 ventas/s; más vendidos 10 → 6 ms. Verificado: páginas sin solapamiento, limit=201 → 400, X-Next-Cursor expuesto por CORS, /api/v1/health 200. Tests sin caché domain 201, shared 9, api 547, web 257; smoke 82/82 y QR 25/25 sobre base creada con las 4 migraciones. Desvío aceptado del worker: cursor buscado dentro del negocio en vez de Prisma cursor+skip (no saltea filas si el pedido del cursor cambió de estado). Revisión nativa 3 cortes aprobados. Observaciones pendientes: "Ver más" de caja si se cambia de sucursal en medio, error del "Ver más" de stock que queda pegado, open=true sin fecha recorre todo el historial (el POS manda from), índices sin CONCURRENTLY. Queda fuera (tarea propia): llamadas a Mercado Pago y ARCA con el lock tomado.
**L45**: Usuario pide S18 (locks MP/ARCA + detalles de listas), S19 (landing/footer/contraste) y S20 (pedido anticipado: pago online MP, página de seguimiento, lo antes posible); orden: primero S18. Cambio de cuenta gh a mciappina-hismia: pendiente de que el usuario inicie sesión (no se puede hacer sin su autorización en el navegador).
