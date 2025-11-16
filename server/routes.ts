import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import OpenAI from "openai";
import { storage } from "./storage";
import { liquifyDocument, reconstituteDocument } from "./liquification";
import { StripeService, stripe } from "./stripe-service";
import { requireAuth, requireRole, hasPermission, assertDocumentAccess, type AuthRequest } from "./middleware";
import { checkStorageQuota, checkGracePeriodResolution } from "./middleware/quotaCheck";
import { registerAdminRoutes } from "./admin-routes";
import { 
  insertDocumentSchema, 
  chatMessageSchema, 
  signupSchema, 
  loginSchema,
  type DocumentPublic 
} from "@shared/schema";
import { ZodError } from "zod";
import { 
  createAuditLog, 
  auditLogin, 
  auditLoginFailure,
  auditDocumentUpload,
  auditDocumentDownload,
  auditDocumentDelete
} from "./utils/auditLog";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET environment variable must be set for JWT authentication");
}
const JWT_SECRET: string = process.env.SESSION_SECRET;

// Extend Express Request to include user (now handled by middleware.ts) and grace period warning
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
      userRole?: string;
      userPermissions?: Record<string, any>;
      gracePeriodWarning?: {
        within_grace_period: boolean;
        grace_period_end: string;
        days_remaining: number;
        current_usage_gb: string;
        quota_gb: string;
        overage_gb: string;
        first_time?: boolean;
      };
    }
  }
}

// Helper function to strip encryption key from document
function toPublicDocument(doc: any): DocumentPublic {
  const { encryptionKey, ...publicDoc } = doc;
  return publicDoc;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // ========== Configuration Routes ==========
  
  // Get Stripe publishable key (returns test or live key based on STRIPE_MODE)
  app.get("/api/config/stripe", (req, res) => {
    const stripeMode = process.env.STRIPE_MODE || "test";
    const isTestMode = stripeMode === "test";
    
    const publishableKey = isTestMode 
      ? process.env.TESTING_VITE_STRIPE_PUBLIC_KEY
      : process.env.VITE_STRIPE_PUBLIC_KEY;
    
    if (!publishableKey) {
      return res.status(500).json({ 
        error: `Missing Stripe publishable key for ${stripeMode} mode` 
      });
    }
    
    res.json({ 
      publishableKey,
      // Note: We don't expose the mode for security reasons
    });
  });
  
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
        role: "customer", // Default role for new signups
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
        { 
          userId: user.id, 
          email: user.email,
          role: user.role,
          permissions: user.permissions || {}
        },
        JWT_SECRET,
        { expiresIn: "30d" }
      );

      // Create comprehensive audit log
      await createAuditLog(storage, {
        actorId: user.id,
        actorEmail: user.email,
        actorRole: user.role,
        action: "USER_SIGNUP",
        result: "success",
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        metadata: { 
          fullName: data.fullName,
          companyName: data.companyName 
        },
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
        // Log failed login attempt
        await auditLoginFailure(storage, data.email, "invalid_email", req);
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Verify password
      const isValid = await bcrypt.compare(data.password, user.passwordHash);
      if (!isValid) {
        // Log failed login attempt
        await auditLoginFailure(storage, data.email, "invalid_password", req);
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Generate JWT token (expires in 30 days)
      const token = jwt.sign(
        { 
          userId: user.id, 
          email: user.email,
          role: user.role,
          permissions: user.permissions || {}
        },
        JWT_SECRET,
        { expiresIn: "30d" }
      );

      // Create comprehensive audit log for successful login
      await auditLogin(storage, user.id, user.email, user.role, req);

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
  
  // NOTE: Seed-plans endpoint moved to /api/admin/seed-plans (protected by owner role)

  // Get all subscription plans (auto-seeds if empty)
  app.get("/api/subscriptions/plans", async (req, res) => {
    try {
      let plans = await storage.getAllSubscriptionPlans();
      
      // Auto-seed if no plans exist
      if (plans.length === 0) {
        console.log("[/api/subscriptions/plans] No plans found, auto-seeding database...");
        
        const defaultPlans = [
          {
            planType: "personal" as const,
            name: "Personal Plan",
            monthlyPrice: 19.99,
            annualPrice: 191.90,
            storageBaseGb: 50,
            storageAddonUnitGb: 50,
            storageAddonPrice: 5.00,
            maxDocuments: 1000,
            maxUsers: 1,
            fragmentNodeCount: 5,
            supportLevel: "Email Support",
            apiAccess: false,
            features: [
              "50GB encrypted storage",
              "Up to 1,000 documents",
              "Story-based authentication",
              "Email support",
              "Fragment distribution across 5 nodes"
            ],
          },
          {
            planType: "business" as const,
            name: "Business Plan",
            monthlyPrice: 99.99,
            annualPrice: 959.90,
            storageBaseGb: 500,
            storageAddonUnitGb: 50,
            storageAddonPrice: 4.00,
            maxDocuments: 10000,
            maxUsers: 5,
            fragmentNodeCount: 8,
            supportLevel: "Priority Support",
            apiAccess: true,
            features: [
              "500GB encrypted storage",
              "Up to 10,000 documents",
              "Story-based authentication",
              "Priority support",
              "API access",
              "Fragment distribution across 8 nodes",
              "Advanced analytics"
            ],
          },
          {
            planType: "enterprise" as const,
            name: "Enterprise Plan",
            monthlyPrice: 999.99,
            annualPrice: 9599.90,
            storageBaseGb: 5120,
            storageAddonUnitGb: 50,
            storageAddonPrice: 3.00,
            maxDocuments: null,
            maxUsers: null,
            fragmentNodeCount: 12,
            supportLevel: "Dedicated Account Manager",
            apiAccess: true,
            features: [
              "5TB encrypted storage",
              "Unlimited documents",
              "Story-based authentication",
              "Dedicated account manager",
              "Full API access",
              "Fragment distribution across 12 nodes",
              "Advanced analytics",
              "Custom SLA",
              "Priority fragment healing"
            ],
          }
        ];

        for (const plan of defaultPlans) {
          // Convert numeric prices to strings for database
          const planToCreate = {
            ...plan,
            monthlyPrice: plan.monthlyPrice.toFixed(2),
            annualPrice: plan.annualPrice.toFixed(2),
            storageAddonPrice: plan.storageAddonPrice.toFixed(2),
          };
          await storage.createSubscriptionPlan(planToCreate);
        }
        
        // Fetch the newly created plans
        plans = await storage.getAllSubscriptionPlans();
        console.log(`[/api/subscriptions/plans] Auto-seeded ${plans.length} plans successfully`);
      }
      
      console.log(`[/api/subscriptions/plans] Returning ${plans.length} plans`);
      res.json(plans);
    } catch (error) {
      console.error("Error fetching subscription plans:", error);
      res.status(500).json({ error: "Failed to fetch subscription plans" });
    }
  });

  // Create SetupIntent for collecting payment method (Step 1)
  app.post("/api/subscriptions/setup-intent", requireAuth, requireRole(["customer", "support", "billing_admin", "super_admin", "owner"], storage), async (req, res) => {
    try {
      // @ts-ignore - userId guaranteed by requireAuth middleware
      const userId: string = req.userId;

      const { clientSecret } = await stripeService.createSetupIntent(userId);

      res.json({ clientSecret });
    } catch (error: any) {
      console.error("Error creating setup intent:", error);
      res.status(400).json({ error: error.message || "Failed to create setup intent" });
    }
  });

  // Create subscription with payment method (Step 2)
  app.post("/api/subscriptions/create", requireAuth, requireRole(["customer", "support", "billing_admin", "super_admin", "owner"], storage), async (req, res) => {
    try {
      // @ts-ignore - userId guaranteed by requireAuth middleware
      const userId: string = req.userId;
      const { planId, paymentMethodId } = req.body;

      if (!planId) {
        return res.status(400).json({ error: "Plan ID is required" });
      }

      if (!paymentMethodId) {
        return res.status(400).json({ error: "Payment method ID is required" });
      }

      // Create subscription with payment method
      const { subscriptionId } = await stripeService.createSubscription(
        userId,
        planId,
        paymentMethodId
      );

      res.json({
        subscriptionId,
      });
    } catch (error: any) {
      console.error("Error creating subscription:", error);
      res.status(400).json({ error: error.message || "Failed to create subscription" });
    }
  });

  // Get current user's subscription
  app.get("/api/subscriptions/current", requireAuth, requireRole(["customer", "support", "billing_admin", "super_admin", "owner"], storage), async (req, res) => {
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
  // Get all documents (without encryption keys) - Protected by customer role
  app.get("/api/documents", requireAuth, requireRole(["customer", "support", "owner", "super_admin"], storage), async (req: AuthRequest, res) => {
    try {
      const privilegedRoles = ["support", "super_admin", "owner"];
      let documents;
      
      // Privileged roles see all documents, customers see only their own
      if (req.userRole && privilegedRoles.includes(req.userRole)) {
        documents = await storage.getAllDocuments();
      } else {
        documents = await storage.getDocumentsByUserId(req.userId!);
      }
      
      res.json(documents.map(toPublicDocument));
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ error: "Failed to fetch documents" });
    }
  });

  // Get single document (without encryption key) - Protected by customer role
  app.get("/api/documents/:id", requireAuth, requireRole(["customer", "support", "owner", "super_admin"], storage), async (req: AuthRequest, res) => {
    try {
      const doc = await storage.getDocument(req.params.id);
      if (!doc) {
        return res.status(404).json({ error: "Document not found" });
      }
      
      // Check ownership
      const hasAccess = await assertDocumentAccess(req, doc, storage);
      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied. You can only access your own documents." });
      }
      
      res.json(toPublicDocument(doc));
    } catch (error) {
      console.error("Error fetching document:", error);
      res.status(500).json({ error: "Failed to fetch document" });
    }
  });

  // Upload and liquify document (requires authentication and customer role)
  app.post("/api/documents/upload", requireAuth, requireRole(["customer", "support", "owner", "super_admin"], storage), checkStorageQuota, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const fileData = req.file.buffer;
      const fileName = req.file.originalname;
      const fileSize = req.file.size;

      // @ts-ignore - userId guaranteed by requireAuth middleware
      const userId: string = req.userId;

      // Note: Quota check is now handled by checkStorageQuota middleware
      // Subscription check is also handled by the middleware - subscription should never be null here
      const subscription = await storage.getSubscriptionByUserId(userId);
      if (!subscription) {
        return res.status(500).json({ error: "Subscription not found after quota check" });
      }
      
      const plan = await storage.getSubscriptionPlan(subscription.planId);
      if (!plan) {
        return res.status(500).json({ error: "Subscription plan not found" });
      }
      
      const quotaGb = plan.storageBaseGb + (subscription.storageAddonGb || 0);
      const fileGb = fileSize / (1024 * 1024 * 1024);

      // Create document record with user ownership
      const doc = await storage.createDocument({
        name: fileName,
        size: fileSize,
        fragmentCount: 8,
        encryptionKey: "",
        userId: userId,
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

      // Atomically increment storage usage and get final total
      const updatedUsage = await storage.atomicIncrementStorageUsage(
        userId,
        subscription.id,
        quotaGb,
        fileGb
      );

      // Post-increment quota check (protects against concurrent uploads)
      const finalUsedGb = parseFloat(updatedUsage.usedGb || '0');
      if (finalUsedGb > quotaGb) {
        // Concurrent upload pushed us over quota - rollback this upload
        await storage.deleteDocument(doc.id);
        await storage.deleteFragmentsByDocumentId(doc.id);
        
        // Atomically rollback storage usage increment
        await storage.atomicDecrementStorageUsage(userId, fileGb);
        
        await createAuditLog(storage, {
          actorId: userId,
          actorEmail: req.userEmail,
          actorRole: req.userRole,
          action: "QUOTA_EXCEEDED_CONCURRENT",
          resourceType: "document",
          result: "failure",
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
          metadata: {
            fileName,
            fileSize,
            finalUsage: finalUsedGb.toFixed(2),
            quota: quotaGb,
            message: "Concurrent upload caused quota breach, rolled back"
          }
        });

        return res.status(409).json({ 
          error: "Storage quota exceeded during upload",
          message: "Another upload completed while this was processing. Please try again.",
          details: {
            currentUsage: finalUsedGb.toFixed(2) + " GB",
            quota: quotaGb + " GB",
          }
        });
      }

      // Create comprehensive audit log for successful document upload
      await auditDocumentUpload(storage, userId, req.userEmail!, doc.id, fileName, fileSize, req);

      // Build response with optional grace period warning
      const response: any = {
        success: true,
        document: toPublicDocument(updatedDoc)
      };

      // Add grace period warning if present (from checkStorageQuota middleware)
      if (req.gracePeriodWarning) {
        response.warning = {
          type: 'quota_exceeded',
          message: req.gracePeriodWarning.first_time 
            ? `Storage quota exceeded. You have a ${req.gracePeriodWarning.days_remaining}-day grace period to upgrade or free up space.`
            : `You are in a grace period. ${req.gracePeriodWarning.days_remaining} days remaining to resolve storage overage.`,
          details: req.gracePeriodWarning,
          actions: {
            upgrade_url: '/subscription/upgrade',
            manage_files_url: '/documents'
          }
        };
      }

      res.json(response);
    } catch (error) {
      console.error("Error uploading document:", error);
      res.status(500).json({ error: "Failed to upload document" });
    }
  });

  // Delete document (requires authentication, customer role, and ownership)
  app.delete("/api/documents/:id", requireAuth, requireRole(["customer", "support", "owner", "super_admin"], storage), async (req: AuthRequest, res) => {
    try {
      const doc = await storage.getDocument(req.params.id);
      if (!doc) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Check ownership using shared helper
      const hasAccess = await assertDocumentAccess(req, doc, storage);
      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied. You can only delete your own documents." });
      }

      // @ts-ignore - userId guaranteed by requireAuth middleware
      const userId: string = req.userId;

      // Delete fragments
      await storage.deleteFragmentsByDocumentId(req.params.id);

      // Delete document
      await storage.deleteDocument(req.params.id);

      // Update storage usage
      const currentUsage = await storage.getStorageUsageByUserId(userId);
      if (currentUsage && doc.userId === userId) {
        const usedGb = Math.max(0, parseFloat(currentUsage.usedGb || '0') - (doc.size / (1024 * 1024 * 1024)));
        await storage.updateStorageUsage(userId, {
          usedGb: usedGb.toFixed(2),
          documentCount: Math.max(0, (currentUsage.documentCount || 0) - 1),
        });
      }

      // Check if deletion resolved grace period
      const gracePeriodResolved = await checkGracePeriodResolution(userId);

      // Create comprehensive audit log for document deletion
      await auditDocumentDelete(storage, userId, req.userEmail!, doc.id, doc.name, req);

      const response: any = {
        success: true
      };

      if (gracePeriodResolved) {
        response.info = {
          message: 'Your storage is now under quota. Grace period has been resolved.',
          grace_period_resolved: true
        };
      }

      res.json(response);
    } catch (error) {
      console.error("Error deleting document:", error);
      res.status(500).json({ error: "Failed to delete document" });
    }
  });

  // Reconstitute document (CRITICAL: requires auth + customer role)
  // TODO: Replace with story-based authentication system for enhanced security
  app.post("/api/documents/:id/reconstitute", requireAuth, requireRole(["customer", "support", "owner", "super_admin"], storage), async (req: AuthRequest, res) => {
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
      
      // Check ownership using shared helper
      const hasAccess = await assertDocumentAccess(req, doc, storage);
      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied. You can only access your own documents." });
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

  // Create chat session (protected by customer role)
  // TODO: Integrate story-based authentication tokens for enhanced narrative verification
  app.post("/api/chat/session", requireAuth, requireRole(["customer", "support", "owner", "super_admin"], storage), async (req: AuthRequest, res) => {
    try {
      const { documentId } = req.body;
      
      // If documentId provided, verify user owns the document
      if (documentId) {
        const doc = await storage.getDocument(documentId);
        if (!doc) {
          return res.status(404).json({ error: "Document not found" });
        }
        
        // Check ownership
        const hasAccess = await assertDocumentAccess(req, doc, storage);
        if (!hasAccess) {
          return res.status(403).json({ error: "Access denied. You can only create chat sessions for your own documents." });
        }
      }
      
      const session = await storage.createChatSession(documentId, req.userId);
      res.json(session);
    } catch (error) {
      console.error("Error creating chat session:", error);
      res.status(500).json({ error: "Failed to create chat session" });
    }
  });

  // Send chat message and get AI response (protected by customer role)
  // TODO: Integrate story-based authentication tokens for enhanced narrative verification
  app.post("/api/chat/message", requireAuth, requireRole(["customer", "support", "owner", "super_admin"], storage), async (req, res) => {
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

  // ========== Admin Routes ==========
  registerAdminRoutes(app);

  const httpServer = createServer(app);

  return httpServer;
}
