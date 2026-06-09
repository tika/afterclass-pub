# Clerk to Better Auth Migration Plan

## Overview

This document outlines the migration strategy from Clerk to Better Auth for the Afterclass application. The goal is to minimize disruption while transitioning authentication across web, API, and iOS platforms.

**Important**: This migration will invalidate all active sessions. Users will need to sign in again after the migration.

### Decisions

| Decision                  | Choice                        |
| ------------------------- | ----------------------------- |
| **Session duration**      | 1 month (30 days)             |
| **Authentication method** | Email OTP only (no passwords) |
| **Email provider**        | Resend                        |

---

## Current State Analysis

### Clerk Integration Points

| Component     | Package                              | Usage                                         |
| ------------- | ------------------------------------ | --------------------------------------------- |
| API (Hono)    | `@clerk/backend`, `@hono/clerk-auth` | JWT validation, user lookup                   |
| Web (Next.js) | `@clerk/nextjs`                      | ClerkProvider, auth middleware, useAuth hooks |
| iOS           | `clerk-ios` (SPM)                    | Session management, token retrieval           |

### Authentication Flow (Current)

1. Client authenticates via Clerk (email OTP on iOS, various methods on web)
2. Client receives JWT from Clerk session
3. API validates JWT via `@hono/clerk-auth` middleware
4. Middleware resolves `auth.userId` (Clerk ID) → `users.authId` → `users.id` (DB UUID)
5. Routes use DB UUID for all operations

### Database Schema

```sql
-- Current users table
users (
  id UUID PRIMARY KEY,           -- Internal ID (used everywhere)
  email TEXT UNIQUE NOT NULL,
  auth_id TEXT UNIQUE,           -- Clerk user ID (e.g., "user_2abc...")
  name TEXT,
  avatar_url TEXT,
  grad_year TEXT,
  majors TEXT[],
  is_banned BOOLEAN,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

### Clerk Features Used

- ✅ Email OTP authentication (iOS)
- ✅ Session management
- ✅ JWT token issuance
- ✅ User metadata (firstName, lastName, email)
- ❌ Organizations (not used)
- ❌ Invitations (not used)
- ❌ Webhooks (not used)
- ❌ Social login providers (not configured in code)

---

## Migration Strategy

### Phase 1: Database Preparation

Add Better Auth required tables alongside existing schema. Better Auth needs:

```sql
-- New tables for Better Auth
CREATE TABLE "session" (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE "account" (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,        -- "email" for email/password, "credential" etc.
  access_token TEXT,
  refresh_token TEXT,
  access_token_expires_at TIMESTAMP,
  refresh_token_expires_at TIMESTAMP,
  scope TEXT,
  id_token TEXT,
  password TEXT,                    -- Hashed password (if using email/password)
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE "verification" (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,         -- Email address
  value TEXT NOT NULL,              -- OTP code or verification token
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_session_user_id ON session(user_id);
CREATE INDEX idx_account_user_id ON account(user_id);
CREATE INDEX idx_verification_identifier ON verification(identifier);
```

**Note**: Better Auth can use your existing `users` table with field mapping.

### Phase 2: Backend Implementation

#### 2.1 Install Dependencies

```bash
# apps/api
pnpm add better-auth resend

# apps/web
pnpm add better-auth

# Remove Clerk (after migration complete)
# pnpm remove @clerk/backend @hono/clerk-auth @clerk/nextjs
```

#### 2.2 Create Better Auth Configuration

Create `packages/core/src/lib/auth.ts`:

```typescript
import { betterAuth } from "better-auth";
import { emailOTP } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { Resend } from "resend";
import { db } from "../db";
import { users, session, account, verification } from "../db/schema";

const resend = new Resend(process.env.RESEND_API_KEY);

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: users,
      session,
      account,
      verification,
    },
    usePlural: false,
  }),

  // Email OTP only — no passwords
  emailAndPassword: {
    enabled: false,
  },

  plugins: [
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        const subject =
          type === "sign-in"
            ? "Your Afterclass sign-in code"
            : type === "email-verification"
              ? "Verify your email address"
              : "Reset your password";

        void resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL ?? "Afterclass <onboarding@resend.dev>",
          to: [email],
          subject,
          html: `<p>Your verification code is: <strong>${otp}</strong></p><p>This code expires in 5 minutes.</p>`,
        });
      },
    }),
  ],

  // Map existing user fields
  user: {
    additionalFields: {
      gradYear: {
        type: "string",
        required: false,
      },
      majors: {
        type: "string[]",
        required: false,
      },
      authId: {
        type: "string",
        required: false,
      },
      isBanned: {
        type: "boolean",
        required: false,
        default: false,
      },
    },
  },

  // Sessions last 1 month
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // Update session every 24 hours
  },
});

export type Auth = typeof auth;
```

**Required environment variables:**

- `RESEND_API_KEY` — Resend API key from [resend.com](https://resend.com)
- `RESEND_FROM_EMAIL` — Verified sender (e.g. `Afterclass <onboarding@yourdomain.com>`)

**Resend setup:**

1. Create account at [resend.com](https://resend.com)
2. Add and verify your domain (required for production)
3. Generate API key in dashboard
4. Use a verified `from` address (e.g. `onboarding@yourdomain.com`)

#### 2.3 Update API Middleware

Replace `apps/api/src/middleware/auth.ts`:

```typescript
import { auth } from "@afterclass/core/lib/auth";
import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppVariables } from "../lib/types";

// Better Auth session validation
export const getSession = async (c: Context) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });
  return session;
};

export const requireAuth = async (c: Context<{ Variables: AppVariables }>, next: Next) => {
  const session = await getSession(c);

  if (!session?.user) {
    throw new HTTPException(401, {
      message: "Unauthorized: Authentication required",
    });
  }

  // Attach user to context (same shape as before)
  c.set("user", {
    id: session.user.id,
    email: session.user.email,
    firstName: session.user.name?.split(" ")[0] ?? null,
    lastName: session.user.name?.split(" ").slice(1).join(" ") ?? null,
    createdAt: session.user.createdAt,
  });

  await next();
};
```

#### 2.4 Create Auth Routes

Add `apps/api/src/routes/auth.ts`:

```typescript
import { auth } from "@afterclass/core/lib/auth";
import { Hono } from "hono";

const authRouter = new Hono();

// Mount Better Auth handler
authRouter.all("/*", (c) => auth.handler(c.req.raw));

export { authRouter };
```

Mount in `apps/api/src/index.ts`:

```typescript
import { authRouter } from "./routes/auth";

app.route("/api/auth", authRouter);
```

### Phase 3: User Migration Script

With **email OTP only**, no account records need to be created. Existing users in the `users` table will sign in via OTP; Better Auth looks up users by email when verifying the OTP. If the user exists, it creates a session; if not, it creates the user.

Create `apps/scripts/verify-users-for-better-auth.ts`:

```typescript
import { db } from "@afterclass/core/db";
import { users } from "@afterclass/core/db/schema";

/**
 * Verify existing users are ready for Better Auth (email OTP).
 * No data migration needed — users sign in with OTP and Better Auth
 * matches by email. Ensures emails are unique and valid.
 */
async function verifyUsers() {
  console.log("Verifying users for Better Auth migration...");

  const allUsers = await db.select().from(users);
  console.log(`Found ${allUsers.length} users`);

  const invalid = allUsers.filter((u) => !u.email || !u.email.includes("@"));
  if (invalid.length > 0) {
    console.warn(
      `Warning: ${invalid.length} users have invalid emails:`,
      invalid.map((u) => u.email),
    );
  }

  console.log("✓ Users table ready. No migration needed — users will sign in with OTP.");
}

verifyUsers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Verification failed:", error);
    process.exit(1);
  });
```

### Phase 4: Web (Next.js) Updates

#### 4.1 Create Auth Client

Create `apps/web/lib/auth-client.ts`:

```typescript
import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  plugins: [emailOTPClient()],
});

export const { signIn, signOut, useSession, emailOtp } = authClient;
```

Usage for sign-in:

```typescript
// 1. Send OTP
await authClient.emailOtp.sendVerificationOtp({ email: "user@example.com", type: "sign-in" });

// 2. Sign in with OTP
await authClient.signIn.emailOtp({ email: "user@example.com", otp: "123456" });
```

#### 4.2 Update Layout

Replace ClerkProvider in `apps/web/app/layout.tsx`:

```typescript
// Remove: import { ClerkProvider } from "@clerk/nextjs";
// Add: Session provider from better-auth if needed, or use useSession hook
```

#### 4.3 Update Middleware

Replace `apps/web/proxy.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export async function middleware(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  const { pathname } = request.nextUrl;

  // Protected routes
  const protectedRoutes = ["/clubs", "/dashboard", "/admin"];
  const isProtected = protectedRoutes.some((route) => pathname.startsWith(route));

  if (!sessionCookie && isProtected) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (sessionCookie && ["/login", "/signup"].includes(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/clubs/:path*", "/dashboard/:path*", "/admin/:path*", "/login", "/signup"],
};
```

### Phase 5: iOS Updates

#### 5.1 Remove Clerk SDK

In Xcode:

1. Remove `clerk-ios` package from Package Dependencies
2. Remove `Afterclass.entitlements` webcredentials entry for Clerk

#### 5.2 Create Better Auth Client

Create `Afterclass/Core/Auth/BetterAuthClient.swift`:

```swift
import Foundation

actor BetterAuthClient {
    static let shared = BetterAuthClient()

    private let baseURL: URL
    private var sessionToken: String?

    private init() {
        self.baseURL = AppEnvironment.apiBaseURL.appendingPathComponent("api/auth")
    }

    // MARK: - Session Management

    var isAuthenticated: Bool {
        get async { sessionToken != nil }
    }

    func getToken() async -> String? {
        return sessionToken
    }

    // MARK: - Email OTP Flow (Better Auth email OTP plugin)

    func sendOTP(email: String) async throws {
        let url = baseURL.appendingPathComponent("email-otp/send-verification-otp")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(["email": email, "type": "sign-in"])

        let (_, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw AuthError.sendOTPFailed
        }
    }

    func verifyOTP(email: String, code: String) async throws {
        let url = baseURL.appendingPathComponent("sign-in/email-otp")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(["email": email, "otp": code])

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw AuthError.verifyOTPFailed
        }

        // Better Auth returns session — verify response format; may include token for API clients
        // or use session cookie. Configure auth.handler to return token in body for mobile if needed.
        let authResponse = try JSONDecoder().decode(AuthResponse.self, from: data)
        self.sessionToken = authResponse.token

        // Store token securely
        try KeychainHelper.save(token: authResponse.token)
    }

    func signOut() async throws {
        let url = baseURL.appendingPathComponent("sign-out")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"

        if let token = sessionToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let (_, _) = try await URLSession.shared.data(for: request)
        sessionToken = nil
        try KeychainHelper.deleteToken()
    }

    func restoreSession() async {
        sessionToken = try? KeychainHelper.getToken()
    }
}

// MARK: - Models

struct AuthResponse: Decodable {
    let token: String
    let user: AuthUser
}

struct AuthUser: Decodable {
    let id: String
    let email: String
    let name: String?
}

enum AuthError: Error {
    case sendOTPFailed
    case verifyOTPFailed
    case notAuthenticated
}
```

#### 5.3 Update APIClient

Update `Afterclass/Core/Networking/APIClient.swift`:

```swift
// Replace Clerk token fetching
private nonisolated func fetchToken() async throws -> String? {
    return await BetterAuthClient.shared.getToken()
}
```

#### 5.4 Update AuthView

Update `Afterclass/Features/Auth/AuthView.swift` to use `BetterAuthClient` instead of Clerk.

---

## Migration Checklist

### Pre-Migration

- [ ] Review and test migration script in development
- [ ] Create database backup
- [ ] Notify users of upcoming authentication changes
- [ ] Schedule maintenance window

### Database

- [ ] Create migration for new Better Auth tables (`session`, `account`, `verification`)
- [ ] Run migration in staging
- [ ] Verify schema compatibility

### Backend (API)

- [ ] Install `better-auth` package
- [ ] Create `packages/core/src/lib/auth.ts` configuration
- [ ] Create `apps/api/src/routes/auth.ts` handler
- [ ] Update `apps/api/src/middleware/auth.ts`
- [ ] Update `apps/api/src/middleware/requireAuth.ts`
- [ ] Update `apps/api/src/middleware/requireAdmin.ts`
- [ ] Update `apps/api/src/middleware/requireGroupAdmin.ts`
- [ ] Update `apps/api/src/middleware/requireEventGroupAdmin.ts`
- [ ] Update `apps/api/src/routers/onboarding.ts` (remove Clerk user fetch)
- [ ] Update `apps/api/src/routers/profile.ts` (remove Clerk user delete)
- [ ] Update `apps/api/src/index.ts` (remove Clerk middleware, add auth routes)
- [ ] Remove `@clerk/backend` and `@hono/clerk-auth` from `apps/api/package.json`
- [ ] Update `packages/core/src/lib/secrets.ts` (remove Clerk keys, add Better Auth secret)

### Web (Next.js)

- [ ] Install `better-auth` client package
- [ ] Create `apps/web/lib/auth-client.ts`
- [ ] Update `apps/web/app/layout.tsx` (remove ClerkProvider)
- [ ] Update `apps/web/proxy.ts` (replace Clerk middleware)
- [ ] Update `apps/web/app/admin/layout.tsx`
- [ ] Update all components using `useAuth()`, `currentUser()` from Clerk
- [ ] Update `apps/web/components/posthog-identify.tsx`
- [ ] Remove `@clerk/nextjs` from `apps/web/package.json`

### iOS

- [ ] Remove `clerk-ios` SPM package
- [ ] Create `BetterAuthClient.swift`
- [ ] Create `KeychainHelper.swift` for token storage
- [ ] Update `APIClient.swift` token fetching
- [ ] Update `AuthView.swift` and `AuthViewModel.swift`
- [ ] Update `SignInView.swift` and `OTPVerificationView.swift`
- [ ] Update `SettingsView.swift` (sign out)
- [ ] Remove Clerk-related entitlements
- [ ] Update `Environment.swift` (remove Clerk config)

### Data Migration

- [ ] Run user verification script in staging
- [ ] Confirm existing users can sign in with OTP (no account records needed)

### Environment Variables

- [ ] Add `BETTER_AUTH_SECRET` to all environments
- [ ] Add `BETTER_AUTH_URL` (API base URL)
- [ ] Add `RESEND_API_KEY` (Resend API key)
- [ ] Add `RESEND_FROM_EMAIL` (verified sender, e.g. `Afterclass <onboarding@yourdomain.com>`)
- [ ] Remove `CLERK_SECRET_KEY`
- [ ] Remove `CLERK_PUBLISHABLE_KEY`
- [ ] Update `turbo.json` environment variable list
- [ ] Update `infra/prod/secrets.ts`

### Post-Migration

- [ ] Remove all Clerk packages
- [ ] Delete Clerk-related code
- [ ] Test all authentication flows
- [ ] Monitor error rates
- [ ] Update documentation

---

## Rollback Plan

If issues arise during migration:

1. **Database**: Keep `auth_id` column populated - enables quick rollback to Clerk
2. **Code**: Maintain feature branch with Better Auth changes separate from main
3. **Dual-mode**: Consider running both auth systems temporarily with feature flag

---

## Files to Modify

### High Priority (Core Auth)

| File                                     | Changes                                   |
| ---------------------------------------- | ----------------------------------------- |
| `packages/core/src/lib/auth.ts`          | Create (new)                              |
| `packages/core/src/db/schema.ts`         | Add session, account, verification tables |
| `apps/api/src/index.ts`                  | Remove Clerk middleware, add auth routes  |
| `apps/api/src/middleware/auth.ts`        | Replace Clerk with Better Auth            |
| `apps/api/src/middleware/requireAuth.ts` | Update session validation                 |
| `apps/api/src/routes/auth.ts`            | Create (new)                              |

### Medium Priority (Feature Updates)

| File                                                | Changes                  |
| --------------------------------------------------- | ------------------------ |
| `apps/api/src/routers/onboarding.ts`                | Remove Clerk user fetch  |
| `apps/api/src/routers/profile.ts`                   | Remove Clerk user delete |
| `apps/api/src/middleware/requireAdmin.ts`           | Update auth check        |
| `apps/api/src/middleware/requireGroupAdmin.ts`      | Update auth check        |
| `apps/api/src/middleware/requireEventGroupAdmin.ts` | Update auth check        |
| `apps/web/app/layout.tsx`                           | Remove ClerkProvider     |
| `apps/web/proxy.ts`                                 | Replace Clerk middleware |

### iOS (Separate Effort)

| File                                              | Changes                        |
| ------------------------------------------------- | ------------------------------ |
| `Afterclass/Core/Auth/BetterAuthClient.swift`     | Create (new)                   |
| `Afterclass/Core/Networking/APIClient.swift`      | Update token fetching          |
| `Afterclass/Features/Auth/*`                      | Replace Clerk with Better Auth |
| `Afterclass/Features/Settings/SettingsView.swift` | Update sign out                |

---

## Estimated Effort

| Phase                     | Effort           |
| ------------------------- | ---------------- |
| Phase 1: Database         | 1-2 hours        |
| Phase 2: Backend          | 4-6 hours        |
| Phase 3: Migration Script | 1-2 hours        |
| Phase 4: Web Updates      | 3-4 hours        |
| Phase 5: iOS Updates      | 4-6 hours        |
| Testing & QA              | 4-8 hours        |
| **Total**                 | **~20-30 hours** |

---

## Risks and Mitigations

| Risk                                | Mitigation                                                              |
| ----------------------------------- | ----------------------------------------------------------------------- |
| Session invalidation disrupts users | Communicate ahead of time, schedule during low-traffic period           |
| Token format incompatibility        | Use standard JWT format in Better Auth                                  |
| Missing user data                   | Preserve all user fields; users sign in with OTP (no account migration) |
| iOS App Store review                | Better Auth uses standard web auth - no special entitlements needed     |
| Email deliverability                | Resend — verify domain, test OTP flow in staging                        |
