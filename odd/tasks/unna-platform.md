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
| T1 | S1,S2 | setup | Inicializar monorepo Turborepo + estructura hexagonal base | |
| T2 | S3 | backend | Domain kernel: Value Objects (Email, Phone, Password, BusinessName), Domain Events, Aggregate Roots | |
| T3 | S3 | backend | Auth Context: User Aggregate, Register/Login Use Cases, JWT Port/Adapter, Repository Port/Adapter (Prisma/Supabase) | |
| T4 | S3 | backend | Business Context: Business Aggregate, Onboarding Use Case | |
| T5 | S3 | backend | API Controllers + Validation Pipes + Global Exception Filter | |
| T6 | S3 | backend | Prisma Schema + Supabase Connection + Migrations | |
| T7 | S4 | frontend | Next.js App + Tailwind + Shared UI Components (Button, Input, Checkbox, Form) | |
| T8 | S1 | frontend | Landing Page: Hero, 3 Pilares, Funcionalidades, Testimonios, Stats, Business Types, CTA | |
| T9 | S2 | frontend | Register Page: Formulario con Zod validation, React Hook Form, API integration | |
| T10 | S1,S2 | integration | E2E: Registro completo frontend→backend→DB |
| T11 | - | polish | README, .env.example, Docker compose, CI/CD básico |
| T12 | S3 | backend | Auth avanzado: ForgotPassword + ResetPassword UseCases + endpoints |
| T13 | S3 | backend | Auth avanzado: VerifyEmail UseCase + endpoint + emailVerified en User |
| T14 | S3 | backend | Auth avanzado: Roles/Permisos (UserRole VO, hierarchy, hasRole, canManage) |
| T15 | S3 | backend | Auth avanzado: Tests unit + E2E para forgot/reset/verify/roles |

## Log

**L1**: Usuario solicita replicar fu.do (landing + registro) con NestJS, Supabase, Next.js, React. Arquitectura hexagonal + DDD + SRP + DRY obligatoria.
**L2**: Nombre del proyecto cambiado a **UNNA** (una sola plataforma).
**L3**: Fix 3 auth bugs: confirmPassword validation, acceptTerms boolean, phone 500→400 via DomainExceptionFilter.
**L4**: Auth avanzado Phase 1: EmailPort + ResendAdapter (Commit 1/5).
**L5**: Auth avanzado Phase 1: ForgotPassword + ResetPassword UseCases + endpoints (Commit 2/5).
**L6**: Auth avanzado Phase 1: VerifyEmail UseCase + endpoint + emailVerified migration (Commit 3/5).
**L7**: Auth avanzado Phase 1: Roles/Permisos (UserRole VO, hierarchy, hasRole, canManage) (Commit 4/5).