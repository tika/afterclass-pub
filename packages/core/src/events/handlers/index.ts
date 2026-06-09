import { registerAdminHandlers } from "./admin";
import { registerCleanupHandlers } from "./cleanup";
import { registerEmailHandlers } from "./email";
import { registerEmbeddingHandlers } from "./embeddings";
import { registerEventHandlers } from "./events";
import { registerNotificationHandlers } from "./notifications";
import { registerProfileHandlers } from "./profile";

/**
 * Register all event handlers at application startup
 */
export const registerAllHandlers = () => {
  registerEventHandlers();
  registerProfileHandlers();
  registerAdminHandlers();
  registerNotificationHandlers();
  registerEmailHandlers();
  registerEmbeddingHandlers();
  registerCleanupHandlers();
};
