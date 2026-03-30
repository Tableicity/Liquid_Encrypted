import type { Express } from "express";
import { storage } from "./storage";
import { requireAuth, type AuthRequest } from "./middleware";
import { createOrganizationSchema } from "@shared/schema";
import { ZodError } from "zod";
import { createAuditLog } from "./utils/auditLog";

export function registerOrgRoutes(app: Express) {
  app.get("/api/organizations", requireAuth, async (req: AuthRequest, res) => {
    try {
      const orgs = await storage.getOrganizationsByUserId(req.userId!);
      res.json({ organizations: orgs.map(org => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
        type: org.type,
        ownerId: org.ownerId,
        createdAt: org.createdAt,
      }))});
    } catch (error) {
      console.error("Error fetching organizations:", error);
      res.status(500).json({ error: "Failed to fetch organizations" });
    }
  });

  app.get("/api/organizations/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const org = await storage.getOrganization(req.params.id);
      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }

      const member = await storage.getOrganizationMember(org.id, req.userId!);
      if (!member) {
        return res.status(403).json({ error: "Not a member of this organization" });
      }

      const members = await storage.getOrganizationMembers(org.id);

      res.json({
        organization: {
          id: org.id,
          name: org.name,
          slug: org.slug,
          type: org.type,
          ownerId: org.ownerId,
          settings: org.settings,
          createdAt: org.createdAt,
        },
        members: members.map(m => ({
          id: m.id,
          userId: m.userId,
          role: m.role,
          joinedAt: m.joinedAt,
          email: m.user.email,
          fullName: m.user.fullName,
        })),
      });
    } catch (error) {
      console.error("Error fetching organization:", error);
      res.status(500).json({ error: "Failed to fetch organization" });
    }
  });

  app.post("/api/organizations", requireAuth, async (req: AuthRequest, res) => {
    try {
      const data = createOrganizationSchema.parse(req.body);

      const existing = await storage.getOrganizationBySlug(data.slug);
      if (existing) {
        return res.status(400).json({ error: "Organization slug already taken" });
      }

      const org = await storage.createOrganization({
        name: data.name,
        slug: data.slug,
        type: "production",
        ownerId: req.userId!,
      });

      await storage.createOrganizationMember({
        organizationId: org.id,
        userId: req.userId!,
        role: "owner",
      });

      await createAuditLog(storage, {
        actorId: req.userId!,
        actorEmail: req.userEmail!,
        actorRole: req.userRole!,
        action: "ORGANIZATION_CREATED",
        resourceType: "organization",
        resourceId: org.id,
        result: "success",
        metadata: { name: data.name, slug: data.slug },
      });

      res.json({
        organization: {
          id: org.id,
          name: org.name,
          slug: org.slug,
          type: org.type,
          ownerId: org.ownerId,
          createdAt: org.createdAt,
        },
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      console.error("Error creating organization:", error);
      res.status(500).json({ error: "Failed to create organization" });
    }
  });

  app.patch("/api/organizations/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const org = await storage.getOrganization(req.params.id);
      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }

      const member = await storage.getOrganizationMember(org.id, req.userId!);
      if (!member || (member.role !== "owner" && member.role !== "admin")) {
        return res.status(403).json({ error: "Only org owners and admins can update the organization" });
      }

      const updates: Record<string, any> = {};
      if (req.body.name) updates.name = req.body.name;
      if (req.body.settings) updates.settings = req.body.settings;

      const updated = await storage.updateOrganization(org.id, updates);
      res.json({ organization: updated });
    } catch (error) {
      console.error("Error updating organization:", error);
      res.status(500).json({ error: "Failed to update organization" });
    }
  });

  app.post("/api/organizations/:id/members", requireAuth, async (req: AuthRequest, res) => {
    try {
      const org = await storage.getOrganization(req.params.id);
      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }

      const member = await storage.getOrganizationMember(org.id, req.userId!);
      if (!member || (member.role !== "owner" && member.role !== "admin")) {
        return res.status(403).json({ error: "Only org owners and admins can add members" });
      }

      const { email, role } = req.body;
      if (!email || !role) {
        return res.status(400).json({ error: "Email and role are required" });
      }

      const targetUser = await storage.getUserByEmail(email);
      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }

      const existingMember = await storage.getOrganizationMember(org.id, targetUser.id);
      if (existingMember) {
        return res.status(400).json({ error: "User is already a member of this organization" });
      }

      const newMember = await storage.createOrganizationMember({
        organizationId: org.id,
        userId: targetUser.id,
        role,
        invitedBy: req.userId!,
      });

      await createAuditLog(storage, {
        actorId: req.userId!,
        actorEmail: req.userEmail!,
        actorRole: req.userRole!,
        action: "ORGANIZATION_MEMBER_ADDED",
        resourceType: "organization",
        resourceId: org.id,
        targetUserId: targetUser.id,
        targetUserEmail: targetUser.email,
        result: "success",
        metadata: { role },
      });

      res.json({ member: newMember });
    } catch (error) {
      console.error("Error adding member:", error);
      res.status(500).json({ error: "Failed to add member" });
    }
  });

  app.delete("/api/organizations/:id/members/:userId", requireAuth, async (req: AuthRequest, res) => {
    try {
      const org = await storage.getOrganization(req.params.id);
      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }

      const member = await storage.getOrganizationMember(org.id, req.userId!);
      if (!member || (member.role !== "owner" && member.role !== "admin")) {
        return res.status(403).json({ error: "Only org owners and admins can remove members" });
      }

      if (req.params.userId === org.ownerId) {
        return res.status(400).json({ error: "Cannot remove the organization owner" });
      }

      const removed = await storage.removeOrganizationMember(org.id, req.params.userId);
      if (!removed) {
        return res.status(404).json({ error: "Member not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error removing member:", error);
      res.status(500).json({ error: "Failed to remove member" });
    }
  });

  app.get("/api/organizations/:id/members", requireAuth, async (req: AuthRequest, res) => {
    try {
      const org = await storage.getOrganization(req.params.id);
      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }

      const member = await storage.getOrganizationMember(org.id, req.userId!);
      if (!member) {
        return res.status(403).json({ error: "Not a member of this organization" });
      }

      const members = await storage.getOrganizationMembers(org.id);
      res.json({
        members: members.map(m => ({
          id: m.id,
          userId: m.userId,
          role: m.role,
          joinedAt: m.joinedAt,
          email: m.user.email,
          fullName: m.user.fullName,
        })),
      });
    } catch (error) {
      console.error("Error fetching members:", error);
      res.status(500).json({ error: "Failed to fetch members" });
    }
  });
}
