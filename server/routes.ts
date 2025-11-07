import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import OpenAI from "openai";
import { storage } from "./storage";
import { liquifyDocument, reconstituteDocument } from "./liquification";
import { insertDocumentSchema, chatMessageSchema, type DocumentPublic } from "@shared/schema";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper function to strip encryption key from document
function toPublicDocument(doc: any): DocumentPublic {
  const { encryptionKey, ...publicDoc } = doc;
  return publicDoc;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Get all documents (without encryption keys)
  app.get("/api/documents", async (req, res) => {
    try {
      const documents = await storage.getAllDocuments();
      res.json(documents.map(toPublicDocument));
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ error: "Failed to fetch documents" });
    }
  });

  // Get single document (without encryption key)
  app.get("/api/documents/:id", async (req, res) => {
    try {
      const doc = await storage.getDocument(req.params.id);
      if (!doc) {
        return res.status(404).json({ error: "Document not found" });
      }
      res.json(toPublicDocument(doc));
    } catch (error) {
      console.error("Error fetching document:", error);
      res.status(500).json({ error: "Failed to fetch document" });
    }
  });

  // Upload and liquify document
  app.post("/api/documents/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const fileData = req.file.buffer;
      const fileName = req.file.originalname;
      const fileSize = req.file.size;

      // Create document record
      const doc = await storage.createDocument({
        name: fileName,
        size: fileSize,
        fragmentCount: 8,
        encryptionKey: "",
      });

      // Liquify the document
      const { fragments, encryptionKey } = await liquifyDocument(
        doc.id,
        fileData,
        fileName
      );

      // Store fragments
      await Promise.all(fragments.map((f) => storage.createFragment(f)));

      // Update document with encryption key
      const updatedDoc = await storage.updateDocument(doc.id, { encryptionKey });

      if (!updatedDoc) {
        return res.status(500).json({ error: "Failed to update document" });
      }

      res.json(toPublicDocument(updatedDoc));
    } catch (error) {
      console.error("Error uploading document:", error);
      res.status(500).json({ error: "Failed to upload document" });
    }
  });

  // Delete document
  app.delete("/api/documents/:id", async (req, res) => {
    try {
      const doc = await storage.getDocument(req.params.id);
      if (!doc) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Delete fragments
      await storage.deleteFragmentsByDocumentId(req.params.id);

      // Delete document
      await storage.deleteDocument(req.params.id);

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting document:", error);
      res.status(500).json({ error: "Failed to delete document" });
    }
  });

  // Reconstitute document (requires authenticated session)
  app.post("/api/documents/:id/reconstitute", async (req, res) => {
    try {
      const { sessionId } = req.body;

      if (!sessionId) {
        return res.status(401).json({ error: "Session ID required for authentication" });
      }

      // Verify session is authenticated
      const session = await storage.getChatSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      if (!session.authenticated) {
        return res.status(403).json({ error: "Session not authenticated. Please complete authentication first." });
      }

      // Check if session has expired (if expiration is set)
      if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
        return res.status(403).json({ error: "Session expired. Please authenticate again." });
      }

      const doc = await storage.getDocument(req.params.id);
      if (!doc) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Get all fragments
      const fragments = await storage.getFragmentsByDocumentId(req.params.id);
      if (fragments.length !== doc.fragmentCount) {
        return res.status(500).json({ error: "Missing fragments" });
      }

      // Reconstitute the document
      const reconstitutedData = await reconstituteDocument(fragments, doc.encryptionKey);

      // Update document status
      await storage.updateDocument(req.params.id, {
        status: "accessible",
        lastAccessed: new Date().toISOString(),
      });

      // Return the data as base64
      res.json({
        data: reconstitutedData.toString("base64"),
        name: doc.name,
      });
    } catch (error) {
      console.error("Error reconstituting document:", error);
      res.status(500).json({ error: "Failed to reconstitute document" });
    }
  });

  // Create chat session
  app.post("/api/chat/session", async (req, res) => {
    try {
      const { documentId } = req.body;
      const session = await storage.createChatSession(documentId);
      res.json(session);
    } catch (error) {
      console.error("Error creating chat session:", error);
      res.status(500).json({ error: "Failed to create chat session" });
    }
  });

  // Send chat message and get AI response
  app.post("/api/chat/message", async (req, res) => {
    try {
      if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({ 
          error: "OpenAI API key not configured. Story-based authentication is unavailable." 
        });
      }

      const data = chatMessageSchema.parse(req.body);
      const { sessionId, message } = data;

      const session = await storage.getChatSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Add user message
      const userMessage = {
        role: "user" as const,
        content: message,
        timestamp: new Date().toISOString(),
      };

      // Call OpenAI for story authentication
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a security AI that authenticates users through story-based verification. 
Analyze the user's story for:
1. Narrative coherence and detail
2. Emotional authenticity
3. Linguistic patterns consistent with genuine memory recall
4. Specific sensory details and temporal markers

If the story demonstrates these qualities, authenticate the user. 
Keep responses concise and professional. After 1-2 exchanges, decide whether to grant access.`,
          },
          ...session.messages.map((m) => ({
            role: m.role === "ai" ? ("assistant" as const) : ("user" as const),
            content: m.content,
          })),
          { role: "user", content: message },
        ],
        max_tokens: 200,
      });

      const aiResponse = completion.choices[0]?.message?.content || "I'm processing your story...";

      // Check if authentication should be granted
      const shouldAuthenticate = aiResponse.toLowerCase().includes("authentication successful") ||
        aiResponse.toLowerCase().includes("verified") ||
        aiResponse.toLowerCase().includes("access granted");

      const aiMessage = {
        role: "ai" as const,
        content: shouldAuthenticate
          ? "Thank you for sharing that memory. I'm analyzing the narrative patterns, emotional authenticity, and linguistic markers to verify your identity. Authentication successful! You now have access to your documents."
          : aiResponse,
        timestamp: new Date().toISOString(),
      };

      // Update session with expiration time (30 minutes)
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      
      const updatedSession = await storage.updateChatSession(sessionId, {
        messages: [...session.messages, userMessage, aiMessage],
        authenticated: shouldAuthenticate || session.authenticated,
        expiresAt: shouldAuthenticate ? expiresAt : session.expiresAt,
      });

      res.json({
        message: aiMessage,
        authenticated: updatedSession?.authenticated || false,
      });
    } catch (error) {
      console.error("Error processing chat message:", error);
      res.status(500).json({ error: "Failed to process message" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
