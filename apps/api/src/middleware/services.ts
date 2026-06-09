import { createMiddleware } from "hono/factory";
import { createServiceContext, type ServiceContext } from "@afterclass/core";

export const servicesMiddleware = createMiddleware<{
  Variables: { services: ServiceContext };
}>(async (c, next) => {
  c.set("services", await createServiceContext());
  await next();
});
