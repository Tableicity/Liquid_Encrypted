import type { Document, Fragment, ChatSession, InsertDocument, InsertFragment } from "@shared/schema";
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

export class MemStorage implements IStorage {
  private documents: Map<string, Document>;
  private fragments: Map<string, Fragment>;
  private chatSessions: Map<string, ChatSession>;

  constructor() {
    this.documents = new Map();
    this.fragments = new Map();
    this.chatSessions = new Map();
  }

  async getDocument(id: string): Promise<Document | undefined> {
    return this.documents.get(id);
  }

  async getAllDocuments(): Promise<Document[]> {
    return Array.from(this.documents.values()).sort(
      (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );
  }

  async createDocument(insertDoc: InsertDocument): Promise<Document> {
    const id = randomUUID();
    const doc: Document = {
      ...insertDoc,
      id,
      status: "liquid",
      uploadedAt: new Date().toISOString(),
    };
    this.documents.set(id, doc);
    return doc;
  }

  async updateDocument(id: string, updates: Partial<Document>): Promise<Document | undefined> {
    const doc = this.documents.get(id);
    if (!doc) return undefined;

    const updated = { ...doc, ...updates };
    this.documents.set(id, updated);
    return updated;
  }

  async deleteDocument(id: string): Promise<boolean> {
    return this.documents.delete(id);
  }

  async getFragment(id: string): Promise<Fragment | undefined> {
    return this.fragments.get(id);
  }

  async getFragmentsByDocumentId(documentId: string): Promise<Fragment[]> {
    return Array.from(this.fragments.values())
      .filter((f) => f.documentId === documentId)
      .sort((a, b) => a.fragmentIndex - b.fragmentIndex);
  }

  async createFragment(insertFragment: InsertFragment): Promise<Fragment> {
    const id = randomUUID();
    const fragment: Fragment = { ...insertFragment, id };
    this.fragments.set(id, fragment);
    return fragment;
  }

  async deleteFragmentsByDocumentId(documentId: string): Promise<number> {
    const fragments = await this.getFragmentsByDocumentId(documentId);
    fragments.forEach((f) => this.fragments.delete(f.id));
    return fragments.length;
  }

  async getChatSession(id: string): Promise<ChatSession | undefined> {
    return this.chatSessions.get(id);
  }

  async createChatSession(documentId?: string): Promise<ChatSession> {
    const id = randomUUID();
    const session: ChatSession = {
      id,
      documentId,
      messages: [
        {
          role: "ai",
          content:
            "Welcome! To verify your identity and access your documents, please share a personal story with me. Tell me about a memorable moment from your past.",
          timestamp: new Date().toISOString(),
        },
      ],
      authenticated: false,
      createdAt: new Date().toISOString(),
    };
    this.chatSessions.set(id, session);
    return session;
  }

  async updateChatSession(id: string, updates: Partial<ChatSession>): Promise<ChatSession | undefined> {
    const session = this.chatSessions.get(id);
    if (!session) return undefined;

    const updated = { ...session, ...updates };
    this.chatSessions.set(id, updated);
    return updated;
  }
}

export const storage = new MemStorage();
