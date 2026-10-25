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
| T18 | S5 | backend | UseCase: UpdateBusinessSettings + ManageSucursales + ManageHorarios | |
| T19 | S5 | backend | Controller: POST /business/onboard, GET/PATCH /business/me, sucursales CRUD | 74d0fb7 |
| T20 | S5 | backend | Prisma: Business, Sucursal, Horario models + migrations | 74d0fb7 |
| T21 | S5 | frontend | Onboarding Wizard (4 steps: fiscal → sucursales → horarios → confirmación) |
| T22 | S5 | integration | Tests unit + E2E onboarding completo |

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