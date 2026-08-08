import { int, json, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["learner", "manager", "admin"]).default("learner").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const userProfiles = mysqlTable("user_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  goals: text("goals").notNull(),
  baselineSelfAssessment: text("baselineSelfAssessment").notNull(),
  baselineClarity: int("baselineClarity").notNull(),
  baselineConciseness: int("baselineConciseness").notNull(),
  baselineConfidence: int("baselineConfidence").notNull(),
  baselineStructure: int("baselineStructure").notNull(),
  notificationEnabled: mysqlEnum("notificationEnabled", ["true", "false"]).default("true").notNull(),
  reminderHour: int("reminderHour").default(9).notNull(),
  timezone: varchar("timezone", { length: 100 }).default("UTC").notNull(),
  onboardingCompleted: mysqlEnum("onboardingCompleted", ["true", "false"]).default("false").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const practiceSessions = mysqlTable("practice_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  lessonDay: int("lessonDay").notNull(),
  responseMode: mysqlEnum("responseMode", ["text", "audio"]).notNull(),
  responseText: text("responseText").notNull(),
  transcript: text("transcript"),
  audioKey: varchar("audioKey", { length: 512 }),
  audioUrl: varchar("audioUrl", { length: 512 }),
  status: mysqlEnum("status", ["draft", "submitted", "reviewed"]).default("submitted").notNull(),
  clarityScore: int("clarityScore"),
  concisenessScore: int("concisenessScore"),
  confidenceScore: int("confidenceScore"),
  structureScore: int("structureScore"),
  feedbackJson: json("feedbackJson"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const journalEntries = mysqlTable("journal_entries", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const managerAssignments = mysqlTable("manager_assignments", {
  id: int("id").autoincrement().primaryKey(),
  managerId: int("managerId").notNull(),
  learnerId: int("learnerId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("manager_learner_unique").on(table.managerId, table.learnerId)]);

export const notificationSchedules = mysqlTable("notification_schedules", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
  cronExpression: varchar("cronExpression", { length: 100 }).notNull(),
  enabled: mysqlEnum("enabled", ["true", "false"]).default("true").notNull(),
  lastSentAt: timestamp("lastSentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const notificationEvents = mysqlTable("notification_events", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: varchar("type", { length: 64 }).notNull(),
  message: text("message").notNull(),
  readAt: timestamp("readAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const userEngagement = mysqlTable("user_engagement", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  totalPoints: int("totalPoints").default(0).notNull(),
  currentLevel: int("currentLevel").default(1).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const userAchievements = mysqlTable("user_achievements", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  achievementKey: varchar("achievementKey", { length: 100 }).notNull(),
  unlockedAt: timestamp("unlockedAt").defaultNow().notNull(),
}, table => [uniqueIndex("user_achievement_unique").on(table.userId, table.achievementKey)]);

export const engagementEvents = mysqlTable("engagement_events", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  practiceSessionId: int("practiceSessionId"),
  eventType: varchar("eventType", { length: 100 }).notNull(),
  points: int("points").notNull(),
  description: varchar("description", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("engagement_event_unique").on(table.userId, table.eventType, table.practiceSessionId)]);
