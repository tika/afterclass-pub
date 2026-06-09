# DDD Refactor: Extract `@afterclass/core`

> **Goal:** Business logic in `@afterclass/core`, thin HTTP layer in `apps/api`, scripts in `apps/scripts`. Zod schemas are the single source of truth for all types. Services use explicit DI via `ctx: ServiceContext`.

---

## Phase 1: Scaffold `packages/core`

- [x] Create `packages/core/package.json`:
  ```json
  {
    "name": "@afterclass/core",
    "version": "0.0.0",
    "type": "module",
    "main": "./src/index.ts",
    "types": "./src/index.ts",
    "exports": {
      ".": "./src/index.ts",
      "./db": "./src/db/index.ts",
      "./db/schema": "./src/db/schema.ts",
      "./schemas/*": "./src/schemas/*.ts",
      "./services/*": "./src/services/*.ts",
      "./types": "./src/types/index.ts",
      "./events": "./src/events/bus.ts",
      "./lib/*": "./src/lib/*.ts"
    },
    "dependencies": {
      "@afterclass/config": "workspace:*",
      "@ai-sdk/google": "^3.0.13",
      "@aws-sdk/client-s3": "^3.975.0",
      "@aws-sdk/client-sqs": "^3.975.0",
      "@aws-sdk/s3-request-presigner": "^3.975.0",
      "@google/genai": "^1.38.0",
      "@logtail/node": "^0.5.6",
      "@upstash/redis": "latest",
      "ai": "^6.0.49",
      "apn": "^2.2.0",
      "canvas": "^3.2.1",
      "drizzle-orm": "^0.45.1",
      "openai": "^6.24.0",
      "pg": "^8.17.2",
      "postgres": "^3.4.8",
      "resend": "^6.6.0",
      "sharp": "^0.34.5",
      "zod": "catalog:"
    },
    "devDependencies": {
      "@types/node": "catalog:"
    }
  }
  ```
- [x] Create `packages/core/tsconfig.json`

---

## Phase 2: Move DB layer

- [x] Move `apps/api/src/db/schema.ts` → `packages/core/src/db/schema.ts`
- [x] Move `apps/api/src/db/relations.ts` → `packages/core/src/db/relations.ts`
- [x] Move `apps/api/src/db/migrations/` → `packages/core/src/db/migrations/`
- [x] Move `apps/api/drizzle.config.ts` → `packages/core/drizzle.config.ts`
- [x] Create `packages/core/src/db/index.ts` — exports `createServiceContext()` factory and `ServiceContext` type:

  ```ts
  import { Redis } from "@upstash/redis";
  import { drizzle } from "drizzle-orm/postgres-js";
  import postgres from "postgres";
  import * as schema from "./schema";
  import { getSecrets } from "../lib/secrets";

  export type Services = {
    db: ReturnType<typeof drizzle<typeof schema>>;
    secrets: Awaited<ReturnType<typeof getSecrets>>;
    redis: Redis;
  };

  /** Context passed to every service function */
  export type ServiceContext = {
    db: Services["db"];
    secrets: Services["secrets"];
    redis: Services["redis"];
  };

  /** Create a fresh ServiceContext. Caller controls lifecycle. */
  export async function createServiceContext(): Promise<ServiceContext> {
    const secrets = await getSecrets();
    return {
      db: drizzle(postgres(secrets.databaseRuntimeUrl), { schema }),
      secrets,
      redis: new Redis({
        url: secrets.upstashRedisUrl,
        token: secrets.upstashRedisToken,
      }),
    };
  }
  ```

- [x] Delete `apps/api/src/db/` (now empty except `seed.ts` — moved in Phase 6)

---

## Phase 3: Move shared lib utilities

- [x] Move `apps/api/src/lib/constants.ts` → `packages/core/src/lib/constants.ts`
- [x] Move `apps/api/src/lib/email.ts` → `packages/core/src/lib/email.ts`
- [x] Move `apps/api/src/lib/emails/` → `packages/core/src/lib/emails/`
- [x] Move `apps/api/src/lib/logger.ts` → `packages/core/src/lib/logger.ts`
- [x] Move `apps/api/src/lib/s3.ts` → `packages/core/src/lib/s3.ts`
- [x] Move `apps/api/src/lib/secrets.ts` → `packages/core/src/lib/secrets.ts`
- [x] Move `apps/api/src/lib/slug.ts` → `packages/core/src/lib/slug.ts`
- [x] Move `apps/api/src/lib/stringSimilarity.ts` → `packages/core/src/lib/stringSimilarity.ts`
- [x] Update all `@/lib/...` path alias imports in moved files to relative imports within `packages/core/src/`
- [x] Delete `apps/api/src/lib/context.ts` (duplicate of `AppVariables.user` shape)
- [x] Delete `apps/api/src/lib/services.ts` (replaced by `packages/core/src/db/index.ts`)

---

## Phase 4: Move Zod schemas (single source of truth)

- [x] Move `apps/api/src/schemas/events.ts` → `packages/core/src/schemas/events.ts`
- [x] Move `apps/api/src/schemas/groups.ts` → `packages/core/src/schemas/groups.ts`
- [x] Move `apps/api/src/schemas/profile.ts` → `packages/core/src/schemas/profile.ts`
- [x] Move `apps/api/src/schemas/feed.ts` → `packages/core/src/schemas/feed.ts`
- [x] Move `apps/api/src/schemas/onboarding.ts` → `packages/core/src/schemas/onboarding.ts`
- [x] Move `apps/api/src/schemas/pois.ts` → `packages/core/src/schemas/pois.ts`
- [x] Move `apps/api/src/schemas/waitlist.ts` → `packages/core/src/schemas/waitlist.ts`
- [x] Move `apps/api/src/schemas/flyerSubmissions.ts` → `packages/core/src/schemas/flyerSubmissions.ts`
- [x] Move `apps/api/src/schemas/map.ts` → `packages/core/src/schemas/map.ts`
- [x] Fix inter-schema imports (e.g., `feed.ts` imports from `./events`, `./groups`)
- [x] Delete `apps/api/src/schemas/` directory

---

## Phase 5: Consolidate types

- [x] Create `packages/core/src/types/index.ts` — all entity types derived from Zod schemas:

  ```ts
  import type { z } from "zod";
  import type { eventResponseSchema } from "../schemas/events";
  import type { groupResponseSchema } from "../schemas/groups";
  // ... etc

  export type Event = z.infer<typeof eventResponseSchema>;
  export type Group = z.infer<typeof groupResponseSchema>;
  // ... all types from apps/api/src/types.ts
  ```

- [x] Create `packages/core/src/types/domain-events.ts` — move from `apps/api/src/events/types.ts`
- [x] Delete `apps/api/src/types.ts`
- [x] Remove local type re-declarations in services:
  - [x] `services/groups.ts`: local types now correctly derive from Zod schemas (`z.infer<>`) and Drizzle (`InferSelectModel`/`InferInsertModel`) — no manual interface declarations remain

---

## Phase 6: Move domain events

- [x] Move `apps/api/src/events/bus.ts` → `packages/core/src/events/bus.ts`
- [x] Move `apps/api/src/events/types.ts` → `packages/core/src/types/domain-events.ts` (done in Phase 5)
- [x] Move `apps/api/src/events/handlers/` → `packages/core/src/events/handlers/`
- [x] Update handler imports to use relative paths within `packages/core/`
- [x] Delete `apps/api/src/events/`

---

## Phase 6.5: Clean up domain events (DDD improvement)

> **Why now:** Services emit events. Cleaning up events before moving services (Phase 7) means we don't carry dead code forward and services will have correct, validated event types from the start.

### Remove dead code (Posts/Comments tables don't exist)

- [x] Delete `PostCreatedEvent`, `PostApprovedEvent`, `PostRejectedEvent`, `PostDeletedEvent` from `domain-events.ts`
- [x] Delete `CommentCreatedEvent`, `CommentDeletedEvent` from `domain-events.ts`
- [x] Delete `packages/core/src/events/handlers/posts.ts`
- [x] Delete `packages/core/src/events/handlers/comments.ts`
- [x] Update `packages/core/src/events/handlers/index.ts` to remove dead handler registrations

### Convert to Zod-validated events

- [x] Create `packages/core/src/schemas/domain-events.ts` with Zod schemas for each event:

  ```ts
  import { z } from "zod";

  // Event events
  export const eventCreatedEventSchema = z.object({
    type: z.literal("EventCreated"),
    payload: z.object({
      eventId: z.uuid(),
      groupId: z.uuid(),
      createdBy: z.uuid(), // userId who created it
    }),
  });

  export const eventUpdatedEventSchema = z.object({
    type: z.literal("EventUpdated"),
    payload: z.object({
      eventId: z.uuid(),
      updatedBy: z.uuid(),
    }),
  });

  export const eventDeletedEventSchema = z.object({
    type: z.literal("EventDeleted"),
    payload: z.object({
      eventId: z.uuid(),
      deletedBy: z.uuid(),
    }),
  });

  // Group events
  export const groupCreatedEventSchema = z.object({
    type: z.literal("GroupCreated"),
    payload: z.object({
      groupId: z.uuid(),
      createdBy: z.uuid(),
    }),
  });

  export const groupUpdatedEventSchema = z.object({
    type: z.literal("GroupUpdated"),
    payload: z.object({
      groupId: z.uuid(),
      updatedBy: z.uuid(),
    }),
  });

  // Profile events (not currently emitted, but should be)
  export const profileCreatedEventSchema = z.object({
    type: z.literal("ProfileCreated"),
    payload: z.object({
      userId: z.uuid(),
    }),
  });

  export const profileUpdatedEventSchema = z.object({
    type: z.literal("ProfileUpdated"),
    payload: z.object({
      userId: z.uuid(),
    }),
  });

  // User moderation
  export const userBannedEventSchema = z.object({
    type: z.literal("UserBanned"),
    payload: z.object({
      userId: z.uuid(),
      bannedBy: z.uuid(),
      isBanned: z.boolean(),
    }),
  });

  // Union type
  export const domainEventSchema = z.discriminatedUnion("type", [
    eventCreatedEventSchema,
    eventUpdatedEventSchema,
    eventDeletedEventSchema,
    groupCreatedEventSchema,
    groupUpdatedEventSchema,
    profileCreatedEventSchema,
    profileUpdatedEventSchema,
    userBannedEventSchema,
  ]);

  // Inferred types
  export type EventCreatedEvent = z.infer<typeof eventCreatedEventSchema>;
  export type EventUpdatedEvent = z.infer<typeof eventUpdatedEventSchema>;
  export type EventDeletedEvent = z.infer<typeof eventDeletedEventSchema>;
  export type GroupCreatedEvent = z.infer<typeof groupCreatedEventSchema>;
  export type GroupUpdatedEvent = z.infer<typeof groupUpdatedEventSchema>;
  export type ProfileCreatedEvent = z.infer<typeof profileCreatedEventSchema>;
  export type ProfileUpdatedEvent = z.infer<typeof profileUpdatedEventSchema>;
  export type UserBannedEvent = z.infer<typeof userBannedEventSchema>;
  export type DomainEvent = z.infer<typeof domainEventSchema>;
  ```

- [x] Update `packages/core/src/types/domain-events.ts` to re-export from schemas:

  ```ts
  export * from "../schemas/domain-events";
  ```

- [x] Update `packages/core/src/events/bus.ts` to validate events on emit:

  ```ts
  import { domainEventSchema, type DomainEvent } from "../schemas/domain-events";

  async emit<T extends DomainEvent>(event: T): Promise<void> {
    // Validate event structure
    const parsed = domainEventSchema.safeParse(event);
    if (!parsed.success) {
      console.error(`Invalid domain event:`, parsed.error.flatten());
      return;
    }
    // ... rest of emit logic
  }
  ```

### Update handlers to use new types

- [x] Update `handlers/events.ts` imports to use Zod-inferred types
- [x] Update `handlers/profile.ts` imports to use Zod-inferred types
- [x] Update `handlers/admin.ts` imports to use Zod-inferred types

### Future consideration (optional)

- [ ] Add `ReminderSetEvent` for when users set event reminders
- [ ] Add `FlyerSubmittedEvent` for flyer submission workflow
- [ ] Add `GroupFollowedEvent` / `GroupUnfollowedEvent` for social actions

---

## Phase 7: Move services + add DI

For **each** service file:

- [x] Move `apps/api/src/services/events.ts` → `packages/core/src/services/events.ts`
- [x] Move `apps/api/src/services/groups.ts` → `packages/core/src/services/groups.ts`
- [x] Move `apps/api/src/services/feed.ts` → `packages/core/src/services/feed.ts`
- [x] Move `apps/api/src/services/profile.ts` → `packages/core/src/services/profile.ts`
- [x] Move `apps/api/src/services/onboarding.ts` → `packages/core/src/services/onboarding.ts`
- [x] Move `apps/api/src/services/pois.ts` → `packages/core/src/services/pois.ts`
- [x] Move `apps/api/src/services/push.ts` → `packages/core/src/services/push.ts`
- [x] Move `apps/api/src/services/reminders.ts` → `packages/core/src/services/reminders.ts`
- [x] Move `apps/api/src/services/stats.ts` → `packages/core/src/services/stats.ts`
- [x] Move `apps/api/src/services/waitlist.ts` → `packages/core/src/services/waitlist.ts`
- [x] Move `apps/api/src/services/flyerExtraction.ts` → `packages/core/src/services/flyerExtraction.ts`
- [x] Move `apps/api/src/services/flyerSubmissions.ts` → `packages/core/src/services/flyerSubmissions.ts`
- [x] Move `apps/api/src/services/embeddings.ts` → `packages/core/src/services/embeddings.ts`
- [x] Move `apps/api/src/services/appConfig.ts` → `packages/core/src/services/appConfig.ts`
- [x] Move `apps/api/src/services/interestKeywords.ts` → `packages/core/src/services/interestKeywords.ts`
- [x] Move `apps/api/src/services/majorKeywords.ts` → `packages/core/src/services/majorKeywords.ts`
- [x] Create `packages/core/src/services/context.ts`:
  ```ts
  export type { ServiceContext } from "../db/index";
  ```
- [x] **Refactor every service function:** add `ctx: ServiceContext` as first parameter, replace `const { db } = await getServices()` with `ctx.db`
- [x] **Update event emissions:** Change `adminUserId` → `createdBy`/`updatedBy`/`deletedBy` to match new Zod schemas (Phase 6.5), add missing fields like `groupId` to `EventCreatedEvent`
- [x] Delete `apps/api/src/services/`

---

## Phase 8: Create barrel export

- [x] Create `packages/core/src/index.ts`:

  ```ts
  // Context
  export { createServiceContext } from "./db/index";
  export type { ServiceContext, Services } from "./db/index";

  // Types
  export * from "./types/index";
  export * from "./types/domain-events";

  // Schemas
  export * from "./schemas/events";
  export * from "./schemas/groups";
  export * from "./schemas/profile";
  export * from "./schemas/feed";
  export * from "./schemas/onboarding";
  export * from "./schemas/pois";
  export * from "./schemas/waitlist";
  export * from "./schemas/flyerSubmissions";
  export * from "./schemas/map";

  // DB
  export * from "./db/schema";
  ```

- [x] Run `pnpm install` from workspace root to link the new package

---

## Phase 9: Slim down `apps/api`

- [x] Add `"@afterclass/core": "workspace:*"` to `apps/api/package.json` dependencies
- [x] Remove deps that moved to core: `drizzle-orm` kept (needed for query building in routers), others removed
- [x] Update `apps/api/src/lib/types.ts` — `AppVariables` references `ServiceContext` from core
- [x] Update `apps/api/src/middleware/services.ts` — use `createServiceContext()` from core
- [x] Update **every router file** to import from `@afterclass/core`:
  - [x] `routers/events.ts` — schemas from `@afterclass/core/schemas/events`, services from `@afterclass/core/services/events`
  - [x] `routers/groups.ts`
  - [x] `routers/feed.ts`
  - [x] `routers/profile.ts`
  - [x] `routers/onboarding.ts`
  - [x] `routers/pois.ts`
  - [x] `routers/push.ts`
  - [x] `routers/reminders.ts`
  - [x] `routers/stats.ts`
  - [x] `routers/waitlist.ts`
  - [x] `routers/appConfig.ts`
  - [x] `routers/flyerSubmissions.ts`
- [x] Update every router handler to pass `ctx` to service calls
- [x] Update `apps/api/src/index.ts` — import `registerAllHandlers` from `@afterclass/core/events`
- [x] Update `routes/upload.ts` — import s3 utils from `@afterclass/core/lib/s3`
- [x] Remove script entries from `apps/api/package.json` (scripts moved to `apps/scripts`)
- [x] Create `apps/api/src/client.ts` — export `AppType` and typed client factory
- [x] Add to `apps/api/package.json`: `"exports": { "./client": "./src/client.ts" }`
- [x] Verify: `apps/api/src/` contains: `routers/`, `middleware/`, `routes/`, `lib/`, `workers/`, `index.ts`, `lambda.ts`, `node.ts`, `client.ts`

---

## Phase 10: Clean up `packages/api` → `@afterclass/api-client`

> **`AppType` stays in `apps/api`** — it's `typeof routes` (Hono chain), can't exist in core. Consumers use a type-only import from `@afterclass/api/client`. No runtime dependency.

- [x] Rename package: `@afterclass/api-types` → `@afterclass/api-client` in `packages/api/package.json`
- [x] Remove `packages/api/src/client.ts` (the Hono `hc` wrapper — now lives in `apps/api/src/client.ts`)
- [x] Keep only:
  - `src/fetch-client.ts` — `fetchClient`, `ApiError`, `AuthNotReadyError`
- [x] Update `packages/api/src/index.ts` to only export fetch-client utilities
- [x] Remove `hono` from `packages/api/package.json` dependencies
- [x] Delete `packages/api/src/schemas/` (empty dir)
- [x] Delete `packages/api/src/routers/` (empty dir)
- [x] Delete `packages/schemas/` entirely (empty, never used)

---

## Phase 11: Create `apps/scripts`

- [x] Create `apps/scripts/package.json`
- [x] Create `apps/scripts/tsconfig.json`
- [x] Move `apps/api/scripts/backfillEvents/` → `apps/scripts/src/backfillEvents.ts`
- [x] Move `apps/api/scripts/backfillEmbeddings/` → `apps/scripts/src/backfillEmbeddings.ts`
- [x] Move `apps/api/scripts/backfillOrgs/` → `apps/scripts/src/backfillOrgs.ts`
- [x] Move `apps/api/scripts/backfillSlugsAndPublicIds/` → `apps/scripts/src/backfillSlugsAndPublicIds.ts`
- [x] Move `apps/api/scripts/reGeocodeEvents/` → `apps/scripts/src/reGeocodeEvents.ts`
- [x] Move `apps/api/scripts/formatOrgs/` → `apps/scripts/src/formatOrgs.ts`
- [x] Move `apps/api/src/db/seed.ts` → `apps/scripts/src/seed.ts` (seed.ts was already deleted from api)
- [x] Keep `apps/api/scripts/migrate-database.sh` and `migrate-drizzle-to-orm.sql` (one-time migration artifacts)
- [x] Refactor all scripts: replace relative imports with `@afterclass/core` imports
- [x] Add `createServiceContext()` call at script entrypoints
- [x] Delete main script directories (migration scripts remain)

---

## Phase 12: Wire up web app (OPTIONAL - future improvement)

> **Note:** The web app currently uses inline type definitions in `lib/api-client.ts`. This works but types aren't shared from core. This phase is optional improvement work.

- [ ] Add `"@afterclass/core": "workspace:*"` to `apps/web/package.json`
- [ ] Import entity types from `@afterclass/core/types` wherever needed
- [ ] Import Zod schemas from `@afterclass/core/schemas/*` for form validation
- [ ] Refactor `lib/api-client.ts` to use shared types instead of inline definitions

---

## Phase 13: Verify

- [x] Run `pnpm install` from workspace root
- [x] Run `pnpm build` — confirm `apps/api` builds ✅
- [x] Run `pnpm build` — confirm `apps/web` builds ✅
- [x] TypeScript check on `packages/core` passes ✅
- [ ] Run `pnpm dev` in `apps/api` — confirm API starts and routes work
- [ ] Run `pnpm dev` in `apps/web` — confirm web app compiles
- [ ] Run one script from `apps/scripts` to confirm it connects and executes
- [x] Verify no circular dependencies: `@afterclass/core` imports nothing from `apps/*`
- [x] Verify `apps/api/src/` contains: `routers/`, `middleware/`, `routes/`, `lib/`, `workers/`, `index.ts`, `lambda.ts`, `node.ts`, `client.ts`

---

## Dependency Graph (Final State)

```
apps/api ──────────────→ packages/core       (services, schemas, db, types, events, lib)
apps/web ──────────────→ packages/core       (types, schemas)
apps/web ──type-only──→ apps/api             (AppType, Hono client)
apps/web ──────────────→ packages/api-client  (fetchClient, endpoints)
apps/scripts ──────────→ packages/core       (services, db, lib)
packages/core ─────────→ packages/config     (secrets)
```

## Key Principles

1. **Zod schemas = single source of truth** — All types are `z.infer<>`. No manual interface declarations for domain entities.
2. **Explicit DI** — Services receive `ctx: ServiceContext` (db, secrets, redis) as first param. No global singletons. Testing = pass a test context.
3. **Services are framework-agnostic** — No Hono, no Request/Response. Router adapts HTTP ↔ service.
4. **No upward deps** — `@afterclass/core` never imports from `apps/*`. `AppType` is the one exception (type-only, stays in `apps/api`).
5. **Scripts are first-class citizens** — Own app, import `@afterclass/core`, call `createServiceContext()`.

## Import Mapping Cheat Sheet

| What                 | Before                           | After                                                   |
| -------------------- | -------------------------------- | ------------------------------------------------------- |
| Zod schemas          | `../schemas/events`              | `@afterclass/core/schemas/events`                       |
| Services             | `../services/events`             | `@afterclass/core/services/events`                      |
| DB schema            | `../db/schema`                   | `@afterclass/core/db/schema`                            |
| Entity types         | `../types` or local declarations | `@afterclass/core/types`                                |
| Domain events        | `../events/bus`                  | `@afterclass/core/events`                               |
| Event bus types      | `../events/types`                | `@afterclass/core/types` (domain-events)                |
| Utility fns          | `@/lib/slug`, `@/lib/s3`         | `@afterclass/core/lib/slug`, `@afterclass/core/lib/s3`  |
| Secrets type         | `@afterclass/config`             | `@afterclass/config` (unchanged)                        |
| fetchClient/ApiError | `@afterclass/api-types`          | `@afterclass/api-client`                                |
| Hono typed client    | `@afterclass/api-types/client`   | `@afterclass/api/client` (stays in apps/api)            |
| AppType              | `@afterclass/api/types`          | `@afterclass/api/client` (type-only, stays in apps/api) |
| Hono AppVariables    | `../lib/types`                   | `../lib/types` (stays in apps/api)                      |

---

## Phase 14: Single Source of Truth for Entity Types

> **Goal:** ONE definition of `Group`, `Event`, `User`, etc. used across services, routers, and web app. No duplicate type definitions anywhere.

### Success Criteria

- [x] `Group`, `Event`, `User`, `POI` etc. defined ONLY in `@afterclass/core/types`
- [x] Services import types from `@afterclass/core/types` (no local type aliases for entity types)
- [x] Web app imports types from `@afterclass/core/types`
- [x] `pnpm build` passes
- [x] `pnpm exec tsc --noEmit` passes in packages/core and apps/web
- [x] grep for duplicate type definitions returns zero matches

### Tasks

#### 14.1: Audit current types in `@afterclass/core/types/index.ts`

- [x] Ensure all entity types are exported: `Group`, `Event`, `User`, `POI`, `WaitlistSignup`, `GroupMember`
- [x] Added missing fields to schemas: `slug` for Group, `publicId`/`locationDetail` for Event

#### 14.2: Remove local type aliases from services

- [x] `services/groups.ts`: Import `Group`, `GroupMemberRole` from `@afterclass/core/types`
- [x] `services/pois.ts`: Import `POI` from `@afterclass/core/types`
- [x] Keep DB-specific types (GroupInsert) and Zod-derived input types (CreateGroupInput, etc.)

#### 14.3: Wire up web app

- [x] Add `"@afterclass/core": "workspace:*"` to `apps/web/package.json`
- [x] Create `apps/web/lib/types.ts` that re-exports from `@afterclass/core/types`
- [x] Update `apps/web/lib/api-client.ts`: import and use `EventStatus`, `GroupMemberRole`
- [x] Inline object types remain for partial responses (acceptable - full types imported)

#### 14.4: Verify

- [x] Run `pnpm build` - passes
- [x] Run `pnpm exec tsc --noEmit` in packages/core, apps/web - passes
- [x] Search for duplicate definitions - none found in source

---

## Phase 15: Comprehensive Domain Events & Side Effects

> **Goal:** Every mutation emits a domain event. Events trigger real side effects (notifications, emails, cache invalidation).

### 15.1: Define All Domain Events

#### Event Domain

```typescript
EventCreated      { eventId, groupId, createdBy }
EventUpdated      { eventId, updatedBy, changedFields[] }
EventDeleted      { eventId, groupId, deletedBy }
EventStatusChanged { eventId, oldStatus, newStatus, changedBy }
```

#### Group Domain

```typescript
GroupCreated       { groupId, createdBy }
GroupUpdated       { groupId, updatedBy }
GroupDeleted       { groupId, deletedBy }
GroupMemberAdded   { groupId, userId, role, addedBy }
GroupMemberRemoved { groupId, userId, removedBy }
GroupMemberRoleChanged { groupId, userId, oldRole, newRole, changedBy }
GroupFollowed      { groupId, userId }
GroupUnfollowed    { groupId, userId }
```

#### Profile Domain

```typescript
ProfileCreated     { userId, email }
ProfileUpdated     { userId }
ProfileDeleted     { userId }
UserBanned         { userId, isBanned, bannedBy }
```

#### Reminder Domain

```typescript
ReminderCreated    { userId, eventId }
ReminderDeleted    { userId, eventId }
```

### 15.2: Side Effects Matrix

| Event                | Side Effect                                                 | Handler Location            |
| -------------------- | ----------------------------------------------------------- | --------------------------- |
| **EventCreated**     | Push notify group followers                                 | `handlers/notifications.ts` |
| **EventUpdated**     | Push notify users with reminders (if time/location changed) | `handlers/notifications.ts` |
| **EventUpdated**     | Regenerate embedding (if title/desc changed)                | `handlers/embeddings.ts`    |
| **EventDeleted**     | Cancel all scheduled notifications for event                | `handlers/notifications.ts` |
| **EventDeleted**     | Delete all reminders for event                              | `handlers/cleanup.ts`       |
| **GroupMemberAdded** | Send invitation/welcome email                               | `handlers/email.ts`         |
| **GroupFollowed**    | (Future: recommend similar groups)                          | `handlers/analytics.ts`     |
| **ReminderCreated**  | Create scheduled notifications (1h, 1d before)              | `handlers/notifications.ts` |
| **ReminderDeleted**  | Cancel scheduled notifications                              | `handlers/notifications.ts` |
| **ProfileCreated**   | Send welcome email                                          | `handlers/email.ts`         |
| **UserBanned**       | Cancel all user's scheduled notifications                   | `handlers/notifications.ts` |
| **GroupUpdated**     | Regenerate embedding (if name/bio changed)                  | `handlers/embeddings.ts`    |

### 15.3: Implementation Tasks

#### Phase 15.3.1: Schema & Types

- [x] Expand `schemas/domain-events.ts` with all new event types
- [x] Add `changedFields` to EventUpdated for conditional side effects
- [x] Export all new types

#### Phase 15.3.2: Emit Events from Services

- [x] `services/profile.ts`: Emit ProfileCreated, ProfileUpdated, ProfileDeleted, UserBanned
- [x] `services/groups.ts`: Emit GroupDeleted, GroupMemberAdded, GroupMemberRemoved, GroupMemberRoleChanged, GroupFollowed, GroupUnfollowed
- [x] `services/reminders.ts`: Emit ReminderCreated, ReminderDeleted
- [x] `services/events.ts`: Add changedFields to EventUpdated emission

#### Phase 15.3.3: Implement Handlers

- [x] `handlers/notifications.ts`:
  - [x] EventCreated → push to group followers (in events.ts handler)
  - [x] EventUpdated → push to reminder holders (if time/location changed) (in events.ts handler)
  - [x] EventDeleted → cancel scheduled notifications
  - [x] ReminderCreated → create scheduled notifications
  - [x] ReminderDeleted → cancel scheduled notifications
  - [x] UserBanned → cancel user's scheduled notifications (in profile.ts handler)

- [x] `handlers/email.ts`:
  - [x] GroupMemberAdded → send invitation email (already exists, wire up)
  - [x] ProfileCreated → send welcome email (placeholder - template not yet created)

- [x] `handlers/embeddings.ts`:
  - [x] EventUpdated → regenerate if title/description changed
  - [x] GroupUpdated → regenerate if name/bio/categories changed

- [x] `handlers/cleanup.ts`:
  - [x] EventDeleted → delete reminders
  - [x] GroupDeleted → cascade delete events, members, follows

#### Phase 15.3.4: Handler Infrastructure

- [x] Handlers need ServiceContext (db access) - update EventBus to support this
- [x] Add error handling/retry logic for failed side effects
- [x] Add logging for debugging

### 15.4: Implementation Order (Priority)

**Sprint 1: Core Notification Flow**

1. ReminderCreated → schedule notifications (enables core feature)
2. ReminderDeleted → cancel notifications
3. EventDeleted → cancel notifications + cleanup

**Sprint 2: Group Activity Notifications** 4. EventCreated → notify followers 5. EventUpdated → notify reminder holders

**Sprint 3: Membership & Email** 6. GroupMemberAdded → send email 7. ProfileCreated → welcome email

**Sprint 4: Embeddings & Cleanup** 8. EventUpdated/GroupUpdated → regenerate embeddings 9. GroupDeleted → cascade cleanup 10. UserBanned → revoke notifications

### 15.5: Existing Infrastructure (What We Have)

```
┌─────────────────────────────────────────────────────────────────┐
│  Push Notifications (APNs)                                      │
│  • sendPushNotification(ctx, userId, payload) - WORKING         │
│  • broadcastPushNotification(ctx, payload) - WORKING            │
│  • deviceTokens table - stores user device tokens               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Scheduled Notifications                                        │
│  • scheduledNotifications table - stores future notifications   │
│  • poller.ts (Lambda) - runs every 1min, finds due notifs       │
│  • push-worker.ts - receives from SQS, sends via APNs           │
│  • createScheduledNotifications() - currently called by MOBILE  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Email (Resend)                                                 │
│  • sendGroupInvitationEmail() - WORKING                         │
│  • sendWaitlistConfirmationEmail() - WORKING                    │
└─────────────────────────────────────────────────────────────────┘
```

**Current Issue:** Notification scheduling is split - mobile calculates times and calls API.
With domain events, backend owns the logic: ReminderCreated → schedule 1h + 1d before event.

### 15.6: Handler Context Problem

Handlers need `ServiceContext` (db, secrets) but current EventBus doesn't provide it.

**Solution:** Pass context through event bus or use a factory pattern:

```typescript
// Option A: Event includes context (not serializable, but works in-process)
eventBus.emit({ type: "ReminderCreated", payload: {...}, ctx })

// Option B: Handlers create their own context (cleaner, but slower)
eventBus.on("ReminderCreated", async (event) => {
  const ctx = await createServiceContext();
  // ... use ctx
});

// Option C: Event bus holds context reference (singleton pattern)
eventBus.setContext(ctx);
eventBus.emit({ type: "ReminderCreated", payload: {...} });
```

Recommend **Option C** - set context once at app startup (in `index.ts`).

### 15.7: Success Criteria

- [x] All mutations emit domain events
- [x] `ReminderCreated` schedules push notifications in `scheduled_notifications` table
- [x] `EventCreated` sends push to group followers
- [x] `GroupMemberAdded` sends invitation email
- [x] No orphaned scheduled notifications after event deletion
- [x] Handlers have error handling (don't break main flow)
- [x] `pnpm build` passes
- [ ] Manual testing: create reminder → verify scheduled notification exists
