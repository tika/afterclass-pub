import { z } from "zod";

// Domain Event Factory
// Enforces the canonical structure: { type: literal, payload: object }
// Use this for all new domain events to avoid structural drift.

function domainEvent<T extends string, S extends z.ZodRawShape>(
  type: T,
  payloadSchema: z.ZodObject<S>,
) {
  return z.object({
    type: z.literal(type),
    payload: payloadSchema,
  });
}

// Event (calendar event) Domain Events
export const eventCreatedSchema = domainEvent(
  "EventCreated",
  z.object({
    eventId: z.uuid(),
    groupId: z.uuid(),
    createdBy: z.uuid(),
  }),
);

export const eventUpdatedSchema = domainEvent(
  "EventUpdated",
  z.object({
    eventId: z.uuid(),
    updatedBy: z.uuid(),
    changedFields: z.array(z.string()).optional(),
  }),
);

export const eventStatusChangedSchema = domainEvent(
  "EventStatusChanged",
  z.object({
    eventId: z.uuid(),
    oldStatus: z.enum(["DRAFT", "PUBLISHED", "CANCELLED", "ARCHIVED"]),
    newStatus: z.enum(["DRAFT", "PUBLISHED", "CANCELLED", "ARCHIVED"]),
    changedBy: z.uuid(),
  }),
);

export const eventDeletedSchema = domainEvent(
  "EventDeleted",
  z.object({
    eventId: z.uuid(),
    deletedBy: z.uuid(),
  }),
);

// Group Domain Events
export const groupCreatedSchema = domainEvent(
  "GroupCreated",
  z.object({
    groupId: z.uuid(),
    createdBy: z.uuid(),
  }),
);

export const groupUpdatedSchema = domainEvent(
  "GroupUpdated",
  z.object({
    groupId: z.uuid(),
    updatedBy: z.uuid(),
    changedFields: z.array(z.string()).optional(),
  }),
);

// Group Deletion
export const groupDeletedSchema = domainEvent(
  "GroupDeleted",
  z.object({
    groupId: z.uuid(),
    deletedBy: z.uuid(),
  }),
);

// Group Member Role Changed
export const groupMemberRoleChangedSchema = domainEvent(
  "GroupMemberRoleChanged",
  z.object({
    groupId: z.uuid(),
    userId: z.uuid(),
    oldRole: z.enum(["ADMIN", "MEMBER"]),
    newRole: z.enum(["ADMIN", "MEMBER"]),
    changedBy: z.uuid(),
  }),
);

// Profile Domain Events
export const profileCreatedSchema = domainEvent(
  "ProfileCreated",
  z.object({
    userId: z.uuid(),
    email: z.string().email(),
  }),
);

export const profileUpdatedSchema = domainEvent(
  "ProfileUpdated",
  z.object({
    userId: z.uuid(),
  }),
);

export const profileDeletedSchema = domainEvent(
  "ProfileDeleted",
  z.object({
    userId: z.uuid(),
  }),
);

// User Moderation Events
export const userBannedSchema = domainEvent(
  "UserBanned",
  z.object({
    userId: z.uuid(),
    bannedBy: z.uuid(),
    isBanned: z.boolean(),
  }),
);

// Reminder Domain Events
export const reminderCreatedSchema = domainEvent(
  "ReminderCreated",
  z.object({
    userId: z.uuid(),
    eventId: z.uuid(),
  }),
);

export const reminderDeletedSchema = domainEvent(
  "ReminderDeleted",
  z.object({
    userId: z.uuid(),
    eventId: z.uuid(),
  }),
);

// Group Membership Events
export const groupMemberAddedSchema = domainEvent(
  "GroupMemberAdded",
  z.object({
    groupId: z.uuid(),
    userId: z.uuid(),
    role: z.enum(["ADMIN", "MEMBER"]),
    addedBy: z.uuid(),
  }),
);

export const groupMemberRemovedSchema = domainEvent(
  "GroupMemberRemoved",
  z.object({
    groupId: z.uuid(),
    userId: z.uuid(),
    removedBy: z.uuid(),
  }),
);

export const groupFollowedSchema = domainEvent(
  "GroupFollowed",
  z.object({
    groupId: z.uuid(),
    userId: z.uuid(),
  }),
);

export const groupUnfollowedSchema = domainEvent(
  "GroupUnfollowed",
  z.object({
    groupId: z.uuid(),
    userId: z.uuid(),
  }),
);

export const domainEventSchema = z.discriminatedUnion("type", [
  eventCreatedSchema,
  eventUpdatedSchema,
  eventStatusChangedSchema,
  eventDeletedSchema,
  groupCreatedSchema,
  groupUpdatedSchema,
  groupDeletedSchema,
  groupMemberRoleChangedSchema,
  profileCreatedSchema,
  profileUpdatedSchema,
  profileDeletedSchema,
  userBannedSchema,
  reminderCreatedSchema,
  reminderDeletedSchema,
  groupMemberAddedSchema,
  groupMemberRemovedSchema,
  groupFollowedSchema,
  groupUnfollowedSchema,
]);

// Type exports - no "Event" suffix needed, context is clear
export type EventCreated = z.infer<typeof eventCreatedSchema>;
export type EventUpdated = z.infer<typeof eventUpdatedSchema>;
export type EventStatusChanged = z.infer<typeof eventStatusChangedSchema>;
export type EventDeleted = z.infer<typeof eventDeletedSchema>;
export type GroupCreated = z.infer<typeof groupCreatedSchema>;
export type GroupUpdated = z.infer<typeof groupUpdatedSchema>;
export type GroupDeleted = z.infer<typeof groupDeletedSchema>;
export type GroupMemberRoleChanged = z.infer<typeof groupMemberRoleChangedSchema>;
export type ProfileCreated = z.infer<typeof profileCreatedSchema>;
export type ProfileUpdated = z.infer<typeof profileUpdatedSchema>;
export type ProfileDeleted = z.infer<typeof profileDeletedSchema>;
export type UserBanned = z.infer<typeof userBannedSchema>;
export type ReminderCreated = z.infer<typeof reminderCreatedSchema>;
export type ReminderDeleted = z.infer<typeof reminderDeletedSchema>;
export type GroupMemberAdded = z.infer<typeof groupMemberAddedSchema>;
export type GroupMemberRemoved = z.infer<typeof groupMemberRemovedSchema>;
export type GroupFollowed = z.infer<typeof groupFollowedSchema>;
export type GroupUnfollowed = z.infer<typeof groupUnfollowedSchema>;
export type DomainEvent = z.infer<typeof domainEventSchema>;
