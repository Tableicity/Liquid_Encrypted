import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import bcrypt from "bcryptjs";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { storage } from "./storage";
import { startQuotaWarningJob } from "./jobs/quotaWarnings";

const app = express();

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    email?: string;
  }
}

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}

const PgSession = connectPg(session);
app.use(session({
  store: new PgSession({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET || 'liquid-encrypt-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  }
}));

app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

/**
 * Bootstrap owner account from OWNER_EMAIL environment variable
 * This should run once at startup to promote the designated owner
 */
async function bootstrapOwnerAccount() {
  const ownerEmail = process.env.OWNER_EMAIL;
  
  if (!ownerEmail) {
    console.log("[RBAC Bootstrap] No OWNER_EMAIL environment variable set. Skipping owner account setup.");
    return;
  }
  
  console.log(`[RBAC Bootstrap] Checking for owner account: ${ownerEmail}`);
  
  try {
    const user = await storage.getUserByEmail(ownerEmail);
    
    if (!user) {
      console.error(`❌ [RBAC Bootstrap] CRITICAL: User with email '${ownerEmail}' does not exist!`);
      console.error(`   Please create an account with this email first, then restart the application.`);
      return;
    }
    
    if (user.role === "owner") {
      console.log(`✅ [RBAC Bootstrap] User ${ownerEmail} already has 'owner' role.`);
      return;
    }
    
    // Promote user to owner
    await storage.updateUser(user.id, { role: "owner" });
    console.log(`🎯 [RBAC Bootstrap] SUCCESS: User ${ownerEmail} promoted to 'owner' role!`);
    
    // Log the promotion in audit logs
    await storage.createAuditLog({
      userId: user.id,
      action: "owner_bootstrap",
      resourceType: "user",
      resourceId: user.id,
      status: "success",
      details: {
        email: ownerEmail,
        previousRole: user.role,
        newRole: "owner",
        message: "Owner account bootstrapped from OWNER_EMAIL environment variable"
      }
    });
  } catch (error) {
    console.error(`❌ [RBAC Bootstrap] Error during owner bootstrap:`, error);
  }
}

async function bootstrapSuperAdminAccount() {
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD;

  if (!superAdminEmail || !superAdminPassword) {
    console.log("[RBAC Bootstrap] No SUPER_ADMIN_EMAIL/SUPER_ADMIN_PASSWORD set. Skipping super admin setup.");
    return;
  }

  console.log(`[RBAC Bootstrap] Checking for super admin account: ${superAdminEmail}`);

  try {
    let user = await storage.getUserByEmail(superAdminEmail);

    if (!user) {
      console.log(`[RBAC Bootstrap] Creating super admin account for ${superAdminEmail}...`);
      const passwordHash = await bcrypt.hash(superAdminPassword, 10);
      user = await storage.createUser({
        email: superAdminEmail,
        passwordHash,
        role: "super_admin",
      });
      console.log(`[RBAC Bootstrap] Super admin account created for ${superAdminEmail}`);

      await storage.createAuditLog({
        userId: user.id,
        action: "super_admin_bootstrap",
        resourceType: "user",
        resourceId: user.id,
        status: "success",
        details: {
          email: superAdminEmail,
          role: "super_admin",
          message: "Super admin account auto-created from environment variables"
        }
      });
      return;
    }

    if (user.role === "super_admin" || user.role === "owner") {
      console.log(`✅ [RBAC Bootstrap] User ${superAdminEmail} already has '${user.role}' role.`);
      return;
    }

    await storage.updateUser(user.id, { role: "super_admin" });
    console.log(`[RBAC Bootstrap] User ${superAdminEmail} promoted to 'super_admin' role.`);

    await storage.createAuditLog({
      userId: user.id,
      action: "super_admin_bootstrap",
      resourceType: "user",
      resourceId: user.id,
      status: "success",
      details: {
        email: superAdminEmail,
        previousRole: user.role,
        newRole: "super_admin",
        message: "Super admin account bootstrapped from environment variables"
      }
    });
  } catch (error) {
    console.error(`❌ [RBAC Bootstrap] Error during super admin bootstrap:`, error);
  }
}

(async () => {
  // Bootstrap privileged accounts before registering routes
  await bootstrapOwnerAccount();
  await bootstrapSuperAdminAccount();
  
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    
    // Start background jobs
    startQuotaWarningJob();
    log('[Server] Quota warning job started');
  });
})();
