import { handle } from "hono/aws-lambda";
import app from "@/index";
import { logger } from "@afterclass/core/lib/logger";
import { analytics } from "@afterclass/core/lib/analytics";
import { Sentry } from "@/lib/sentry";
import { pollerHandler } from "@/workers/poller";
import { pushWorkerHandler } from "@/workers/push-worker";
import { scheduleGeneratorHandler } from "@/workers/schedule-generator";

const honoHandler = handle(app);

export const handler: typeof honoHandler = async (event, context) => {
  const response = await honoHandler(event, context);
  await Promise.all([logger.flush(), analytics.flush(), Sentry.flush(2000)]);
  return response;
};

export { pollerHandler, pushWorkerHandler, scheduleGeneratorHandler };
