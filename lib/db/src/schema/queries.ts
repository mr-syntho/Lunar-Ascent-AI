import { pgTable, text, serial, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const queriesTable = pgTable("queries", {
  id: serial("id").primaryKey(),
  query: text("query").notNull(),
  taskType: text("task_type").notNull(),
  result: text("result").notNull(),
  imageUrl: text("image_url"),
  sources: json("sources").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertQuerySchema = createInsertSchema(queriesTable).omit({ id: true, createdAt: true });
export type InsertQuery = z.infer<typeof insertQuerySchema>;
export type Query = typeof queriesTable.$inferSelect;
