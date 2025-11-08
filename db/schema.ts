import { pgTable, varchar, integer, timestamp, text, boolean, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  size: integer("size").notNull(),
  status: varchar("status", { length: 50 }).notNull().default("liquid"),
  fragmentCount: integer("fragment_count").notNull(),
  encryptionKey: text("encryption_key").notNull(),
  lastAccessed: timestamp("last_accessed"),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
});

export const fragments = pgTable("fragments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id", { length: 255 }).notNull().references(() => documents.id, { onDelete: "cascade" }),
  fragmentIndex: integer("fragment_index").notNull(),
  encryptedData: text("encrypted_data").notNull(),
  iv: varchar("iv", { length: 255 }).notNull(),
  node: varchar("node", { length: 100 }).notNull(),
  checksum: varchar("checksum", { length: 255 }).notNull(),
});

export const chatSessions = pgTable("chat_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id", { length: 255 }).references(() => documents.id),
  messages: jsonb("messages").notNull().default(sql`'[]'::jsonb`),
  authenticated: boolean("authenticated").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"),
});
