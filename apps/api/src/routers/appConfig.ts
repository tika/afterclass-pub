import { Hono } from "hono";
import type { AppVariables } from "@/lib/types";
import * as appConfigService from "@afterclass/core/services/appConfig";

// Chain routes to accumulate types for Hono RPC
const appConfigRouter = new Hono<{ Variables: AppVariables }>().get("/", async (c) => {
  const ctx = c.get("services");
  const config = await appConfigService.getAppConfig(ctx);
  return c.json(config, 200);
});

export { appConfigRouter };
