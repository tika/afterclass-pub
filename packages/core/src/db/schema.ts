import {
  boolean,
  doublePrecision,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

// Better Auth tables
export const session = pgTable("session", {
  id: text("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  idToken: text("id_token"),
  password: text("password"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const eventStatusEnum = pgEnum("event_status", [
  "DRAFT",
  "PUBLISHED",
  "CANCELLED",
  "ARCHIVED",
]);

export const groupMemberRoleEnum = pgEnum("group_member_role", ["ADMIN", "MEMBER"]);

export const notificationStatusEnum = pgEnum("notification_status", [
  "scheduled",
  "enqueued",
  "sent",
  "cancelled",
]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(), // Efficient UUID generation
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  authId: text("auth_id").unique(), // External Auth ID (Clerk/Supabase, kept for migration)

  // Phone number fields (primary sign-in method for mobile)
  phoneNumber: text("phone_number").unique(),
  phoneNumberVerified: boolean("phone_number_verified").default(false).notNull(),

  name: text("name"),

  gradYear: text("grad_year"), // kept as text to allow "Grad" or "2025"
  majors: text("majors").array(), // Array of majors (up to 3)
  interests: text("interests").array(), // Array of interest categories

  isBanned: boolean("is_banned").default(false).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const groups = pgTable("groups", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),

  bio: text("bio"),
  logoUrl: text("logo_url"),
  bannerUrl: text("banner_url"),

  instagram: text("instagram"),
  website: text("website"),
  categories: text("categories").array(),

  slug: text("slug").unique(),

  isVerified: boolean("is_verified").default(false).notNull(),

  embedding: vector("embedding", { dimensions: 1536 }),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

/** Group columns for API responses - excludes embedding (internal use only, never returned to clients) */
export const groupPublicColumns = {
  id: groups.id,
  name: groups.name,
  bio: groups.bio,
  logoUrl: groups.logoUrl,
  bannerUrl: groups.bannerUrl,
  instagram: groups.instagram,
  website: groups.website,
  categories: groups.categories,
  slug: groups.slug,
  isVerified: groups.isVerified,
  createdAt: groups.createdAt,
  updatedAt: groups.updatedAt,
};

export const events = pgTable("events", {
  id: uuid("id").defaultRandom().primaryKey(),

  // Basic Info
  title: text("title").notNull(),
  description: text("description"),
  flyerImages: text("flyer_images").array().notNull(), // Ordered array of flyer image URLs (min 1, max 3)

  // Time
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"), // If not set, we'll make an assumption

  // Location
  address: text("address"), // reverse-geocoded
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  locationName: text("location_name").notNull(), // "JCC", "Soccer Field", "21 Nuts Street"
  locationDetail: text("location_detail"), // "Room 501", "Left side", null

  status: eventStatusEnum("status").default("DRAFT"),
  sourceUrl: text("source_url"), // An event can be created from an external source / link to a source
  metadata: jsonb("metadata"), // JSONB for flexible event metadata

  publicId: text("public_id").unique(),

  embedding: vector("embedding", { dimensions: 1536 }),

  // Foreign Keys
  groupId: uuid("group_id")
    .references(() => groups.id, { onDelete: "cascade" })
    .notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

/** Event columns for API responses - excludes embedding (internal use only, never returned to clients) */
export const eventPublicColumns = {
  id: events.id,
  title: events.title,
  description: events.description,
  flyerImages: events.flyerImages,
  startTime: events.startTime,
  endTime: events.endTime,
  address: events.address,
  lat: events.lat,
  lng: events.lng,
  locationName: events.locationName,
  locationDetail: events.locationDetail,
  status: events.status,
  sourceUrl: events.sourceUrl,
  metadata: events.metadata,
  publicId: events.publicId,
  groupId: events.groupId,
  createdAt: events.createdAt,
  updatedAt: events.updatedAt,
};

// Users <-> Events (Reminders)
export const eventReminders = pgTable(
  "event_reminders",
  {
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    eventId: uuid("event_id")
      .references(() => events.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    sent: boolean("sent").default(false),
  },
  (t) => [primaryKey({ columns: [t.userId, t.eventId] })],
);

// Scheduled Notifications - tracks individual notification deliveries for analytics
export const scheduledNotifications = pgTable("scheduled_notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  eventId: uuid("event_id")
    .references(() => events.id, { onDelete: "cascade" })
    .notNull(),
  sendAt: timestamp("send_at").notNull(), // When notification should fire
  type: text("type").default("event_reminder").notNull(), // Type of notification
  status: notificationStatusEnum("status").default("scheduled").notNull(),
  deliveredAt: timestamp("delivered_at"), // When app confirmed delivery (best effort)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

// Users <-> Groups (Membership)
export const groupMembers = pgTable(
  "group_members",
  {
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    groupId: uuid("group_id")
      .references(() => groups.id, { onDelete: "cascade" })
      .notNull(),
    role: groupMemberRoleEnum("role").default("MEMBER").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.groupId] })],
);

// Users <-> Groups (Following)
export const groupFollows = pgTable(
  "group_follows",
  {
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    groupId: uuid("group_id")
      .references(() => groups.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.groupId] })],
);

// Points of Interest (POIs) for groups/schools
// Only used for searching, so not referenced (read-only)
export const pointsOfInterest = pgTable("points_of_interest", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  aliases: text("aliases").array(),
  address: text("address"),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

// App config - single row for update prompts and announcements (iOS only)
export const appConfig = pgTable("app_config", {
  id: text("id").primaryKey(),
  iosLatestVersion: text("ios_latest_version").notNull(),
  iosMinimumVersion: text("ios_minimum_version").notNull(),
  iosAppStoreUrl: text("ios_app_store_url").notNull(),
  announcementEnabled: boolean("announcement_enabled").default(false),
  announcementTitle: text("announcement_title"),
  announcementMessage: text("announcement_message"),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date()),
});

// Device tokens for push notifications (iOS only)
export const deviceTokens = pgTable("device_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

// Notification log - idempotency & dedup for all notification types
export const notificationTriggerEnum = pgEnum("notification_trigger", [
  "saved",
  "following",
  "discovery",
]);

export const notificationLog = pgTable(
  "notification_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    eventId: uuid("event_id")
      .references(() => events.id, { onDelete: "cascade" })
      .notNull(),
    trigger: notificationTriggerEnum("trigger").notNull(),
    sentAt: timestamp("sent_at").defaultNow().notNull(),
  },
  (t) => [unique("notification_log_user_event_trigger_unique").on(t.userId, t.eventId, t.trigger)],
);

// Discovery schedule - 2 random send slots per user per week
export const discoveryScheduleStatusEnum = pgEnum("discovery_schedule_status", [
  "pending",
  "sent",
  "skipped",
]);

export const discoverySchedule = pgTable("discovery_schedule", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  sendAt: timestamp("send_at").notNull(),
  status: discoveryScheduleStatusEnum("status").default("pending").notNull(),
  eventId: uuid("event_id").references(() => events.id, { onDelete: "set null" }), // filled on send
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Waitlist signups - purely for a pre-launch. No relations
export const waitlistSignups = pgTable("waitlist_signups", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  school: text("school").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const locationTable = pgTable("locations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  address: text("address"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

// Flyer submissions - auto-uploaded flyers for OCR extraction and draft event creation
export const flyerSubmissions = pgTable("flyer_submissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  s3Key: text("s3_key").notNull(),
  s3Url: text("s3_url").notNull(),
  extractedData: jsonb("extracted_data"),
  matchedGroupId: uuid("matched_group_id").references(() => groups.id, { onDelete: "set null" }),
  matchConfidence: doublePrecision("match_confidence"),
  eventId: uuid("event_id").references(() => events.id, { onDelete: "set null" }),
  status: text("status").default("pending").notNull(), // pending, extracted, processed, rejected, failed
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});
