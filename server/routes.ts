import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import OpenAI from "openai";
import { storage } from "./storage";
import { liquifyDocument, reconstituteDocument } from "./liquification";
import { StripeService, stripe } from "./stripe-service";
import { 
  insertDocumentSchema, 
  chatMessageSchema, 
  signupSchema, 
  loginSchema,
  type DocumentPublic 
} from "@shared/schema";
import { ZodError } from "zod";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET environment variable must be set for JWT authentication");
}
const JWT_SECRET: string = process.env.SESSION_SECRET;

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
    }
  }
}

// Middleware to verify JWT token
function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// Helper function to strip encryption key from document
function toPublicDocument(doc: any): DocumentPublic {
  const { encryptionKey, ...publicDoc } = doc;
  return publicDoc;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // ========== Authentication Routes ==========
  
  // Sign up new user
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const data = signupSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(data.email);
      if (existingUser) {
        return res.status(400).json({ error: "Email already registered" });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(data.password, 10);

      // Create user
      const user = await storage.createUser({
        email: data.email,
        passwordHash,
        role: "user",
      });

      // Create default storage usage record
      await storage.createStorageUsage({
        userId: user.id,
        allocatedGb: 0, // No storage until they subscribe
        usedGb: "0",
        documentCount: 0,
      });

      // Generate JWT token (expires in 30 days)
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: "30d" }
      );

      // Create audit log
      await storage.createAuditLog({
        userId: user.id,
        action: "user_signup",
        details: { email: user.email },
      });

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      console.error("Error during signup:", error);
      res.status(500).json({ error: "Failed to create account" });
    }
  });

  // Login user
  app.post("/api/auth/login", async (req, res) => {
    try {
      const data = loginSchema.parse(req.body);

      // Find user
      const user = await storage.getUserByEmail(data.email);
      if (!user) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Verify password
      const isValid = await bcrypt.compare(data.password, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Generate JWT token (expires in 30 days)
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: "30d" }
      );

      // Create audit log
      await storage.createAuditLog({
        userId: user.id,
        action: "user_login",
        details: { email: user.email },
      });

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      console.error("Error during login:", error);
      res.status(500).json({ error: "Failed to login" });
    }
  });

  // Verify current JWT token
  app.get("/api/auth/session", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No authentication token provided" });
    }

    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
      
      // Fetch user to ensure they still exist
      const user = await storage.getUser(decoded.userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      res.json({
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
  });

  // Logout user (client-side token removal, this endpoint for consistency)
  app.post("/api/auth/logout", (req, res) => {
    res.json({ success: true, message: "Logout successful. Remove token from client." });
  });

  // ========== Subscription Routes ==========
  const stripeService = new StripeService(storage);

  // Get all subscription plans
  app.get("/api/subscriptions/plans", async (req, res) => {
    try {
      const plans = await storage.getAllSubscriptionPlans();
      res.json(plans);
    } catch (error) {
      console.error("Error fetching subscription plans:", error);
      res.status(500).json({ error: "Failed to fetch subscription plans" });
    }
  });

  // Create subscription for authenticated user (adapted from blueprint:javascript_stripe)
  app.post("/api/subscriptions/create", requireAuth, async (req, res) => {
    try {
      // @ts-ignore - userId guaranteed by requireAuth middleware
      const userId: string = req.userId;
      const { planId } = req.body;

      if (!planId) {
        return res.status(400).json({ error: "Plan ID is required" });
      }

      // Create subscription
      const { subscriptionId, clientSecret } = await stripeService.createSubscription(userId, planId);

      res.json({
        subscriptionId,
        clientSecret,
      });
    } catch (error: any) {
      console.error("Error creating subscription:", error);
      res.status(400).json({ error: error.message || "Failed to create subscription" });
    }
  });

  // Get current user's subscription
  app.get("/api/subscriptions/current", requireAuth, async (req, res) => {
    try {
      // @ts-ignore - userId guaranteed by requireAuth middleware
      const userId: string = req.userId;
      
      const subscription = await storage.getSubscriptionByUserId(userId);
      if (!subscription) {
        return res.json({ subscription: null });
      }

      // Get plan details
      const plan = await storage.getSubscriptionPlan(subscription.planId);

      res.json({
        subscription: {
          ...subscription,
          plan,
        },
      });
    } catch (error) {
      console.error("Error fetching subscription:", error);
      res.status(500).json({ error: "Failed to fetch subscription" });
    }
  });

  // Stripe webhook endpoint (adapted from blueprint:javascript_stripe)
  app.post("/api/webhooks/stripe", async (req, res) => {
    const sig = req.headers["stripe-signature"] as string;

    if (!sig) {
      return res.status(400).json({ error: "Missing Stripe signature" });
    }

    let event: any;

    try {
      // Verify webhook signature using raw body (captured in server/index.ts)
      const rawBody = (req as any).rawBody;
      if (!rawBody) {
        throw new Error("Raw body not available for webhook verification");
      }

      event = stripe.webhooks.constructEvent(
        rawBody,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET || ""
      );
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }

    try {
      // Handle the event
      await stripeService.handleWebhook(event);
      res.json({ received: true });
    } catch (error: any) {
      console.error("Webhook handler error:", error);
      res.status(500).json({ error: "Webhook handler failed" });
    }
  });

  // ========== Document Routes ==========
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

  // Upload and liquify document (requires authentication)
  app.post("/api/documents/upload", requireAuth, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const fileData = req.file.buffer;
      const fileName = req.file.originalname;
      const fileSize = req.file.size;

      // Create document record with user ownership
      const doc = await storage.createDocument({
        name: fileName,
        size: fileSize,
        fragmentCount: 8,
        encryptionKey: "",
        userId: req.userId!,
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

      // Update storage usage
      if (!req.userId) throw new Error("User ID not found");
      // @ts-ignore - userId is guaranteed by requireAuth middleware
      const userId: string = req.userId;
      
      const currentUsage = await storage.getStorageUsageByUserId(userId);
      if (currentUsage) {
        const usedGb = parseFloat(currentUsage.usedGb) + (fileSize / (1024 * 1024 * 1024));
        await storage.updateStorageUsage(userId, {
          usedGb: usedGb.toFixed(2),
          documentCount: (currentUsage.documentCount || 0) + 1,
        });
      }

      // Create audit log
      await storage.createAuditLog({
        userId,
        action: "document_upload",
        resourceId: doc.id,
        details: { fileName, fileSize },
      });

      res.json(toPublicDocument(updatedDoc));
    } catch (error) {
      console.error("Error uploading document:", error);
      res.status(500).json({ error: "Failed to upload document" });
    }
  });

  // Delete document (requires authentication and ownership)
  app.delete("/api/documents/:id", requireAuth, async (req, res) => {
    try {
      const doc = await storage.getDocument(req.params.id);
      if (!doc) {
        return res.status(404).json({ error: "Document not found" });
      }

      // @ts-ignore - userId guaranteed by requireAuth middleware
      const userId: string = req.userId;

      // Check ownership (allow null userId for legacy documents)
      if (doc.userId && doc.userId !== userId) {
        return res.status(403).json({ error: "You do not have permission to delete this document" });
      }

      // Delete fragments
      await storage.deleteFragmentsByDocumentId(req.params.id);

      // Delete document
      await storage.deleteDocument(req.params.id);

      // Update storage usage
      const currentUsage = await storage.getStorageUsageByUserId(userId);
      if (currentUsage && doc.userId === userId) {
        const usedGb = Math.max(0, parseFloat(currentUsage.usedGb) - (doc.size / (1024 * 1024 * 1024)));
        await storage.updateStorageUsage(userId, {
          usedGb: usedGb.toFixed(2),
          documentCount: Math.max(0, (currentUsage.documentCount || 0) - 1),
        });
      }

      // Create audit log
      await storage.createAuditLog({
        userId,
        action: "document_delete",
        resourceId: doc.id,
        details: { documentName: doc.name, documentSize: doc.size },
      });

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
      if (session.expiresAt && session.expiresAt < new Date()) {
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
        lastAccessed: new Date(),
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
          ...(session.messages as Array<{ role: "ai" | "user"; content: string; timestamp: string }>).map((m) => ({
            role: m.role === "ai" ? ("assistant" as const) : ("user" as const),
            content: m.content,
          })),
          { role: "user", content: message },
        ],
        max_tokens: 200,
      });

      const aiResponse = completion.choices[0]?.message?.content || "I'm processing your story...";

      // Check if authentication should be granted based on AI analysis
      const responseLower = aiResponse.toLowerCase();
      const shouldAuthenticate = responseLower.includes("authentication successful") ||
        responseLower.includes("verified") ||
        responseLower.includes("access granted") ||
        responseLower.includes("access is granted") ||
        responseLower.includes("you may access") ||
        responseLower.includes("you have access") ||
        responseLower.includes("authenticated successfully") ||
        (responseLower.includes("narrative coherence") && responseLower.includes("emotional authenticity"));

      const aiMessage = {
        role: "ai" as const,
        content: shouldAuthenticate
          ? "Thank you for sharing that memory. I'm analyzing the narrative patterns, emotional authenticity, and linguistic markers to verify your identity. Authentication successful! You now have access to your documents."
          : aiResponse,
        timestamp: new Date().toISOString(),
      };

      // Update session with expiration time (30 minutes)
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
      const currentMessages = session.messages as Array<{ role: "ai" | "user"; content: string; timestamp: string }>;
      
      const updatedSession = await storage.updateChatSession(sessionId, {
        messages: [...currentMessages, userMessage, aiMessage] as any,
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
