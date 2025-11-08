import { z } from "zod";
import { pgTable, varchar, integer, timestamp, text, boolean, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Database Tables
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

// TypeScript Types
export interface Document {
  id: string;
  name: string;
  size: number;
  status: "liquid" | "reconstituted" | "accessible";
  fragmentCount: number;
  lastAccessed?: string;
  uploadedAt: string;
  encryptionKey: string;
}

export interface DocumentPublic {
  id: string;
  name: string;
  size: number;
  status: "liquid" | "reconstituted" | "accessible";
  fragmentCount: number;
  lastAccessed?: string;
  uploadedAt: string;
}

export interface Fragment {
  id: string;
  documentId: string;
  fragmentIndex: number;
  encryptedData: string;
  iv: string;
  node: string;
  checksum: string;
}

export interface ChatSession {
  id: string;
  documentId?: string;
  messages: Array<{
    role: "ai" | "user";
    content: string;
    timestamp: string;
  }>;
  authenticated: boolean;
  createdAt: string;
  expiresAt?: string;
}

// Zod Schemas
export const insertDocumentSchema = z.object({
  name: z.string().min(1),
  size: z.number().positive(),
  fragmentCount: z.number().min(1),
  encryptionKey: z.string(),
});

export const insertFragmentSchema = z.object({
  documentId: z.string(),
  fragmentIndex: z.number().min(0),
  encryptedData: z.string(),
  iv: z.string(),
  node: z.string(),
  checksum: z.string(),
});

export const chatMessageSchema = z.object({
  sessionId: z.string(),
  documentId: z.string().optional(),
  message: z.string().min(1),
});

export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type InsertFragment = z.infer<typeof insertFragmentSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
