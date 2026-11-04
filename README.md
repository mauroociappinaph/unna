# UNNA Platform

> **Una sola plataforma** para gestionar tu restaurante. Réplica de [fu.do](https://fu.do/es-ar/) construida con arquitectura hexagonal, DDD, SRP y DRY.

## 🏗️ Arquitectura

```
unna/
├── apps/
│   ├── api/          # NestJS Backend (Port 3001)
│   └── web/          # Next.js Frontend (Port 3000)
├── packages/
│   ├── domain/       # Domain Kernel (Value Objects, Aggregates, Events, Ports)
│   └── shared/       # Shared DTOs, Zod Schemas, Constants
├── odd/
│   └── tasks/        # ODD Feature Specs & Task Tracking
└── turbo.json        # Turborepo Configuration
```

### Principios de Diseño
- **Hexagonal Architecture**: Domain core aislado, ports/adapters para infraestructura
- **DDD**: Bounded Contexts (Auth, Business, Billing, Delivery, Inventory, Reporting)
- **SRP**: Una clase = una responsabilidad
- **DRY**: Código compartido en `@unna/domain` y `@unna/shared`

## 🚀 Quick Start

### Prerrequisitos
- Node.js 20+
- PostgreSQL 16+ (o Docker)
- npm 10+

### Desarrollo Local

```bash
# 1. Clonar e instalar
git clone https://github.com/mauroociappinaph/unna.git
cd unna
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# 3. Levantar base de datos (Docker)
docker-compose up -d postgres

# 4. Migraciones
cd apps/api && DATABASE_URL="postgresql://postgres:postgres@localhost:5432/unna?schema=public" npx prisma migrate dev

# 5. Desarrollo (2 terminales)
# Terminal 1 - API
cd apps/api && npm run start:dev

# Terminal 2 - Web
cd apps/web && npm run dev
```

### URLs de Desarrollo
| Servicio | URL |
|----------|-----|
| Frontend | http://localhost:3000 |
| API | http://localhost:3001 |
| Swagger Docs | http://localhost:3001/api/docs |
| Prisma Studio | `cd apps/api && npx prisma studio` |

## 📦 Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| **Monorepo** | Turborepo |
| **Backend** | NestJS 10 + TypeScript |
| **Frontend** | Next.js 14 (App Router) + React 18 + Tailwind CSS |
| **Database** | PostgreSQL + Prisma ORM |
| **Auth** | JWT (Access + Refresh) + bcrypt |
| **Validación** | class-validator (BE) + Zod (FE) |
| **Forms** | React Hook Form |

## 🎯 Funcionalidades Implementadas

### ✅ MVP Actual (Landing + Auth)
- **Landing Page** (`/`) - Réplica exacta de fu.do/es-ar/
  - Hero + 3 Pilares (Gestión, Cobros, Delivery)
  - Funcionalidades por módulo (8 categorías)
  - Testimonios + Stats (35k+ restaurantes)
  - 8 Tipos de negocio + CTA final
- **Registro** (`/crear-cuenta`) - Validación Zod en tiempo real
  - Business Name (3-45 chars, alfanumérico + & - _)
  - Name (3-45 chars)
  - Phone AR format
  - Email + Password (8 chars, upper, lower, number)
  - Terms checkbox
- **Login** (`/login`)
- **Dashboard** (`/dashboard`) - Protected route
- **Auth API** - Register/Login con JWT + Refresh tokens

### 🎯 Próximos Módulos (Scope Real)
- [ ] **Carta/Menu Management** (categorías, productos, modificadores, recetas)
- [ ] **Stock/Inventario** (ingredientes, mermas, conteos, alertas)
- [ ] **Caja/Arqueo** (ciego, múltiples cajas, turnos, movimientos)
- [ ] **Reportes** (ventas por día/hora/canal/medio pago, productos, costos)
- [ ] **Facturación ARCA** (A/B/C, notas crédito, impresoras fiscales)
- [ ] **Terminal UNNA** (hardware, divisiones, propinas)
- [ ] **Conciliación automática** de pagos
- [ ] **Integraciones** (PedidosYa, Uber Eats, Rappi)
- [ ] **Proveedores** (CRUD, cta cte, categorías, gastos)
- [ ] **Gastos** (categorías, vencimientos, actualización costos/stock)

## 🔧 Scripts Disponibles

```bash
# Root (turborepo)
npm run build        # Build all packages
npm run dev          # Dev all packages
npm run lint         # Lint all packages
npm run test         # Test all packages
npm run db:generate  # Prisma generate
npm run db:push      # Prisma db push
npm run db:migrate   # Prisma migrate dev
npm run db:studio    # Prisma studio

# API
cd apps/api
npm run start:dev    # Watch mode
npm run start:prod   # Production build
npm run db:studio    # Prisma Studio

# Web
cd apps/web
npm run dev          # Next.js dev server
npm run build        # Production build
npm run start        # Production server
```

## 🐳 Docker

```bash
# Desarrollo completo
docker-compose up -d --build

# Solo base de datos
docker-compose up -d postgres

# Ver logs
docker-compose logs -f api
docker-compose logs -f web
```

## 🌿 Git Workflow

```bash
# Feature branch
git checkout -b feature/nombre-corto

# Commits convencionales
git commit -m "feat(carta): agregar categorías y subcategorías"
git commit -m "fix(auth): validación teléfono formato AR"
git commit -m "docs: actualizar README con docker"

# Push y PR
git push origin feature/nombre-corto
# Crear PR hacia develop
```

## 📁 Estructura de Paquetes

### `@unna/domain` (Core)
```
src/
├── value-objects/    # Email, Phone, Password, BusinessName, PersonName
├── aggregates/       # User, Business (AggregateRoot)
├── events/           # DomainEvent, UserRegistered, BusinessCreated
├── ports/            # RepositoryPort, JwtPort, HashingPort
└── common/           # Result<T, E> pattern
```

### `@unna/shared` (DTOs & Schemas)
```
src/
├── schemas/          # Zod schemas (auth, business, etc.)
└── types/            # TypeScript types inferred from schemas
```

### `apps/api` (NestJS)
```
src/
├── auth/             # AuthContext (Register, Login, JWT, Bcrypt)
├── business/         # BusinessContext (OnboardBusiness)
├── common/           # Guards, Strategies, Filters
├── prisma/           # PrismaService, PrismaModule
└── config/           # Configuration
```

### `apps/web` (Next.js)
```
src/
├── app/              # App Router pages (/, /crear-cuenta, /login, /dashboard)
├── components/
│   ├── ui/           # Button, Input, Checkbox
│   └── layout/       # Header, Footer
├── lib/              # API client (axios)
└── hooks/            # Custom hooks
```

## 🔐 Variables de Entorno

```env
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/unna?schema=public"

# JWT
JWT_SECRET="your-super-secret-jwt-key-min-32-chars"
JWT_REFRESH_SECRET="your-super-secret-refresh-key-min-32-chars"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# Frontend
NEXT_PUBLIC_API_URL="http://localhost:3001"
FRONTEND_URL="http://localhost:3000"

# App
PORT=3001
NODE_ENV=development
```

## 📚 Documentación Adicional

- [ODD Feature Spec](odd/tasks/unna-platform.md) - Especificación completa con tasks
- [Architecture Decision Records](docs/adr/) - Decisiones arquitectónicas
- [API Docs](http://localhost:3001/api/docs) - Swagger/OpenAPI (en dev)

## 🤝 Contribuir

1. Fork del repo
2. Feature branch (`git checkout -b feature/amazing-feature`)
3. Commit convencional (`git commit -m 'feat: amazing feature'`)
4. Push (`git push origin feature/amazing-feature`)
5. Pull Request

## 📄 Licencia

MIT License - ver [LICENSE](LICENSE) para detalles.

---

**UNNA** — *Una sola plataforma para tu restaurante* 🍽️