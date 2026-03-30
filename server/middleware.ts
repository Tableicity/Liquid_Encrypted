import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { IStorage, storage } from "./storage";
import type { Document } from "@shared/schema";
import { createAuditLog } from "./utils/auditLog";

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || "change-me-in-production";

// Extended Request type with user information from JWT
export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
  userRole?: string;
  userPermissions?: Record<string, any>;
  organizationId?: string;
}

/**
 * Basic authentication middleware - verifies JWT token
 * Extracts userId, email, role, and permissions from token
 * 
 * SECURITY NOTE: Permissions are embedded in JWT and cached for token lifetime (30 days).
 * Permission revocations won't take effect until token expires. 
 * TODO: Implement token refresh/invalidation strategy or check permissions against database
 * for critical operations to ensure immediate revocation.
 */
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { 
      userId: string; 
      email: string;
      role?: string;
      permissions?: Record<string, any>;
      organizationId?: string;
    };
    
    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    // Normalize legacy "user" role to "customer" for backward compatibility
    req.userRole = (decoded.role === "user" ? "customer" : decoded.role) || "customer";
    req.userPermissions = decoded.permissions || {};

    // Organization context: prefer header, fall back to JWT
    const headerOrgId = req.headers["x-organization-id"] as string | undefined;
    req.organizationId = headerOrgId || decoded.organizationId || undefined;
    
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

/**
 * Role-based access control middleware
 * Checks if user's role is in the allowed roles array
 * Logs unauthorized access attempts for security monitoring
 * 
 * @param allowedRoles - Array of role strings that can access this route
 * @param storage - Optional storage instance for audit logging
 */
export function requireRole(allowedRoles: string[], storage?: IStorage) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    // Ensure user is authenticated first
    if (!req.userId || !req.userRole) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Check if user's role is in allowed roles
    if (!allowedRoles.includes(req.userRole)) {
      // Log unauthorized access attempt with comprehensive audit logging
      if (storage) {
        try {
          await createAuditLog(storage, {
            actorId: req.userId,
            actorEmail: req.userEmail,
            actorRole: req.userRole,
            action: "UNAUTHORIZED_ACCESS_ATTEMPT",
            resourceType: "route",
            resourceId: req.path,
            result: "denied",
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
            metadata: {
              requiredRoles: allowedRoles,
              method: req.method,
              path: req.path,
            }
          });
        } catch (error) {
          console.error("Failed to log unauthorized access attempt:", error);
        }
      }

      return res.status(403).json({ 
        error: "Access denied", 
        message: `This route requires one of the following roles: ${allowedRoles.join(", ")}`,
        userRole: req.userRole 
      });
    }

    next();
  };
}

/**
 * Permission-based access control middleware
 * Checks if user has a specific permission in their permissions JSONB
 * 
 * @param permission - Permission string to check (e.g., "users.create", "billing.read")
 * @param storage - Optional storage instance for audit logging
 */
export function hasPermission(permission: string, storage?: IStorage) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    // Ensure user is authenticated first
    if (!req.userId || !req.userPermissions) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Check if user has the specific permission
    // Permissions can be stored as { "permission.name": true } or nested objects
    const hasAccess = checkPermission(req.userPermissions, permission);

    if (!hasAccess) {
      // Log unauthorized permission access attempt with comprehensive audit logging
      if (storage) {
        try {
          await createAuditLog(storage, {
            actorId: req.userId,
            actorEmail: req.userEmail,
            actorRole: req.userRole,
            action: "PERMISSION_DENIED",
            resourceType: "permission",
            resourceId: permission,
            result: "denied",
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
            metadata: {
              requiredPermission: permission,
              userPermissions: req.userPermissions,
              method: req.method,
              path: req.path,
            }
          });
        } catch (error) {
          console.error("Failed to log permission denied attempt:", error);
        }
      }

      return res.status(403).json({ 
        error: "Permission denied", 
        message: `This action requires the following permission: ${permission}` 
      });
    }

    next();
  };
}

/**
 * Helper function to check if a permission exists in the permissions object
 * Supports both flat keys ("users.create") and nested objects ({ users: { create: true } })
 */
function checkPermission(permissions: Record<string, any>, permission: string): boolean {
  // Check flat key first
  if (permissions[permission] === true) {
    return true;
  }

  // Check nested object (e.g., permission = "users.create" -> permissions.users.create)
  const parts = permission.split(".");
  let current: any = permissions;
  
  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = current[part];
    } else {
      return false;
    }
  }

  return current === true;
}

/**
 * Document ownership access control helper
 * Verifies that a user can access a specific document
 * 
 * - Privileged roles (support, super_admin, owner) can access any document
 * - Regular customers can only access their own documents
 * - Logs unauthorized attempts for security monitoring
 * 
 * @param req - Express request with user information from requireAuth
 * @param document - Document to check access for
 * @param storage - Storage instance for audit logging
 * @returns true if access is allowed, sends 403 response and returns false otherwise
 */
export async function assertDocumentAccess(
  req: AuthRequest, 
  document: Document, 
  storage?: IStorage
): Promise<boolean> {
  const privilegedRoles = ["support", "super_admin", "owner"];
  
  // Privileged roles can access any document
  if (req.userRole && privilegedRoles.includes(req.userRole)) {
    return true;
  }
  
  // Regular users can only access their own documents
  if (document.userId !== req.userId) {
    // Log horizontal privilege escalation attempt with comprehensive audit logging
    if (storage) {
      try {
        await createAuditLog(storage, {
          actorId: req.userId,
          actorEmail: req.userEmail,
          actorRole: req.userRole,
          action: "DOCUMENT_ACCESS_DENIED",
          resourceType: "document",
          resourceId: document.id,
          targetUserId: document.userId || undefined,
          result: "denied",
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
          metadata: {
            reason: "ownership_mismatch",
            documentName: document.name,
            method: req.method,
            path: req.path,
          }
        });
      } catch (error) {
        console.error("Failed to log document access denial:", error);
      }
    }
    
    return false;
  }
  
  return true;
}

export function requireOrgContext(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.organizationId) {
    return res.status(400).json({ error: "Organization context required. Set X-Organization-Id header." });
  }

  storage.getOrganizationMember(req.organizationId, req.userId!).then(member => {
    if (!member) {
      return res.status(403).json({ error: "Not a member of this organization" });
    }
    next();
  }).catch(error => {
    console.error("Error checking org membership:", error);
    res.status(500).json({ error: "Failed to verify organization membership" });
  });
}

export function requireNonSandbox(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.organizationId) {
    return res.status(400).json({ error: "Organization context required." });
  }
  storage.getOrganization(req.organizationId).then(org => {
    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
    }
    if (org.type === "sandbox") {
      return res.status(403).json({ error: "This feature is not available in sandbox organizations. Create a live organization to access it." });
    }
    next();
  }).catch(error => {
    console.error("Error checking org type:", error);
    res.status(500).json({ error: "Failed to verify organization type" });
  });
}
