import { Hono } from "hono";
import { getAuth } from "@afterclass/core/lib/auth";

const authRouter = new Hono();

authRouter.all("/*", async (c) => {
  const auth = await getAuth();
  return auth.handler(c.req.raw);
});

export { authRouter };
