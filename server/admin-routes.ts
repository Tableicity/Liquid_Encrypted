import type { Express, Request, Response } from "express";
import { requireAuth, requireRole, hasPermission } from "./middleware";
import { storage } from "./storage";

/**
 * Admin Routes - Protected by owner/super_admin roles
 * All routes under /api/admin require authentication and elevated privileges
 */
export function registerAdminRoutes(app: Express) {
  // ========== Admin: User Management ==========
  
  // List all users (read-only)
  app.get(
    "/api/admin/users",
    requireAuth,
    requireRole(["owner", "super_admin"], storage),
    async (req, res) => {
      try {
        const users = await storage.getAllUsers();
        
        // Strip sensitive data (password hashes)
        const safeUsers = users.map((user) => ({
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          companyName: user.companyName,
          role: user.role,
          status: user.status,
          createdAt: user.createdAt,
          lastLogin: user.lastLogin,
        }));
        
        res.json(safeUsers);
      } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ error: "Failed to fetch users" });
      }
    }
  );
  
  // Get single user details
  app.get(
    "/api/admin/users/:id",
    requireAuth,
    requireRole(["owner", "super_admin"], storage),
    async (req, res) => {
      try {
        const user = await storage.getUser(req.params.id);
        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }
        
        // Strip password hash
        const { passwordHash, ...safeUser } = user;
        res.json(safeUser);
      } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).json({ error: "Failed to fetch user" });
      }
    }
  );
  
  // Update user role (owner only)
  app.patch(
    "/api/admin/users/:id/role",
    requireAuth,
    requireRole(["owner"], storage),
    async (req, res) => {
      try {
        const { role } = req.body;
        const allowedRoles = ["customer", "support", "billing_admin", "super_admin", "owner"];
        
        if (!role || !allowedRoles.includes(role)) {
          return res.status(400).json({ 
            error: "Invalid role",
            allowedRoles 
          });
        }
        
        const user = await storage.updateUser(req.params.id, { role });
        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }
        
        // Log the role change
        // @ts-ignore - userId guaranteed by requireAuth
        await storage.createAuditLog({
          userId: req.userId,
          action: "user_role_changed",
          resourceType: "user",
          resourceId: req.params.id,
          status: "success",
          details: {
            newRole: role,
            targetUserId: req.params.id,
          }
        });
        
        const { passwordHash, ...safeUser } = user;
        res.json(safeUser);
      } catch (error) {
        console.error("Error updating user role:", error);
        res.status(500).json({ error: "Failed to update user role" });
      }
    }
  );
  
  // ========== Admin: Subscription Overview ==========
  
  // TODO: Add getAllSubscriptions method to storage interface
  // List all subscriptions
  // app.get(
  //   "/api/admin/subscriptions",
  //   requireAuth,
  //   requireRole(["owner", "super_admin", "billing_admin"], storage),
  //   async (req, res) => {
  //     try {
  //       const subscriptions = await storage.getAllSubscriptions();
  //       res.json(subscriptions);
  //     } catch (error) {
  //       console.error("Error fetching subscriptions:", error);
  //       res.status(500).json({ error: "Failed to fetch subscriptions" });
  //     }
  //   }
  // );
  
  // ========== Admin: Audit Logs ==========
  
  // Get audit logs (limited to recent 100 entries)
  app.get(
    "/api/admin/audit-logs",
    requireAuth,
    requireRole(["owner", "super_admin"], storage),
    async (req, res) => {
      try {
        const limit = parseInt(req.query.limit as string) || 100;
        
        const logs = await storage.getRecentAuditLogs(limit);
        res.json(logs);
      } catch (error) {
        console.error("Error fetching audit logs:", error);
        res.status(500).json({ error: "Failed to fetch audit logs" });
      }
    }
  );
  
  // ========== Admin: System Management ==========
  
  // Seed subscription plans (owner only - migrated from main routes)
  app.post(
    "/api/admin/seed-plans",
    requireAuth,
    requireRole(["owner"], storage),
    async (req, res) => {
      try {
        // Check if plans already exist
        const existingPlans = await storage.getAllSubscriptionPlans();
        if (existingPlans.length > 0) {
          return res.status(400).json({ 
            error: "Plans already exist",
            message: "Use admin endpoints to modify existing plans" 
          });
        }
        
        // Default plan data
        const defaultPlans = [
          {
            planType: "personal",
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
            active: true,
          },
          {
            planType: "business",
            name: "Business Plan",
            monthlyPrice: 99.99,
            annualPrice: 959.90,
            storageBaseGb: 500,
            storageAddonUnitGb: 100,
            storageAddonPrice: 8.00,
            maxDocuments: 10000,
            maxUsers: 10,
            fragmentNodeCount: 8,
            supportLevel: "Priority Support",
            apiAccess: true,
            features: [
              "500GB encrypted storage",
              "Up to 10,000 documents",
              "Multi-user collaboration (up to 10 users)",
              "Priority support",
              "API access",
              "Fragment distribution across 8 nodes",
              "Advanced audit logging"
            ],
            active: true,
          },
          {
            planType: "enterprise",
            name: "Enterprise Plan",
            monthlyPrice: 999.99,
            annualPrice: 9599.90,
            storageBaseGb: 5120,
            storageAddonUnitGb: 500,
            storageAddonPrice: 50.00,
            maxDocuments: null, // Unlimited
            maxUsers: null, // Unlimited
            fragmentNodeCount: 12,
            supportLevel: "24/7 Dedicated Support",
            apiAccess: true,
            features: [
              "5TB encrypted storage",
              "Unlimited documents",
              "Unlimited users",
              "24/7 dedicated support",
              "Full API access",
              "Fragment distribution across 12 nodes",
              "Custom security policies",
              "White-label options",
              "SLA guarantees"
            ],
            active: true,
          },
        ];
        
        for (const plan of defaultPlans) {
          const planToCreate = {
            ...plan,
            monthlyPrice: plan.monthlyPrice.toFixed(2),
            annualPrice: plan.annualPrice.toFixed(2),
            storageAddonPrice: plan.storageAddonPrice.toFixed(2),
          };
          await storage.createSubscriptionPlan(planToCreate);
        }
        
        // Log the seeding action
        // @ts-ignore - userId guaranteed by requireAuth
        await storage.createAuditLog({
          userId: req.userId,
          action: "plans_seeded",
          resourceType: "subscription_plan",
          status: "success",
          details: {
            planCount: defaultPlans.length,
          }
        });
        
        res.json({ 
          success: true,
          message: "Subscription plans seeded successfully",
          planCount: defaultPlans.length 
        });
      } catch (error) {
        console.error("Error seeding plans:", error);
        res.status(500).json({ error: "Failed to seed plans" });
      }
    }
  );
  
  console.log("[Admin Routes] Registered admin endpoints under /api/admin");
}
