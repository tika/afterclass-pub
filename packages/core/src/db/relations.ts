import { relations } from "drizzle-orm";
import {
  deviceTokens,
  eventReminders,
  events,
  groupFollows,
  groupMembers,
  groups,
  pointsOfInterest,
  scheduledNotifications,
  users,
} from "./schema";

// --------------------------------------------------------
// 1. User Relations
// --------------------------------------------------------

export const usersRelations = relations(users, ({ many }) => ({
  reminders: many(eventReminders),
  scheduledNotifications: many(scheduledNotifications),
  deviceTokens: many(deviceTokens),
  groupMembers: many(groupMembers),
  groupFollows: many(groupFollows),
}));

// --------------------------------------------------------
// 2. Group Relations
// --------------------------------------------------------

export const groupsRelations = relations(groups, ({ many }) => ({
  events: many(events),
  members: many(groupMembers),
  followers: many(groupFollows),
  pointsOfInterest: many(pointsOfInterest),
}));

// --------------------------------------------------------
// 5. Join Table Relations (Boilerplate but necessary)
// --------------------------------------------------------

export const eventRemindersRelations = relations(eventReminders, ({ one }) => ({
  user: one(users, {
    fields: [eventReminders.userId],
    references: [users.id],
  }),
  event: one(events, {
    fields: [eventReminders.eventId],
    references: [events.id],
  }),
}));

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  user: one(users, {
    fields: [groupMembers.userId],
    references: [users.id],
  }),
  group: one(groups, {
    fields: [groupMembers.groupId],
    references: [groups.id],
  }),
}));

export const groupFollowsRelations = relations(groupFollows, ({ one }) => ({
  user: one(users, {
    fields: [groupFollows.userId],
    references: [users.id],
  }),
  group: one(groups, {
    fields: [groupFollows.groupId],
    references: [groups.id],
  }),
}));

export const scheduledNotificationsRelations = relations(scheduledNotifications, ({ one }) => ({
  user: one(users, {
    fields: [scheduledNotifications.userId],
    references: [users.id],
  }),
  event: one(events, {
    fields: [scheduledNotifications.eventId],
    references: [events.id],
  }),
}));

export const deviceTokensRelations = relations(deviceTokens, ({ one }) => ({
  user: one(users, {
    fields: [deviceTokens.userId],
    references: [users.id],
  }),
}));
