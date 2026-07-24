import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, timestamp, varchar, pgEnum, boolean, integer, numeric } from "drizzle-orm/pg-core";

export const sessionsTable = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

export const subscriptionStatusEnum = pgEnum("subscription_status", ["pending", "active", "suspended"]);
export const roleEnum = pgEnum("user_role", ["user", "admin"]);

export const usersTable = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: roleEnum("role").notNull().default("user"),
  subscriptionStatus: subscriptionStatusEnum("subscription_status").notNull().default("pending"),
  subscriptionExpiresAt: timestamp("subscription_expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type UpsertUser = typeof usersTable.$inferInsert;
export type User = typeof usersTable.$inferSelect;

export const schoolInfoTable = pgTable("school_info", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  nom: varchar("nom", { length: 255 }).notNull().default(""),
  wilaya: varchar("wilaya", { length: 100 }).notNull().default(""),
  commune: varchar("commune", { length: 100 }).notNull().default(""),
  annee: varchar("annee", { length: 20 }).notNull().default("2025-2026"),
  directeur: varchar("directeur", { length: 255 }).default(""),
  phone: varchar("phone", { length: 30 }).default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type SchoolInfo = typeof schoolInfoTable.$inferSelect;
export type InsertSchoolInfo = typeof schoolInfoTable.$inferInsert;

export const niveauEnum = pgEnum("niveau", ["1AM", "2AM", "3AM", "4AM"]);
export const sexeEnum = pgEnum("sexe", ["M", "F"]);
export const statutEnum = pgEnum("statut_eleve", ["nouveau", "redoublant"]);
export const resultatEnum = pgEnum("resultat_eleve", ["admis", "non_admis", "mustarrak"]);

export const studentsTable = pgTable("students", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  nomPrenom: varchar("nom_prenom", { length: 255 }).notNull(),
  dateNaissance: varchar("date_naissance", { length: 30 }),
  niveau: niveauEnum("niveau").notNull(),
  classe: varchar("classe", { length: 10 }).notNull(),
  sexe: sexeEnum("sexe").notNull(),
  statut: statutEnum("statut").notNull().default("nouveau"),
  resultat: resultatEnum("resultat"),
  annee: varchar("annee", { length: 20 }).notNull().default("2025-2026"),
  raqm: integer("raqm"),
  parentPhone: varchar("parent_phone", { length: 30 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Student = typeof studentsTable.$inferSelect;
export type InsertStudent = typeof studentsTable.$inferInsert;

export const gradesTable = pgTable("grades", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  studentId: varchar("student_id", { length: 64 }).notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
  annee: varchar("annee", { length: 20 }).notNull().default("2025-2026"),
  trimestre: integer("trimestre").notNull(),
  subject: varchar("subject", { length: 50 }).notNull(),
  score: numeric("score", { precision: 5, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Grade = typeof gradesTable.$inferSelect;
export type InsertGrade = typeof gradesTable.$inferInsert;

export const absencesTable = pgTable("absences", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  studentId: varchar("student_id", { length: 64 }).notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
  annee: varchar("annee", { length: 20 }).notNull().default("2025-2026"),
  trimestre: integer("trimestre").notNull(),
  justifiedHours: integer("justified_hours").notNull().default(0),
  unjustifiedHours: integer("unjustified_hours").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Absence = typeof absencesTable.$inferSelect;
export type InsertAbsence = typeof absencesTable.$inferInsert;

export const bemSessionsTable = pgTable("bem_sessions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  label: varchar("label", { length: 255 }),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type BemSession = typeof bemSessionsTable.$inferSelect;
export type InsertBemSession = typeof bemSessionsTable.$inferInsert;

export const dailyAbsenceReportsTable = pgTable("daily_absence_reports", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  reportDate: varchar("report_date", { length: 20 }).notNull(),
  studentsTotal: integer("students_total").notNull().default(0),
  studentsAbsent: integer("students_absent").notNull().default(0),
  teachersTotal: integer("teachers_total").notNull().default(0),
  teachersAbsent: integer("teachers_absent").notNull().default(0),
  adminTotal: integer("admin_total").notNull().default(0),
  adminAbsent: integer("admin_absent").notNull().default(0),
  workersTotal: integer("workers_total").notNull().default(0),
  workersAbsent: integer("workers_absent").notNull().default(0),
  cafeteriaSuspended: boolean("cafeteria_suspended"),
  fileName: varchar("file_name", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type DailyAbsenceReport = typeof dailyAbsenceReportsTable.$inferSelect;
export type InsertDailyAbsenceReport = typeof dailyAbsenceReportsTable.$inferInsert;

export const orientationWishesTable = pgTable("orientation_wishes", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  annee: varchar("annee", { length: 20 }).notNull().default("2025-2026"),
  nationalId: varchar("national_id", { length: 40 }),
  lastName: varchar("last_name", { length: 255 }).notNull(),
  firstName: varchar("first_name", { length: 255 }).notNull(),
  birthDate: varchar("birth_date", { length: 30 }),
  choices: jsonb("choices").notNull().$type<string[]>(),
  studentId: varchar("student_id", { length: 64 }).references(() => studentsTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type OrientationWish = typeof orientationWishesTable.$inferSelect;
export type InsertOrientationWish = typeof orientationWishesTable.$inferInsert;

// ─── Desktop Agent ─────────────────────────────────────────────────────────────
export const agentActionEnum = pgEnum("agent_action", [
  "upload_excel", "print_report", "open_folder", "open_file",
  "open_app", "backup_reports", "sync_data", "monitor_folder",
  "connect", "disconnect",
]);

export const agentTokensTable = pgTable("agent_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 128 }).notNull().unique(),
  deviceName: varchar("device_name", { length: 255 }),
  allowedFolders: jsonb("allowed_folders").$type<string[]>().default([]),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

export type AgentToken = typeof agentTokensTable.$inferSelect;
export type InsertAgentToken = typeof agentTokensTable.$inferInsert;

export const agentLogsTable = pgTable("agent_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentTokenId: varchar("agent_token_id").notNull().references(() => agentTokensTable.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  action: agentActionEnum("action").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("success"),
  details: jsonb("details"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AgentLog = typeof agentLogsTable.$inferSelect;
export type InsertAgentLog = typeof agentLogsTable.$inferInsert;

// ─── Executive Assistant — Reminders & Notifications ──────────────────────────
export const reminderPriorityEnum = pgEnum("reminder_priority", ["low", "medium", "high"]);
export const reminderStatusEnum   = pgEnum("reminder_status",   ["pending", "completed", "dismissed"]);

export const remindersTable = pgTable("reminders", {
  id:          varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId:      varchar("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  title:       varchar("title",       { length: 500  }).notNull(),
  description: varchar("description", { length: 2000 }),
  dueDate:     timestamp("due_date",  { withTimezone: true }),
  priority:    reminderPriorityEnum("priority").notNull().default("medium"),
  status:      reminderStatusEnum("status").notNull().default("pending"),
  category:    varchar("category",    { length: 100  }),
  metadata:    jsonb("metadata"),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type Reminder       = typeof remindersTable.$inferSelect;
export type InsertReminder = typeof remindersTable.$inferInsert;

export const notificationsTable = pgTable("notifications", {
  id:        varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId:    varchar("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  title:     varchar("title", { length: 500  }).notNull(),
  body:      varchar("body",  { length: 2000 }),
  type:      varchar("type",  { length: 50   }).notNull().default("info"),
  read:      boolean("read").notNull().default(false),
  metadata:  jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Notification       = typeof notificationsTable.$inferSelect;
export type InsertNotification = typeof notificationsTable.$inferInsert;

// ─── SMS Dispatch Log ──────────────────────────────────────────────────────────
export const smsStatusEnum = pgEnum("sms_status", ["sent", "failed", "queued", "no_phone"]);
export const smsChannelEnum = pgEnum("sms_channel", ["gateway", "modem", "socket"]);

export const smsLogsTable = pgTable("sms_logs", {
  id:          varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId:      varchar("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  studentId:   varchar("student_id", { length: 64 }).references(() => studentsTable.id, { onDelete: "set null" }),
  phone:       varchar("phone",   { length: 30 }),
  message:     varchar("message", { length: 1000 }).notNull(),
  status:      smsStatusEnum("status").notNull().default("queued"),
  channel:     smsChannelEnum("channel"),
  gatewayRef:  varchar("gateway_ref", { length: 255 }),
  errorMsg:    varchar("error_msg",   { length: 500 }),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SmsLog       = typeof smsLogsTable.$inferSelect;
export type InsertSmsLog = typeof smsLogsTable.$inferInsert;
