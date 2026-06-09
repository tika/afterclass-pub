import { domainEventSchema, type DomainEvent } from "@afterclass/core/schemas/domain-events";
import type { ServiceContext } from "@afterclass/core/services/context";

type EventHandler<T extends DomainEvent> = (event: T, ctx: ServiceContext) => Promise<void> | void;

class EventBus {
  private handlers: Map<string, EventHandler<DomainEvent>[]> = new Map();
  private context: ServiceContext | null = null;

  /**
   * Set the service context for handlers to use
   * Call this once at app startup after creating the context
   */
  setContext(ctx: ServiceContext): void {
    this.context = ctx;
  }

  /**
   * Get the current context (for handlers that need it)
   */
  getContext(): ServiceContext | null {
    return this.context;
  }

  /**
   * Subscribe to a domain event
   * Handler receives the event and ServiceContext
   */
  on<T extends DomainEvent>(eventType: T["type"], handler: EventHandler<T>): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)?.push(handler as EventHandler<DomainEvent>);
  }

  /**
   * Emit a domain event (validates against Zod schema)
   * Passes ServiceContext to all handlers
   */
  async emit<T extends DomainEvent>(event: T): Promise<void> {
    // Validate event structure against schema
    const parsed = domainEventSchema.safeParse(event);
    if (!parsed.success) {
      console.error(`[EventBus] Invalid domain event:`, parsed.error.flatten());
      return;
    }

    if (!this.context) {
      console.warn(
        `[EventBus] No context set, handlers may fail. Call eventBus.setContext() at startup.`,
      );
    }

    const handlers = this.handlers.get(event.type) || [];
    await Promise.all(
      handlers.map(async (handler) => {
        try {
          // Pass context to handler (may be null if not set)
          await handler(event, this.context!);
        } catch (error) {
          // Log but don't throw - side effects shouldn't break main flow
          console.error(`[EventBus] Error in handler for ${event.type}:`, error);
        }
      }),
    );
  }

  /**
   * Remove all handlers (useful for testing)
   */
  clear(): void {
    this.handlers.clear();
  }
}

// Singleton event bus instance
export const eventBus = new EventBus();

// Re-export handler registration
export { registerAllHandlers } from "./handlers/index";
