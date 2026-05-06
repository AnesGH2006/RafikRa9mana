import { pgTable, varchar, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export const planEnum = pgEnum("plan", ["gratuit", "standard", "pro", "max"]);
export const schoolModeEnum = pgEnum("school_mode", ["cem", "lycee"]);

export const subscriptionsTable = pgTable("subscriptions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  plan: planEnum("plan").notNull().default("gratuit"),
  schoolMode: schoolModeEnum("school_mode").notNull().default("cem"),
  activatedAt: timestamp("activated_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Subscription = typeof subscriptionsTable.$inferSelect;
export type InsertSubscription = typeof subscriptionsTable.$inferInsert;
