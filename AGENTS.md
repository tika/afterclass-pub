# Node.js Monorepo: Web & API Development Guide

This guide covers the **web app** (Next.js frontend) and **API backend** (Hono), both organized in this Node.js monorepo.

---

## Monorepo Structure

```
node/
├── apps/
│   ├── api/                    # Backend API (Hono)
│   │   ├── src/
│   │   │   ├── index.ts       # Hono app entry
│   │   │   ├── lambda.ts      # AWS Lambda entry
│   │   │   ├── node.ts        # Node.js server entry
│   │   │   ├── middleware/    # Auth, validation, etc.
│   │   │   ├── routers/       # Route handlers
│   │   │   ├── routes/        # Route definitions
│   │   │   ├── workers/       # Background jobs
│   │   │   └── lib/           # Utilities
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── web/                    # Frontend (Next.js)
│   │   ├── app/                # App Router pages
│   │   │   ├── admin/         # Admin dashboard
│   │   │   ├── dashboard/     # Organization dashboard
│   │   │   ├── clubs/         # Club pages
│   │   │   ├── layout.tsx     # Root layout
│   │   │   └── ...routes
│   │   ├── components/        # React components
│   │   ├── hooks/             # Custom hooks
│   │   ├── lib/               # Utilities & helpers
│   │   ├── public/            # Static assets
│   │   ├── next.config.js
│   │   ├── tailwind.config.js
│   │   ├── tsconfig.json
│   │   └── components.json
│   │
│   └── scripts/               # Utility scripts
│
├── packages/
│   ├── core/                   # Shared business logic
│   │   ├── src/
│   │   │   ├── db/            # Database schema (Drizzle)
│   │   │   ├── services/      # Business logic
│   │   │   ├── schemas/       # Zod validation
│   │   │   ├── types/         # TypeScript types
│   │   │   ├── events/        # Event bus
│   │   │   └── lib/           # Utilities
│   │   └── package.json
│   │
│   ├── config/                # Configuration
│   │   ├── src/
│   │   │   ├── index.ts       # Main config
│   │   │   └── secrets.ts     # Secret management
│   │   └── package.json
│   │
│   ├── api/                   # API client library
│   │   ├── src/
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── typescript-config/     # Shared TypeScript config
│       └── base.json
│
├── infra/                      # Infrastructure as Code
│   ├── Pulumi.yaml
│   ├── Pulumi.prod.yaml
│   ├── index.ts
│   └── package.json
│
├── turbo.json                  # Build tasks
├── pnpm-workspace.yaml         # Workspace config
├── package.json                # Root dependencies
├── tsconfig.json               # Base TypeScript config
└── pnpm-lock.yaml
```

---

## Getting Started

### Prerequisites

- **Node.js** v22.x
- **pnpm** v10.30.3

### Setup

```bash
cd node
pnpm install           # Install all dependencies
pnpm dev               # Start all services in dev mode
```

This starts:

- **API** on `http://localhost:3001`
- **Web** on `http://localhost:3000`

### Development Commands

```bash
# Start all services
pnpm dev

# Build all packages
pnpm build

# Run type checking
pnpm typecheck

# Run linting
pnpm lint

# Run specific app/package
pnpm --filter=@afterclass/api dev
pnpm --filter=@afterclass/web dev
pnpm --filter=@afterclass/core build
```

---

## Understanding Each Part

### API Backend (Hono)

**Location:** `apps/api/`

**What it does:**

- REST API serving the web and iOS apps
- Authentication via Better Auth
- Database operations via Drizzle ORM
- File storage (S3), queuing (SQS), caching (Redis)
- Background jobs

**Key Files:**

| File              | Purpose                                              |
| ----------------- | ---------------------------------------------------- |
| `src/index.ts`    | Hono app setup, middleware config                    |
| `src/lambda.ts`   | AWS Lambda handler entry point                       |
| `src/node.ts`     | Node.js server entry point                           |
| `src/middleware/` | Request processing (auth, validation, rate limiting) |
| `src/routers/`    | Route handler implementations                        |
| `src/routes/`     | Route definitions (clean separation)                 |
| `src/workers/`    | Background jobs (email, notifications)               |
| `src/lib/`        | Utilities (responses, errors, helpers)               |

**Architecture Pattern:**

```
Request → Middleware (auth/validate) → Router → Handler
           ↓
         Service (business logic in @afterclass/core)
           ↓
         Database/External APIs
           ↓
         Response
```

**How to Add a New Endpoint:**

1. Create handler in `src/routers/[domain]/handler.ts`
2. Define route in `src/routes/index.ts`
3. Use service layer from `@afterclass/core` for business logic
4. Follow existing pattern for error handling & responses

**Tech Stack:**

- **Hono** - Web framework
- **Better Auth** - Auth middleware
- **Drizzle ORM** - Database access
- **Zod** - Schema validation
- **AWS SDK** - S3, SQS
- **Upstash** - Redis caching
- **Resend** - Email service

**Deployment:**

- Runs on **AWS Lambda** (see `lambda.ts`)
- Can also run on Node.js server (see `node.ts`)
- Environment variables in `.env.local` (dev) or AWS secrets (prod)

---

### Web App (Next.js)

**Location:** `apps/web/`

**What it does:**

- User-facing interface (events, clubs, discovery)
- Organization dashboard
- Admin panel
- Authentication with Clerk
- Analytics with PostHog

**Key Directories:**

| Directory        | Purpose                                  |
| ---------------- | ---------------------------------------- |
| `app/`           | Next.js App Router pages & layouts       |
| `app/admin/`     | Admin dashboard pages                    |
| `app/dashboard/` | Organization management dashboard        |
| `app/clubs/`     | Club discovery & detail pages            |
| `components/`    | React components (UI, features)          |
| `hooks/`         | Custom React hooks                       |
| `lib/`           | Utilities (API clients, helpers, config) |
| `public/`        | Static assets                            |

**Architecture Pattern:**

```
Pages (app/)
  ↓
Components (UI + Logic)
  ↓
Custom Hooks (state, API calls)
  ↓
API Client (calls backend)
  ↓
Backend API
```

**Key Technologies:**

- **Next.js 16** - React framework with App Router
- **React 19** - UI library
- **Tailwind CSS** - Styling utility framework
- **Radix UI** - Accessible component primitives
- **Framer Motion** - Animations
- **React Hook Form** - Form state management
- **TanStack Query** - Server state (data fetching, caching)
- **Clerk** - User authentication
- **PostHog** - Product analytics
- **Google Maps** - Location/mapping

**Design System:**

- Follows **afterclass-design-philosophy.md**
- Colors, typography, spacing defined in Tailwind config
- Component patterns (buttons, forms, cards) in `components/`
- Animations via Framer Motion (see components for examples)

**How to Add a New Page:**

1. Create file in `app/[route]/page.tsx`
2. Add layout if needed in `app/[route]/layout.tsx`
3. Use components from `components/`
4. Use hooks from `hooks/` or TanStack Query for data
5. Call backend via API client

**How to Add a New Component:**

1. Create in `components/[category]/ComponentName.tsx`
2. Use Radix UI primitives for base components
3. Style with Tailwind CSS
4. Add Framer Motion animations if needed
5. Export from `components/index.ts` (if public)

**Authentication:**

- Uses **Clerk** for auth
- Protected routes via middleware
- User info available via `useAuth()` hook

**Data Fetching:**

- Use **TanStack Query** for server state
- Mutations for POST/PUT/DELETE
- Cache invalidation on updates

**Styling:**

- **Tailwind CSS** for utilities
- **CSS Modules** for scoped styles (if needed)
- Follow color system in **tailwind.config.js**

**Deployment:**

- Automatically deployed to **Vercel** on push to main
- Environment variables in `.env.local` (dev) or Vercel dashboard (prod)

---

### Core Package (Shared Business Logic)

**Location:** `packages/core/`

**What it does:**

- Database schema (Drizzle ORM)
- Business logic services
- Type definitions
- Validation schemas (Zod)
- Event bus for cross-service communication
- Shared utilities

**Key Directories:**

| Directory       | Purpose                                     |
| --------------- | ------------------------------------------- |
| `src/db/`       | Drizzle ORM schema, migrations, seeds       |
| `src/services/` | Business logic (users, events, clubs, etc.) |
| `src/schemas/`  | Zod validation schemas                      |
| `src/types/`    | TypeScript types & interfaces               |
| `src/events/`   | Event bus & event definitions               |
| `src/lib/`      | Shared utilities                            |

**Database (Drizzle ORM):**

```bash
# Generate migrations after schema changes
cd node
pnpm --filter=@afterclass/core exec drizzle-kit generate

# Push migrations to DB
pnpm --filter=@afterclass/core exec drizzle-kit push
```

**How to Add a New Database Table:**

1. Define in `src/db/schema/` using Drizzle
2. Export from `src/db/schema/index.ts`
3. Create migration: `pnpm --filter=@afterclass/core exec drizzle-kit generate`
4. Review & apply migration

**Services Pattern:**

```typescript
// src/services/userService.ts
export const createUser = async (data: CreateUserInput) => {
  // Business logic & validation
  // DB operations via Drizzle
  // Return result
};
```

Services are called from API handlers (Hono) and other services.

**Validation Schemas:**

```typescript
// src/schemas/user.ts
export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  // ...
});
```

Used in API handlers for request validation via Zod.

**Event Bus:**

For cross-service communication without tight coupling:

```typescript
// src/events/index.ts - Define events
export const eventBus = {
  userCreated: new EventEmitter(),
  eventPosted: new EventEmitter(),
  // ...
};
```

---

### Config Package

**Location:** `packages/config/`

**What it does:**

- Centralized configuration
- Environment variable management
- Secret handling
- Feature flags (if used)

**Usage:**

```typescript
import { config } from "@afterclass/config";

const apiUrl = config.API_URL;
const dbUrl = config.DATABASE_URL;
```

---

### Infrastructure as Code (Pulumi)

**Location:** `infra/`

**What it does:**

- AWS infrastructure setup
- Database provisioning
- Lambda function configuration
- S3 bucket setup
- RDS PostgreSQL

**Common Tasks:**

```bash
cd infra
pnpm install
pulumi up -s prod          # Deploy to production
pulumi preview -s prod     # Preview changes
```

**Files:**

- `Pulumi.yaml` - Stack metadata
- `Pulumi.prod.yaml` - Production config
- `index.ts` - Infrastructure definitions

---

## Build System (Turbo)

**Configuration:** `turbo.json`

Turbo orchestrates builds across the monorepo with smart caching.

**Key Tasks:**

```bash
pnpm build       # Build all packages
pnpm dev         # Dev mode all packages
pnpm typecheck   # Type check all packages
pnpm lint        # Lint all packages
```

**Filtering:**

```bash
pnpm --filter=@afterclass/api build      # Build only API
pnpm --filter=@afterclass/web dev        # Dev only web
pnpm --filter=@afterclass/core... build  # API + web (depends on core)
```

---

## Common Workflows

### Adding a New API Endpoint

1. **Add schema** in `packages/core/src/schemas/[domain].ts`
2. **Add service** in `packages/core/src/services/[domain]Service.ts`
3. **Add handler** in `apps/api/src/routers/[domain]/handler.ts`
4. **Add route** in `apps/api/src/routes/index.ts`
5. **Test** via curl or Postman

### Adding a New Database Table

1. **Define schema** in `packages/core/src/db/schema/[domain].ts`
2. **Export** from `packages/core/src/db/schema/index.ts`
3. **Generate migration:** `pnpm --filter=@afterclass/core exec drizzle-kit generate`
4. **Create service** to interact with it
5. **Add API endpoint** using the service

### Adding a New Web Page

1. **Create page** in `apps/web/app/[route]/page.tsx`
2. **Create components** in `apps/web/components/`
3. **Add hooks** in `apps/web/hooks/` if needed (TanStack Query)
4. **Call API** via `useQuery`/`useMutation` from API client
5. **Style** with Tailwind CSS + Framer Motion animations

### Deploying Changes

**Web & API:**

```bash
git add .
git commit -m "description"
git push origin main
```

- Web deploys automatically to Vercel
- API builds & deploys via CI/CD

**Database:**

```bash
cd node
pnpm --filter=@afterclass/core exec drizzle-kit push
```

---

## Important Patterns

### Error Handling

Use consistent error responses in API handlers:

```typescript
// In handlers
try {
  const result = await service.doSomething();
  return c.json(result);
} catch (error) {
  return c.json({ error: error.message }, 400);
}
```

### Validation

Always validate input in handlers:

```typescript
const body = await c.req.json();
const validated = createUserSchema.parse(body);
```

### Type Safety

Use TypeScript types everywhere:

- Database schema types (generated from Drizzle)
- API request/response types (from Zod schemas)
- Component props types

### Database Queries

Use Drizzle ORM patterns:

```typescript
const user = await db
  .select()
  .from(users)
  .where(eq(users.id, userId))
  .limit(1)
  .then((rows) => rows[0]);
```

### API Calls (Frontend)

Use TanStack Query for reliability:

```typescript
const { data: user } = useQuery({
  queryKey: ["user", userId],
  queryFn: () => api.getUser(userId),
});
```

---

## Testing

Currently, test setup is minimal. Consider:

- Adding **Vitest** for unit tests
- Adding **Playwright** for E2E tests
- Testing handlers, services, components

---

## Environment Variables

### Development (`.env.local`)

```
DATABASE_URL=postgres://...
HONO_PORT=3001
CLERK_SECRET_KEY=...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

### Production

Set in deployment platforms:

- **Web**: Vercel environment variables
- **API**: AWS Lambda environment variables
- **Database**: RDS credentials (managed by Pulumi)

---

## Performance Optimization

- **API**: Use Redis caching for frequent queries
- **Web**: Next.js caching, image optimization, code splitting
- **Database**: Indexes on frequently queried columns
- **Builds**: Turbo caching for incremental builds

---

## Debugging

### API Debugging

```bash
cd node
pnpm --filter=@afterclass/api dev
# Check logs in terminal
# Use curl/Postman to test endpoints
```

### Web Debugging

```bash
cd node
pnpm --filter=@afterclass/web dev
# Open http://localhost:3000
# Use browser DevTools
```

### Database Debugging

```bash
# Query database directly
psql $DATABASE_URL
# Or use Drizzle Studio (if configured)
```

---

## Cross-Platform API Considerations

The API in this monorepo is consumed by:

1. **Web app** (Next.js) - in `apps/web/`
2. **iOS app** (Swift/SwiftUI) - in `../ios/`

When making API changes:

- Ensure backward compatibility or coordinate with iOS team
- Document API changes clearly
- Consider both web and mobile clients in feature design
- Test changes against both clients when possible

---

## Next Steps

- **Working on API?** Start in `apps/api/src/`
- **Working on Web?** Start in `apps/web/app/` or `components/`
- **Modifying database?** Start in `packages/core/src/db/`
- **Working on iOS?** See `../ios/AGENTS.md`
- **Need design guidance?** Read `../afterclass-design-philosophy.md`

Good luck! 🚀
