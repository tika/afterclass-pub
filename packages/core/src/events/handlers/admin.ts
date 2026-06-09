import { eventBus } from "@afterclass/core/events";
import type {
  EventCreated,
  EventDeleted,
  EventUpdated,
  GroupCreated,
  GroupUpdated,
} from "@afterclass/core/schemas/domain-events";

/**
 * Event handlers for admin/audit logging
 * Note: These could be expanded to log to an audit table or external service
 */
export const registerAdminHandlers = () => {
  eventBus.on<EventCreated>("EventCreated", async (event, _ctx) => {
    console.log("[AdminHandler] EventCreated:", event.payload);
  });

  eventBus.on<EventUpdated>("EventUpdated", async (event, _ctx) => {
    console.log("[AdminHandler] EventUpdated:", event.payload);
  });

  eventBus.on<EventDeleted>("EventDeleted", async (event, _ctx) => {
    console.log("[AdminHandler] EventDeleted:", event.payload);
  });

  eventBus.on<GroupCreated>("GroupCreated", async (event, _ctx) => {
    console.log("[AdminHandler] GroupCreated:", event.payload);
  });

  eventBus.on<GroupUpdated>("GroupUpdated", async (event, _ctx) => {
    console.log("[AdminHandler] GroupUpdated:", event.payload);
  });
};
