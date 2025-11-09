import crypto from "crypto";
import type { IStorage } from "../storage";
import type { Request } from "express";

// Get audit log signing secret from environment - MANDATORY for security
const AUDIT_SECRET = process.env.AUDIT_LOG_SECRET || process.env.SESSION_SECRET;

if (!AUDIT_SECRET) {
  throw new Error(
    "CRITICAL SECURITY ERROR: Audit logging requires AUDIT_LOG_SECRET or SESSION_SECRET environment variable. " +
    "Audit logs cannot be tamper-proof without a secret key. " +
    "Please set AUDIT_LOG_SECRET or SESSION_SECRET before starting the application."
  );
}

export interface AuditLogData {
  // Actor (who did it) - can be auto-populated from req
  actorId?: string;
  actorEmail?: string;
  actorRole?: string;
  
  // Action (what they did)
  action: string;
  resourceType?: string;
  resourceId?: string;
  
  // Target (who/what was affected)
  targetUserId?: string;
  targetUserEmail?: string;
  
  // Context
  ipAddress?: string;
  userAgent?: string;
  
  // Details
  changes?: Record<string, any>;
  result: "success" | "failure" | "denied";
  metadata?: Record<string, any>;
}

// Generate tamper-proof HMAC signature using server-side secret
const generateSignature = (data: AuditLogData & { timestamp: Date }): string => {
  // Create canonical signed payload
  const signedPayload = JSON.stringify({
    timestamp: data.timestamp.toISOString(),
    actorId: data.actorId,
    actorEmail: data.actorEmail,
    actorRole: data.actorRole,
    action: data.action,
    resourceType: data.resourceType,
    resourceId: data.resourceId,
    targetUserId: data.targetUserId,
    targetUserEmail: data.targetUserEmail,
    result: data.result,
    changes: data.changes,
    metadata: data.metadata,
  });
  
  // Generate HMAC-SHA256 signature with server-side secret
  return crypto
    .createHmac("sha256", AUDIT_SECRET)
    .update(signedPayload)
    .digest("hex");
};

// Map new result enum to legacy status values for backward compatibility
const mapResultToLegacyStatus = (result: string, action: string): string => {
  // For backward compatibility with existing analytics, preserve legacy vocabulary
  if (result === "denied") {
    if (action.includes("QUOTA")) return "blocked";
    if (action.includes("CONCURRENT")) return "rolled_back";
    return "denied";
  }
  if (result === "failure") {
    if (action.includes("CONCURRENT")) return "rolled_back";
    return "failure";
  }
  return "success";
};

export const createAuditLog = async (
  storage: IStorage,
  data: AuditLogData
): Promise<void> => {
  const timestamp = new Date();
  const signature = generateSignature({ ...data, timestamp });

  await storage.createAuditLog({
    // New fields (comprehensive audit logging)
    actorId: data.actorId,
    actorEmail: data.actorEmail,
    actorRole: data.actorRole,
    action: data.action,
    resourceType: data.resourceType,
    resourceId: data.resourceId,
    targetUserId: data.targetUserId,
    targetUserEmail: data.targetUserEmail,
    ipAddress: data.ipAddress,
    userAgent: data.userAgent,
    changes: data.changes,
    result: data.result,
    metadata: data.metadata,
    signature,
    
    // Legacy fields (backward compatibility) - map to legacy vocabulary
    userId: data.actorId,
    status: mapResultToLegacyStatus(data.result, data.action),
    details: data.metadata || {},
  });
};

// Helper to auto-populate actor info from Express request
export const auditLogFromRequest = async (
  storage: IStorage,
  req: Partial<Request & { userId?: string; userEmail?: string; userRole?: string }>,
  data: Omit<AuditLogData, "actorId" | "actorEmail" | "actorRole" | "ipAddress" | "userAgent">
): Promise<void> => {
  return createAuditLog(storage, {
    ...data,
    actorId: req.userId,
    actorEmail: req.userEmail,
    actorRole: req.userRole,
    ipAddress: req.ip || undefined,
    userAgent: req.headers?.["user-agent"] || undefined,
  });
};

// Specific audit log helpers for common actions
export const auditLogin = async (
  storage: IStorage,
  userId: string,
  email: string,
  role: string,
  req: Partial<Request>
) => {
  return createAuditLog(storage, {
    actorId: userId,
    actorEmail: email,
    actorRole: role,
    action: "USER_LOGIN",
    result: "success",
    ipAddress: req.ip,
    userAgent: req.headers?.["user-agent"],
  });
};

export const auditLoginFailure = async (
  storage: IStorage,
  email: string,
  reason: string,
  req: Partial<Request>
) => {
  return createAuditLog(storage, {
    actorEmail: email,
    action: "LOGIN_FAILED",
    result: "failure",
    ipAddress: req.ip,
    userAgent: req.headers?.["user-agent"],
    metadata: { reason },
  });
};

export const auditDocumentUpload = async (
  storage: IStorage,
  userId: string,
  email: string,
  documentId: string,
  filename: string,
  size: number,
  req: Partial<Request>
) => {
  return createAuditLog(storage, {
    actorId: userId,
    actorEmail: email,
    action: "DOCUMENT_UPLOAD",
    resourceType: "document",
    resourceId: documentId,
    result: "success",
    ipAddress: req.ip,
    userAgent: req.headers?.["user-agent"],
    metadata: { filename, size, fragmentCount: 8 },
  });
};

export const auditDocumentDownload = async (
  storage: IStorage,
  userId: string,
  email: string,
  documentId: string,
  req: Partial<Request>
) => {
  return createAuditLog(storage, {
    actorId: userId,
    actorEmail: email,
    action: "DOCUMENT_DOWNLOAD",
    resourceType: "document",
    resourceId: documentId,
    result: "success",
    ipAddress: req.ip,
    userAgent: req.headers?.["user-agent"],
  });
};

export const auditDocumentDelete = async (
  storage: IStorage,
  userId: string,
  email: string,
  documentId: string,
  documentName: string,
  req: Partial<Request>
) => {
  return createAuditLog(storage, {
    actorId: userId,
    actorEmail: email,
    action: "DOCUMENT_DELETE",
    resourceType: "document",
    resourceId: documentId,
    result: "success",
    ipAddress: req.ip,
    userAgent: req.headers?.["user-agent"],
    metadata: { documentName },
    changes: {
      status: { from: "active", to: "deleted" },
    },
  });
};

export const auditRoleChange = async (
  storage: IStorage,
  adminId: string,
  adminEmail: string,
  adminRole: string,
  targetUserId: string,
  targetEmail: string,
  oldRole: string,
  newRole: string,
  reason: string | undefined,
  req: Partial<Request>
) => {
  return createAuditLog(storage, {
    actorId: adminId,
    actorEmail: adminEmail,
    actorRole: adminRole,
    action: "ADMIN_CHANGE_ROLE",
    resourceType: "user",
    resourceId: targetUserId,
    targetUserId,
    targetUserEmail: targetEmail,
    result: "success",
    ipAddress: req.ip,
    userAgent: req.headers?.["user-agent"],
    changes: {
      role: { from: oldRole, to: newRole },
    },
    metadata: { reason },
  });
};

export const auditUnauthorizedAccess = async (
  storage: IStorage,
  userId: string | undefined,
  email: string | undefined,
  role: string | undefined,
  requiredRoles: string[],
  req: Partial<Request>
) => {
  return createAuditLog(storage, {
    actorId: userId,
    actorEmail: email,
    actorRole: role,
    action: "UNAUTHORIZED_ACCESS_ATTEMPT",
    resourceType: "route",
    resourceId: req.path,
    result: "denied",
    ipAddress: req.ip,
    userAgent: req.headers?.["user-agent"],
    metadata: {
      method: req.method,
      path: req.path,
      userRole: role,
      requiredRoles,
    },
  });
};
