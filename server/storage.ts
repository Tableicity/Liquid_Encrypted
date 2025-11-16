import type { 
  Document, Fragment, ChatSession, 
  InsertDocument, InsertFragment,
  User, InsertUser,
  Subscription, InsertSubscription,
  SubscriptionPlan,
  StorageUsage, InsertStorageUsage,
  GracePeriod, InsertGracePeriod,
  Payment, InsertPayment,
  AuditLog, InsertAuditLog
} from "@shared/schema";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, and, desc, sql as drizzleSql } from "drizzle-orm";
import postgres from "postgres";
import { 
  documents, fragments, chatSessions, 
  users, subscriptions, subscriptionPlans,
  storageUsage, gracePeriods, payments, auditLogs
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Document operations
  getDocument(id: string): Promise<Document | undefined>;
  getAllDocuments(): Promise<Document[]>;
  getDocumentsByUserId(userId: string): Promise<Document[]>;
  createDocument(doc: InsertDocument): Promise<Document>;
  updateDocument(id: string, updates: Partial<Document>): Promise<Document | undefined>;
  deleteDocument(id: string): Promise<boolean>;

  // Fragment operations
  getFragment(id: string): Promise<Fragment | undefined>;
  getFragmentsByDocumentId(documentId: string): Promise<Fragment[]>;
  createFragment(fragment: InsertFragment): Promise<Fragment>;
  deleteFragmentsByDocumentId(documentId: string): Promise<number>;

  // Chat session operations
  getChatSession(id: string): Promise<ChatSession | undefined>;
  createChatSession(documentId?: string, userId?: string): Promise<ChatSession>;
  updateChatSession(id: string, updates: Partial<ChatSession>): Promise<ChatSession | undefined>;

  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;

  // Subscription operations
  getSubscription(id: string): Promise<Subscription | undefined>;
  getSubscriptionByUserId(userId: string): Promise<Subscription | undefined>;
  createSubscription(subscription: InsertSubscription): Promise<Subscription>;
  updateSubscription(id: string, updates: Partial<Subscription>): Promise<Subscription | undefined>;
  cancelSubscription(id: string): Promise<boolean>;

  // Subscription Plan operations
  getAllSubscriptionPlans(): Promise<SubscriptionPlan[]>;
  getSubscriptionPlan(id: string): Promise<SubscriptionPlan | undefined>;
  getSubscriptionPlanByType(planType: string): Promise<SubscriptionPlan | undefined>;
  createSubscriptionPlan(plan: Omit<SubscriptionPlan, 'id' | 'active' | 'createdAt' | 'updatedAt'>): Promise<SubscriptionPlan>;

  // Storage Usage operations
  getStorageUsageByUserId(userId: string): Promise<StorageUsage | undefined>;
  createStorageUsage(usage: InsertStorageUsage): Promise<StorageUsage>;
  updateStorageUsage(userId: string, updates: Partial<StorageUsage>): Promise<StorageUsage | undefined>;
  calculateStorageUsage(userId: string): Promise<{ usedGb: number; documentCount: number }>;
  // Atomic increment for upload quota enforcement
  atomicIncrementStorageUsage(userId: string, subscriptionId: string, allocatedGb: number, fileSizeGb: number): Promise<StorageUsage>;
  // Atomic decrement for upload rollback
  atomicDecrementStorageUsage(userId: string, fileSizeGb: number): Promise<StorageUsage>;

  // Grace Period operations (quota enforcement)
  getActiveGracePeriodByUserId(userId: string): Promise<GracePeriod | undefined>;
  createGracePeriod(gracePeriod: InsertGracePeriod): Promise<GracePeriod>;
  updateGracePeriod(id: string, updates: Partial<GracePeriod>): Promise<GracePeriod | undefined>;
  resolveGracePeriod(userId: string): Promise<boolean>;

  // Payment operations
  getPayment(id: string): Promise<Payment | undefined>;
  getPaymentsByUserId(userId: string): Promise<Payment[]>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePayment(id: string, updates: Partial<Payment>): Promise<Payment | undefined>;

  // Audit Log operations
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogsByUserId(userId: string, limit?: number): Promise<AuditLog[]>;
  getRecentAuditLogs(limit?: number): Promise<AuditLog[]>;
}

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

export class PostgresStorage implements IStorage {
  // Document operations
  async getDocument(id: string): Promise<Document | undefined> {
    const result = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
    return result[0];
  }

  async getAllDocuments(): Promise<Document[]> {
    return await db.select().from(documents).orderBy(desc(documents.uploadedAt));
  }

  async getDocumentsByUserId(userId: string): Promise<Document[]> {
    return await db.select().from(documents).where(eq(documents.userId, userId)).orderBy(desc(documents.uploadedAt));
  }

  async createDocument(insertDoc: InsertDocument): Promise<Document> {
    const id = randomUUID();
    const result = await db
      .insert(documents)
      .values({
        id,
        ...insertDoc,
        status: "liquid",
      })
      .returning();
    return result[0];
  }

  async updateDocument(id: string, updates: Partial<Document>): Promise<Document | undefined> {
    const result = await db
      .update(documents)
      .set(updates)
      .where(eq(documents.id, id))
      .returning();
    return result[0];
  }

  async deleteDocument(id: string): Promise<boolean> {
    const result = await db.delete(documents).where(eq(documents.id, id)).returning();
    return result.length > 0;
  }

  // Fragment operations
  async getFragment(id: string): Promise<Fragment | undefined> {
    const result = await db.select().from(fragments).where(eq(fragments.id, id)).limit(1);
    return result[0];
  }

  async getFragmentsByDocumentId(documentId: string): Promise<Fragment[]> {
    return await db
      .select()
      .from(fragments)
      .where(eq(fragments.documentId, documentId))
      .orderBy(fragments.fragmentIndex);
  }

  async createFragment(insertFragment: InsertFragment): Promise<Fragment> {
    const id = randomUUID();
    const result = await db
      .insert(fragments)
      .values({
        id,
        ...insertFragment,
      })
      .returning();
    return result[0];
  }

  async deleteFragmentsByDocumentId(documentId: string): Promise<number> {
    const result = await db.delete(fragments).where(eq(fragments.documentId, documentId)).returning();
    return result.length;
  }

  // Chat session operations
  async getChatSession(id: string): Promise<ChatSession | undefined> {
    const result = await db.select().from(chatSessions).where(eq(chatSessions.id, id)).limit(1);
    return result[0];
  }

  async createChatSession(documentId?: string, userId?: string): Promise<ChatSession> {
    const id = randomUUID();
    const initialMessages = [
      {
        role: "ai" as const,
        content:
          "Welcome! To verify your identity and access your documents, please share a personal story with me. Tell me about a memorable moment from your past.",
        timestamp: new Date().toISOString(),
      },
    ];

    const result = await db
      .insert(chatSessions)
      .values({
        id,
        userId: userId ?? null,
        documentId: documentId ?? null,
        messages: initialMessages as any,
        authenticated: false,
      })
      .returning();
    return result[0];
  }

  async updateChatSession(id: string, updates: Partial<ChatSession>): Promise<ChatSession | undefined> {
    const result = await db
      .update(chatSessions)
      .set(updates)
      .where(eq(chatSessions.id, id))
      .returning();
    return result[0];
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0];
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async createUser(user: InsertUser): Promise<User> {
    const id = randomUUID();
    const result = await db
      .insert(users)
      .values({
        id,
        ...user,
      })
      .returning();
    return result[0];
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const result = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    return result.length > 0;
  }

  // Subscription operations
  async getSubscription(id: string): Promise<Subscription | undefined> {
    const result = await db.select().from(subscriptions).where(eq(subscriptions.id, id)).limit(1);
    return result[0];
  }

  async getSubscriptionByUserId(userId: string): Promise<Subscription | undefined> {
    const result = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).limit(1);
    return result[0];
  }

  async createSubscription(subscription: InsertSubscription): Promise<Subscription> {
    const id = randomUUID();
    const result = await db
      .insert(subscriptions)
      .values({
        id,
        ...subscription,
      })
      .returning();
    return result[0];
  }

  async updateSubscription(id: string, updates: Partial<Subscription>): Promise<Subscription | undefined> {
    const result = await db
      .update(subscriptions)
      .set(updates)
      .where(eq(subscriptions.id, id))
      .returning();
    return result[0];
  }

  async cancelSubscription(id: string): Promise<boolean> {
    const result = await db
      .update(subscriptions)
      .set({ status: "cancelled", cancelAtPeriodEnd: true })
      .where(eq(subscriptions.id, id))
      .returning();
    return result.length > 0;
  }

  // Subscription Plan operations
  async getAllSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    return await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.active, true));
  }

  async getSubscriptionPlan(id: string): Promise<SubscriptionPlan | undefined> {
    const result = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, id)).limit(1);
    return result[0];
  }

  async getSubscriptionPlanByType(planType: string): Promise<SubscriptionPlan | undefined> {
    const result = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.planType, planType)).limit(1);
    return result[0];
  }

  async createSubscriptionPlan(plan: Omit<SubscriptionPlan, 'id' | 'active' | 'createdAt' | 'updatedAt'>): Promise<SubscriptionPlan> {
    const id = randomUUID();
    const result = await db
      .insert(subscriptionPlans)
      .values({
        id,
        ...plan,
        active: true,
      })
      .returning();
    return result[0];
  }

  // Storage Usage operations
  async getStorageUsageByUserId(userId: string): Promise<StorageUsage | undefined> {
    const result = await db.select().from(storageUsage).where(eq(storageUsage.userId, userId)).limit(1);
    return result[0];
  }

  async createStorageUsage(usage: InsertStorageUsage): Promise<StorageUsage> {
    const id = randomUUID();
    const result = await db
      .insert(storageUsage)
      .values({
        id,
        ...usage,
      })
      .returning();
    return result[0];
  }

  async updateStorageUsage(userId: string, updates: Partial<StorageUsage>): Promise<StorageUsage | undefined> {
    const result = await db
      .update(storageUsage)
      .set(updates)
      .where(eq(storageUsage.userId, userId))
      .returning();
    return result[0];
  }

  async calculateStorageUsage(userId: string): Promise<{ usedGb: number; documentCount: number }> {
    const docs = await db.select().from(documents).where(eq(documents.userId, userId));
    const totalBytes = docs.reduce((sum, doc) => sum + doc.size, 0);
    const usedGb = totalBytes / (1024 * 1024 * 1024);
    return {
      usedGb: Math.round(usedGb * 100) / 100,
      documentCount: docs.length,
    };
  }

  async atomicIncrementStorageUsage(
    userId: string,
    subscriptionId: string,
    allocatedGb: number,
    fileSizeGb: number
  ): Promise<StorageUsage> {
    // Single atomic UPSERT: creates record if missing, increments if exists
    // Uses Drizzle's sql template for proper typing and parameterization
    const id = randomUUID();
    const fileSizeGbStr = fileSizeGb.toFixed(2);
    
    const result = await db.execute(drizzleSql`
      INSERT INTO storage_usage (
        id, user_id, subscription_id, allocated_gb, used_gb, document_count, last_calculated
      )
      VALUES (
        ${id}, ${userId}, ${subscriptionId}, ${allocatedGb}, ${fileSizeGbStr}, 1, NOW()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        used_gb = CAST(storage_usage.used_gb AS NUMERIC) + CAST(${fileSizeGbStr} AS NUMERIC),
        document_count = storage_usage.document_count + 1,
        allocated_gb = GREATEST(storage_usage.allocated_gb, ${allocatedGb}),
        last_calculated = NOW()
      RETURNING *
    `);

    if (!result || result.length === 0) {
      throw new Error("Failed to atomically increment storage usage");
    }

    // Convert postgres result to StorageUsage type
    const row = result[0] as any;
    return {
      id: row.id,
      userId: row.user_id,
      subscriptionId: row.subscription_id,
      allocatedGb: parseInt(row.allocated_gb),
      usedGb: row.used_gb,
      documentCount: parseInt(row.document_count),
      lastCalculated: row.last_calculated,
    };
  }

  async atomicDecrementStorageUsage(
    userId: string,
    fileSizeGb: number
  ): Promise<StorageUsage> {
    // Atomic decrement for quota rollback (e.g., when upload fails after increment)
    const fileSizeGbStr = fileSizeGb.toFixed(2);
    
    const result = await db.execute(drizzleSql`
      UPDATE storage_usage 
      SET 
        used_gb = GREATEST(CAST(used_gb AS NUMERIC) - CAST(${fileSizeGbStr} AS NUMERIC), 0),
        document_count = GREATEST(document_count - 1, 0),
        last_calculated = NOW()
      WHERE user_id = ${userId}
      RETURNING *
    `);

    if (!result || result.length === 0) {
      throw new Error("Failed to atomically decrement storage usage");
    }

    // Convert postgres result to StorageUsage type
    const row = result[0] as any;
    return {
      id: row.id,
      userId: row.user_id,
      subscriptionId: row.subscription_id,
      allocatedGb: parseInt(row.allocated_gb),
      usedGb: row.used_gb,
      documentCount: parseInt(row.document_count),
      lastCalculated: row.last_calculated,
    };
  }

  // Grace Period operations (quota enforcement)
  async getActiveGracePeriodByUserId(userId: string): Promise<GracePeriod | undefined> {
    const result = await db
      .select()
      .from(gracePeriods)
      .where(and(eq(gracePeriods.userId, userId), eq(gracePeriods.status, "active")))
      .orderBy(desc(gracePeriods.createdAt))
      .limit(1);
    return result[0];
  }

  async createGracePeriod(gracePeriod: InsertGracePeriod): Promise<GracePeriod> {
    const id = randomUUID();
    
    // Calculate grace period end: 7 days from quotaExceededAt (or now if not provided)
    const quotaExceededDate = gracePeriod.quotaExceededAt || new Date();
    const gracePeriodEnd = new Date(quotaExceededDate);
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7); // Add 7 days
    
    const result = await db
      .insert(gracePeriods)
      .values({
        id,
        userId: gracePeriod.userId,
        quotaExceededAt: quotaExceededDate,
        gracePeriodEnd, // Automatically calculated - cannot be overridden
        warningEmailsSent: gracePeriod.warningEmailsSent || 0,
        status: "active",
      })
      .returning();
    return result[0];
  }

  async updateGracePeriod(id: string, updates: Partial<GracePeriod>): Promise<GracePeriod | undefined> {
    const result = await db
      .update(gracePeriods)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(gracePeriods.id, id))
      .returning();
    return result[0];
  }

  async resolveGracePeriod(userId: string): Promise<boolean> {
    const result = await db
      .update(gracePeriods)
      .set({ 
        status: "resolved", 
        resolvedAt: new Date(),
        updatedAt: new Date()
      })
      .where(and(eq(gracePeriods.userId, userId), eq(gracePeriods.status, "active")))
      .returning();
    return result.length > 0;
  }

  // Payment operations
  async getPayment(id: string): Promise<Payment | undefined> {
    const result = await db.select().from(payments).where(eq(payments.id, id)).limit(1);
    return result[0];
  }

  async getPaymentsByUserId(userId: string): Promise<Payment[]> {
    return await db.select().from(payments).where(eq(payments.userId, userId)).orderBy(desc(payments.createdAt));
  }

  async createPayment(payment: InsertPayment): Promise<Payment> {
    const id = randomUUID();
    const result = await db
      .insert(payments)
      .values({
        id,
        ...payment,
      })
      .returning();
    return result[0];
  }

  async updatePayment(id: string, updates: Partial<Payment>): Promise<Payment | undefined> {
    const result = await db
      .update(payments)
      .set(updates)
      .where(eq(payments.id, id))
      .returning();
    return result[0];
  }

  // Audit Log operations
  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const id = randomUUID();
    const result = await db
      .insert(auditLogs)
      .values({
        id,
        ...log,
      })
      .returning();
    return result[0];
  }

  async getAuditLogsByUserId(userId: string, limit: number = 100): Promise<AuditLog[]> {
    return await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.userId, userId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
  }

  async getRecentAuditLogs(limit: number = 100): Promise<AuditLog[]> {
    return await db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
  }
}

export const storage = new PostgresStorage();
