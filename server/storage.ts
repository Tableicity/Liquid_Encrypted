import type { Document, Fragment, ChatSession, InsertDocument, InsertFragment } from "@shared/schema";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { documents, fragments, chatSessions } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Document operations
  getDocument(id: string): Promise<Document | undefined>;
  getAllDocuments(): Promise<Document[]>;
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
  createChatSession(documentId?: string): Promise<ChatSession>;
  updateChatSession(id: string, updates: Partial<ChatSession>): Promise<ChatSession | undefined>;
}

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

export class PostgresStorage implements IStorage {
  async getDocument(id: string): Promise<Document | undefined> {
    const result = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
    if (result.length === 0) return undefined;
    
    const doc = result[0];
    return {
      id: doc.id,
      name: doc.name,
      size: doc.size,
      status: doc.status as "liquid" | "reconstituted" | "accessible",
      fragmentCount: doc.fragmentCount,
      encryptionKey: doc.encryptionKey,
      lastAccessed: doc.lastAccessed?.toISOString(),
      uploadedAt: doc.uploadedAt.toISOString(),
    };
  }

  async getAllDocuments(): Promise<Document[]> {
    const result = await db.select().from(documents).orderBy(documents.uploadedAt);
    return result.map((doc) => ({
      id: doc.id,
      name: doc.name,
      size: doc.size,
      status: doc.status as "liquid" | "reconstituted" | "accessible",
      fragmentCount: doc.fragmentCount,
      encryptionKey: doc.encryptionKey,
      lastAccessed: doc.lastAccessed?.toISOString(),
      uploadedAt: doc.uploadedAt.toISOString(),
    }));
  }

  async createDocument(insertDoc: InsertDocument): Promise<Document> {
    const id = randomUUID();
    const result = await db
      .insert(documents)
      .values({
        id,
        name: insertDoc.name,
        size: insertDoc.size,
        fragmentCount: insertDoc.fragmentCount,
        encryptionKey: insertDoc.encryptionKey,
        status: "liquid",
      })
      .returning();

    const doc = result[0];
    return {
      id: doc.id,
      name: doc.name,
      size: doc.size,
      status: doc.status as "liquid" | "reconstituted" | "accessible",
      fragmentCount: doc.fragmentCount,
      encryptionKey: doc.encryptionKey,
      lastAccessed: doc.lastAccessed?.toISOString(),
      uploadedAt: doc.uploadedAt.toISOString(),
    };
  }

  async updateDocument(id: string, updates: Partial<Document>): Promise<Document | undefined> {
    const updateData: any = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.size !== undefined) updateData.size = updates.size;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.fragmentCount !== undefined) updateData.fragmentCount = updates.fragmentCount;
    if (updates.encryptionKey !== undefined) updateData.encryptionKey = updates.encryptionKey;
    if (updates.lastAccessed !== undefined) {
      updateData.lastAccessed = new Date(updates.lastAccessed);
    }

    const result = await db
      .update(documents)
      .set(updateData)
      .where(eq(documents.id, id))
      .returning();

    if (result.length === 0) return undefined;

    const doc = result[0];
    return {
      id: doc.id,
      name: doc.name,
      size: doc.size,
      status: doc.status as "liquid" | "reconstituted" | "accessible",
      fragmentCount: doc.fragmentCount,
      encryptionKey: doc.encryptionKey,
      lastAccessed: doc.lastAccessed?.toISOString(),
      uploadedAt: doc.uploadedAt.toISOString(),
    };
  }

  async deleteDocument(id: string): Promise<boolean> {
    const result = await db.delete(documents).where(eq(documents.id, id)).returning();
    return result.length > 0;
  }

  async getFragment(id: string): Promise<Fragment | undefined> {
    const result = await db.select().from(fragments).where(eq(fragments.id, id)).limit(1);
    if (result.length === 0) return undefined;
    return result[0];
  }

  async getFragmentsByDocumentId(documentId: string): Promise<Fragment[]> {
    const result = await db
      .select()
      .from(fragments)
      .where(eq(fragments.documentId, documentId))
      .orderBy(fragments.fragmentIndex);
    return result;
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

  async getChatSession(id: string): Promise<ChatSession | undefined> {
    const result = await db.select().from(chatSessions).where(eq(chatSessions.id, id)).limit(1);
    if (result.length === 0) return undefined;

    const session = result[0];
    return {
      id: session.id,
      documentId: session.documentId ?? undefined,
      messages: session.messages as Array<{ role: "ai" | "user"; content: string; timestamp: string }>,
      authenticated: session.authenticated,
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt?.toISOString(),
    };
  }

  async createChatSession(documentId?: string): Promise<ChatSession> {
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
        documentId: documentId ?? null,
        messages: initialMessages as any,
        authenticated: false,
      })
      .returning();

    const session = result[0];
    return {
      id: session.id,
      documentId: session.documentId ?? undefined,
      messages: session.messages as Array<{ role: "ai" | "user"; content: string; timestamp: string }>,
      authenticated: session.authenticated,
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt?.toISOString(),
    };
  }

  async updateChatSession(id: string, updates: Partial<ChatSession>): Promise<ChatSession | undefined> {
    const updateData: any = {};
    if (updates.messages !== undefined) updateData.messages = updates.messages;
    if (updates.authenticated !== undefined) updateData.authenticated = updates.authenticated;
    if (updates.expiresAt !== undefined) {
      updateData.expiresAt = new Date(updates.expiresAt);
    }

    const result = await db
      .update(chatSessions)
      .set(updateData)
      .where(eq(chatSessions.id, id))
      .returning();

    if (result.length === 0) return undefined;

    const session = result[0];
    return {
      id: session.id,
      documentId: session.documentId ?? undefined,
      messages: session.messages as Array<{ role: "ai" | "user"; content: string; timestamp: string }>,
      authenticated: session.authenticated,
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt?.toISOString(),
    };
  }
}

export const storage = new PostgresStorage();
