import { z } from "zod";

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
