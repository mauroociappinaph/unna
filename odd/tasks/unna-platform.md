# UNNA Platform - Réplica de fu.do

## Specs

### S1: Landing Page Pública
Replicar la landing page de https://fu.do/es-ar/ con:
- Hero: "Todo tu restaurante. Una sola plataforma."
- 3 pilares: Tu Gestión, Tus Cobros, Tu Delivery (con CTAs a crear-cuenta)
- Funcionalidades detalladas por módulo (Ventas, Gastos, Productos, Clientes, Proveedores, Impresión, Usuarios, Reportes, KDS, Gestión Mesas, Delivery Apps, Facturación, Tienda Online)
- Testimonios y estadísticas (35k+ restaurantes, #1 LatAm, 350M+ transacciones)
- Tipos de negocio (8 categorías con CTAs)
- Footer con CTA final "Probá todo lo que UNNA puede hacer"

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
