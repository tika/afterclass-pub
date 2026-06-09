import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { cors } from "hono/cors";
import { eventBus, registerAllHandlers } from "@afterclass/core/events";
import { logger } from "@afterclass/core/lib/logger";
import { getSecrets } from "@afterclass/core/lib/secrets";
import { createServiceContext } from "@afterclass/core";
import { Sentry } from "./lib/sentry";
import { idempotencyMiddleware } from "./middleware/idempotency";
import { rateLimitMiddleware } from "./middleware/rateLimit";
import { servicesMiddleware } from "./middleware/services";
import { router } from "./routers/root";
import uploadRouter from "./routes/upload";
import { authRouter } from "./routes/auth";
import { phoneAuthRouter } from "./routes/phone-auth";

// Register all event handlers at startup
registerAllHandlers();

getSecrets()
  .then(async () => {
    // Initialize eventBus with system context for background operations
    const systemContext = await createServiceContext();
    eventBus.setContext(systemContext);
    logger.info("EventBus system context initialized");
  })
  .catch((err) => {
    logger.error("Failed to initialize secrets", { error: String(err) });
    process.exit(1);
  });

const app = new Hono();

// Request logging: one concise line per request; log error body for 4xx
app.use("*", async (c, next) => {
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;

  await next();

  const duration = Date.now() - start;
  const status = c.res.status;

  if (status >= 400) {
    // For errors, include response body in logs so we see the reason
    let errorBody: unknown;
    try {
      const clone = c.res.clone();
      const text = await clone.text();
      errorBody = text ? (JSON.parse(text) as unknown) : undefined;
    } catch {
      errorBody = undefined;
    }
    logger.warn(`${method} ${path} ${status} ${duration}ms`, {
      error: errorBody,
      path,
      method,
    });
  } else {
    logger.info(`${method} ${path} ${status} ${duration}ms`);
  }
});

// CORS configuration for mobile apps (no origin) and web apps
const corsConfig = {
  origin: (origin: string | undefined) => {
    // Allow iOS simulator and web app
    // When credentials: true, cannot return "*" - must return specific origin or null
    if (!origin) {
      // For requests with no origin (like mobile apps), return null
      // This allows the request but without CORS headers
      return null;
    }
    // Development origins
    if (origin.includes("localhost:3000")) return origin;
    if (origin.includes("localhost:8081")) return origin; // Expo dev server
    if (origin.includes("ngrok")) return origin; // Allow ngrok tunnels
    // Production origins - match both www and non-www
    if (origin.includes("afterclass.rsvp")) return origin; // Allow production domain (includes www.afterclass.rsvp and afterclass.rsvp)
    return null;
  },
  allowHeaders: [
    "Content-Type",
    "Authorization",
    "x-api-key",
    "Idempotency-Key",
    "ngrok-skip-browser-warning",
  ],
  allowMethods: ["POST", "GET", "PATCH", "DELETE", "OPTIONS"],
  exposeHeaders: ["Content-Length"],
  maxAge: 600,
  credentials: true,
};

// CORS for API routes - MUST be applied early to handle OPTIONS preflight requests
app.use("/v1/*", cors(corsConfig));
// CORS for Better Auth routes
app.use("/api/auth/*", cors(corsConfig));

app.use("*", servicesMiddleware);

// Rate limiting for API routes (100 req/min per IP)
app.use("/v1/*", rateLimitMiddleware);
// Idempotency for mutations (POST/PATCH/DELETE with Idempotency-Key header)
app.use("/v1/*", idempotencyMiddleware);

// Root route
app.get("/ping", (c) => {
  return c.text("Afterclass backend pong");
});

// Custom phone auth flow (with email linking) - MUST be before authRouter
// so /api/auth/phone/* is matched before better-auth's catch-all
app.route("/api/auth/phone", phoneAuthRouter);

// Better Auth handler (catch-all for /api/auth/*)
app.route("/api/auth", authRouter);

// Upload endpoints (presigned URLs)
app.route("/v1/upload", uploadRouter);

// Mount API routes
app.route("/v1", router);

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return err.getResponse();
  }

  Sentry.captureException(err);

  // Log full error details in development
  if (process.env.NODE_ENV !== "production") {
    console.error("\n[ERROR]", err);
  }

  logger.error("Unhandled error", {
    error: String(err),
    stack: err.stack,
    path: c.req.path,
  });
  return c.json({ error: "Internal server error" }, 500);
});

// Catch-all handler for unmatched routes (for debugging)
app.notFound((c) => {
  console.error(`[notFound] Unmatched route: ${c.req.method} ${c.req.path}`);
  logger.error("Route not found", { path: c.req.path, method: c.req.method });
  return c.json(
    {
      error: "Route not found",
      path: c.req.path,
      method: c.req.method,
    },
    404,
  );
});

export default app;
