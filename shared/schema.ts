import { z } from "zod";
import { pgTable, varchar, integer, timestamp, text, boolean, jsonb, decimal, inet, bigint } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";

// Users & Authentication Tables
// Role types: 'customer', 'support', 'billing_admin', 'super_admin', 'owner'
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  fullName: varchar("full_name", { length: 255 }),
  companyName: varchar("company_name", { length: 255 }),
  role: varchar("role", { length: 50 }).notNull().default("customer"),
  permissions: jsonb("permissions").default(sql`'{}'::jsonb`),
  status: varchar("status", { length: 50 }).notNull().default("active"),
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastLogin: timestamp("last_login"),
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
});

// Subscription Plans (3-tier pricing)
export const subscriptionPlans = pgTable("subscription_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  planType: varchar("plan_type", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  monthlyPrice: decimal("monthly_price", { precision: 10, scale: 2 }).notNull(),
  annualPrice: decimal("annual_price", { precision: 10, scale: 2 }),
  storageBaseGb: integer("storage_base_gb").notNull(),
  storageAddonUnitGb: integer("storage_addon_unit_gb").notNull(),
  storageAddonPrice: decimal("storage_addon_price", { precision: 10, scale: 2 }).notNull(),
  maxDocuments: integer("max_documents"),
  maxUsers: integer("max_users").default(1),
  fragmentNodeCount: integer("fragment_node_count").default(5),
  supportLevel: varchar("support_level", { length: 100 }),
  apiAccess: boolean("api_access").default(false),
  features: jsonb("features").default(sql`'[]'::jsonb`),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Subscriptions
export const subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 255 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  planId: varchar("plan_id", { length: 255 }).notNull().references(() => subscriptionPlans.id),
  billingCycle: varchar("billing_cycle", { length: 20 }).notNull().default("monthly"),
  basePrice: decimal("base_price", { precision: 10, scale: 2 }).notNull(),
  storageAddonGb: integer("storage_addon_gb").default(0),
  storageAddonPrice: decimal("storage_addon_price", { precision: 10, scale: 2 }).default(sql`0`),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  status: varchar("status", { length: 50 }).notNull().default("active"),
  trialEndDate: timestamp("trial_end_date"),
  currentPeriodStart: timestamp("current_period_start").notNull(),
  currentPeriodEnd: timestamp("current_period_end").notNull(),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Storage Usage Tracking - Byte-precise with GB display fields
export const storageUsage = pgTable("storage_usage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 255 }).notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  subscriptionId: varchar("subscription_id", { length: 255 }).references(() => subscriptions.id, { onDelete: "cascade" }),
  
  // Byte-precise fields (source of truth for quota enforcement)
  usedBytes: bigint("used_bytes", { mode: "number" }).notNull().default(0),
  quotaBytes: bigint("quota_bytes", { mode: "number" }).notNull(),
  
  // GB fields for display and backward compatibility
  allocatedGb: integer("allocated_gb").notNull(),
  usedGb: decimal("used_gb", { precision: 10, scale: 2 }).default(sql`0`),
  documentCount: integer("document_count").default(0),
  lastCalculated: timestamp("last_calculated").notNull().defaultNow(),
});

// Grace Periods - Track 7-day grace periods when users exceed storage quota
export const gracePeriods = pgTable("grace_periods", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 255 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  quotaExceededAt: timestamp("quota_exceeded_at").notNull().defaultNow(),
  gracePeriodEnd: timestamp("grace_period_end").notNull(),
  warningEmailsSent: integer("warning_emails_sent").default(0),
  status: varchar("status", { length: 20 }).notNull().default("active"), // 'active', 'resolved', 'expired'
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Payments & Billing
export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 255 }).references(() => users.id),
  subscriptionId: varchar("subscription_id", { length: 255 }).references(() => subscriptions.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD"),
  status: varchar("status", { length: 50 }).notNull(),
  paymentMethod: varchar("payment_method", { length: 50 }),
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
  stripeChargeId: varchar("stripe_charge_id", { length: 255 }),
  failureCode: varchar("failure_code", { length: 100 }),
  failureMessage: text("failure_message"),
  invoiceId: varchar("invoice_id", { length: 255 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  paidAt: timestamp("paid_at"),
});

// Audit Logs - Comprehensive security audit trail
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Legacy fields (backward compatibility)
  userId: varchar("user_id", { length: 255 }).references(() => users.id),
  adminId: varchar("admin_id", { length: 255 }).references(() => users.id),
  status: varchar("status", { length: 50 }),
  details: jsonb("details").default(sql`'{}'::jsonb`),
  
  // New Actor fields (who did it)
  actorId: varchar("actor_id", { length: 255 }).references(() => users.id),
  actorEmail: varchar("actor_email", { length: 255 }),
  actorRole: varchar("actor_role", { length: 50 }),
  
  // Action (what they did)
  action: varchar("action", { length: 100 }).notNull(),
  resourceType: varchar("resource_type", { length: 50 }),
  resourceId: varchar("resource_id", { length: 255 }),
  
  // Target (who/what was affected)
  targetUserId: varchar("target_user_id", { length: 255 }).references(() => users.id),
  targetUserEmail: varchar("target_user_email", { length: 255 }),
  
  // Context
  ipAddress: inet("ip_address"),
  userAgent: text("user_agent"),
  
  // Details
  changes: jsonb("changes").default(sql`'{}'::jsonb`),
  result: varchar("result", { length: 50 }),
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
  
  // Security - tamper-proof hash
  signature: varchar("signature", { length: 255 }),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Documents (updated with user_id)
export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 255 }).references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  size: integer("size").notNull(),
  status: varchar("status", { length: 50 }).notNull().default("liquid"),
  fragmentCount: integer("fragment_count").notNull(),
  encryptionKey: text("encryption_key").notNull(),
  lastAccessed: timestamp("last_accessed"),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
});

// Fragments (updated with health monitoring)
export const fragments = pgTable("fragments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id", { length: 255 }).notNull().references(() => documents.id, { onDelete: "cascade" }),
  fragmentIndex: integer("fragment_index").notNull(),
  encryptedData: text("encrypted_data").notNull(),
  iv: varchar("iv", { length: 255 }).notNull(),
  node: varchar("node", { length: 100 }).notNull(),
  checksum: varchar("checksum", { length: 255 }).notNull(),
  storageProvider: varchar("storage_provider", { length: 50 }),
  storageRegion: varchar("storage_region", { length: 100 }),
  fragmentSizeBytes: integer("fragment_size_bytes"),
  replicaCount: integer("replica_count").default(1),
  healthStatus: varchar("health_status", { length: 50 }).default("healthy"),
  lastVerified: timestamp("last_verified").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const chatSessions = pgTable("chat_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 255 }).references(() => users.id, { onDelete: "cascade" }),
  documentId: varchar("document_id", { length: 255 }).references(() => documents.id),
  messages: jsonb("messages").notNull().default(sql`'[]'::jsonb`),
  authenticated: boolean("authenticated").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"),
});

// TypeScript Types - Drizzle Inferred
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type InsertSubscriptionPlan = typeof subscriptionPlans.$inferInsert;

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;

export type StorageUsage = typeof storageUsage.$inferSelect;
export type InsertStorageUsage = typeof storageUsage.$inferInsert;

export type GracePeriod = typeof gracePeriods.$inferSelect;
export type InsertGracePeriod = typeof gracePeriods.$inferInsert;

// Reduced input type for grace period creation (gracePeriodEnd is auto-calculated)
export type CreateGracePeriodParams = Omit<InsertGracePeriod, "gracePeriodEnd" | "status" | "resolvedAt"> & {
  gracePeriodEnd?: Date; // Optional override, defaults to quotaExceededAt + 7 days
};

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;

export type Fragment = typeof fragments.$inferSelect;
export type InsertFragment = typeof fragments.$inferInsert;

export type ChatSession = typeof chatSessions.$inferSelect;
export type InsertChatSession = typeof chatSessions.$inferInsert;

// Public interfaces (for API responses)
export interface DocumentPublic {
  id: string;
  userId?: string;
  name: string;
  size: number;
  status: string;
  fragmentCount: number;
  lastAccessed?: string;
  uploadedAt: string;
}

export interface UserPublic {
  id: string;
  email: string;
  fullName?: string;
  companyName?: string;
  role: string;
  permissions: Record<string, any>;
  status: string;
  createdAt: string;
}

// Zod Validation Schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlans).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertStorageUsageSchema = createInsertSchema(storageUsage).omit({ id: true, lastCalculated: true });
export const insertGracePeriodSchema = createInsertSchema(gracePeriods).omit({ id: true, createdAt: true, updatedAt: true, quotaExceededAt: true, gracePeriodEnd: true, status: true, resolvedAt: true });
export const insertPaymentSchema = createInsertSchema(payments).omit({ id: true, createdAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true });
export const insertDocumentSchema = createInsertSchema(documents).omit({ id: true, uploadedAt: true });
export const insertFragmentSchema = createInsertSchema(fragments).omit({ id: true, createdAt: true, lastVerified: true });

// Custom validation schemas
export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().optional(),
  companyName: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const chatMessageSchema = z.object({
  sessionId: z.string(),
  documentId: z.string().optional(),
  message: z.string().min(1),
});

export type SignupData = z.infer<typeof signupSchema>;
export type LoginData = z.infer<typeof loginSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
