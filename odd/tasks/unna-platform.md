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
| T30a | S12 | inline | Contratos: modelos Prisma (CashSession, CashMovement, Payment.cashSessionId, campos fiscales del Receipt, secuencias) y puertos de dominio | see commit |
| T30b | S12 | worker | Caja backend: agregado CashSession, adapter, casos de uso, endpoints; pedidos y pagos exigen caja abierta | b8732d5 |
| T30c | S12 | worker | Facturación backend: reglas A/B/C, IVA por alícuota, numeración secuencial, QR, ARCA simulado, emisión | see L33 |
| T30d | S12 | inline | Integración: módulo, smoke real (caja, facturas, carreras de numeración y cierre) | see L33 |
| T30e | S12 | worker | Web: caja (abrir, movimientos, cerrar) y POS con comprobante fiscal (CAE, QR) | pending |
| T30f | S12 | worker | Adaptador ARCA real (WSAA + WSFEv1) con tests de XML; prueba en homologación bloqueada por credenciales | pending |

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
