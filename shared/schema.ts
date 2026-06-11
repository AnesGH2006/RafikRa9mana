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

export const usersTable = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
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
export const resultatEnum = pgEnum("resultat_eleve", ["admis", "non_admis"]);

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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Student = typeof studentsTable.$inferSelect;
export type InsertStudent = typeof studentsTable.$inferInsert;

export const gradesTable = pgTable("grades", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  studentId: varchar("student_id", { length: 64 }).notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
  annee: varchar("annee", { length: 20 }).notNull().default("2025-2026"),
  trimestre: integer("trimestre").notNull(), // 1, 2, or 3
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
