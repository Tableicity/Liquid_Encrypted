import type { Response, NextFunction } from 'express';
import { storage } from '../storage';
import { createAuditLog } from '../utils/auditLog';
import type { AuthRequest } from '../middleware';

/**
 * Middleware: Check storage quota before allowing file uploads
 * Implements three-tier enforcement:
 * 1. Under quota: Allow upload (normal operation)
 * 2. Over quota + within grace period: Allow upload with warning
 * 3. Over quota + grace period expired: Block upload (hard limit)
 */
export async function checkStorageQuota(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const userId = req.userId;
  const fileSize = parseInt(req.headers['content-length'] || '0', 10);

  // Validate user authentication
  if (!userId) {
    return res.status(401).json({ 
      error: 'Authentication required' 
    });
  }

  // Validate content-length header
  if (!fileSize || fileSize <= 0) {
    return res.status(400).json({ 
      error: 'Invalid file size. Content-Length header required.' 
    });
  }

  try {
    // STEP 1: Get subscription and plan to determine quota
    const subscription = await storage.getSubscriptionByUserId(userId);
    if (!subscription || subscription.status !== 'active') {
      return res.status(403).json({ 
        error: "Active subscription required",
        message: "Please subscribe to a plan to upload documents"
      });
    }

    const plan = await storage.getSubscriptionPlan(subscription.planId);
    if (!plan) {
      return res.status(500).json({ error: "Subscription plan not found" });
    }

    // Calculate total quota: base storage + addon storage
    const quotaGb = plan.storageBaseGb + (subscription.storageAddonGb || 0);
    const quotaBytes = quotaGb * 1024 * 1024 * 1024;

    // STEP 2: Get current storage usage (byte-precise)
    let usedBytes: number;
    const storageUsage = await storage.getStorageUsageByUserId(userId);
    
    if (!storageUsage) {
      // Fallback: Calculate usage directly from documents for quota check
      // Note: This is a read-only check - storage_usage will be initialized
      // atomically by the upload route's atomicIncrementStorageUsage call
      const docs = await storage.getDocumentsByUserId(userId);
      usedBytes = docs.reduce((sum, doc) => sum + doc.size, 0);
    } else {
      // Use byte-precise field (no rounding errors!)
      usedBytes = storageUsage.usedBytes || 0;
    }

    const projectedUsage = usedBytes + fileSize;

    // STEP 3: Check if upload would exceed quota
    if (projectedUsage <= quotaBytes) {
      // Under quota - proceed normally
      return next();
    }

    // STEP 4: Quota exceeded - check grace period status
    const gracePeriod = await storage.getActiveGracePeriodByUserId(userId);

    if (gracePeriod) {
      // Active grace period exists - check if expired
      const now = new Date();
      const graceEnd = new Date(gracePeriod.gracePeriodEnd);

      if (now > graceEnd) {
        // HARD BLOCK: Grace period expired
        await createAuditLog(storage, {
          actorId: userId,
          actorEmail: req.userEmail || undefined,
          actorRole: req.userRole || undefined,
          action: 'UPLOAD_BLOCKED_QUOTA_EXCEEDED',
          resourceType: 'document',
          result: 'denied',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          metadata: {
            current_usage_bytes: usedBytes,
            quota_bytes: quotaBytes,
            attempted_file_size: fileSize,
            projected_usage_bytes: projectedUsage,
            overage_bytes: projectedUsage - quotaBytes,
            grace_period_expired: true,
            grace_period_end: graceEnd.toISOString()
          }
        });

        return res.status(403).json({
          error: 'Storage quota exceeded',
          message: 'Your grace period has expired. Please upgrade your plan or delete files to continue uploading.',
          current_usage_gb: (usedBytes / (1024**3)).toFixed(2),
          quota_gb: quotaGb.toFixed(2),
          overage_gb: ((projectedUsage - quotaBytes) / (1024**3)).toFixed(2),
          grace_period_expired: true,
          grace_period_end: graceEnd.toISOString(),
          actions: {
            upgrade_url: '/subscription/upgrade',
            manage_files_url: '/documents'
          }
        });
      } else {
        // SOFT LIMIT: Within grace period - allow with warning
        const daysRemaining = Math.ceil(
          (graceEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Attach grace period info to request for upload handler to use
        (req as any).gracePeriodWarning = {
          within_grace_period: true,
          grace_period_end: graceEnd.toISOString(),
          days_remaining: daysRemaining,
          current_usage_gb: (usedBytes / (1024**3)).toFixed(2),
          quota_gb: quotaGb.toFixed(2),
          overage_gb: ((projectedUsage - quotaBytes) / (1024**3)).toFixed(2)
        };

        await createAuditLog(storage, {
          actorId: userId,
          actorEmail: req.userEmail || undefined,
          actorRole: req.userRole || undefined,
          action: 'UPLOAD_ALLOWED_GRACE_PERIOD',
          resourceType: 'document',
          result: 'success',
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          metadata: {
            current_usage_bytes: usedBytes,
            quota_bytes: quotaBytes,
            file_size: fileSize,
            projected_usage_bytes: projectedUsage,
            overage_bytes: projectedUsage - quotaBytes,
            within_grace_period: true,
            days_remaining: daysRemaining
          }
        });

        return next();
      }
    } else {
      // FIRST TIME exceeding quota - create grace period
      const newGracePeriod = await storage.createGracePeriod({
        userId: userId,
        quotaExceededAt: new Date(),
        warningEmailsSent: 0
      });

      await createAuditLog(storage, {
        actorId: userId,
        actorEmail: req.userEmail || undefined,
        actorRole: req.userRole || undefined,
        action: 'QUOTA_EXCEEDED_GRACE_PERIOD_STARTED',
        resourceType: 'storage',
        result: 'success',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: {
          current_usage_bytes: usedBytes,
          quota_bytes: quotaBytes,
          file_size_bytes: fileSize,
          projected_usage_bytes: projectedUsage,
          overage_bytes: projectedUsage - quotaBytes,
          grace_period_end: newGracePeriod.gracePeriodEnd,
          grace_period_days: 7
        }
      });

      // Attach grace period info for response
      (req as any).gracePeriodWarning = {
        within_grace_period: true,
        grace_period_end: newGracePeriod.gracePeriodEnd.toISOString(),
        days_remaining: 7,
        current_usage_gb: (usedBytes / (1024**3)).toFixed(2),
        quota_gb: quotaGb.toFixed(2),
        overage_gb: ((projectedUsage - quotaBytes) / (1024**3)).toFixed(2),
        first_time: true
      };

      return next();
    }

  } catch (error: any) {
    console.error('[Quota Check] Error:', error);
    
    await createAuditLog(storage, {
      actorId: userId!,
      actorEmail: req.userEmail || undefined,
      actorRole: req.userRole || undefined,
      action: 'QUOTA_CHECK_ERROR',
      resourceType: 'storage',
      result: 'failure',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: {
        error_message: error.message,
        file_size: fileSize
      }
    });

    return res.status(500).json({ 
      error: 'Failed to check storage quota. Please try again.' 
    });
  }
}

/**
 * Helper: Check and resolve grace period after file deletion
 * Call this after successful file deletion to auto-resolve grace periods
 */
export async function checkGracePeriodResolution(userId: string) {
  try {
    const storageUsage = await storage.getStorageUsageByUserId(userId);
    const gracePeriod = await storage.getActiveGracePeriodByUserId(userId);

    if (!storageUsage || !gracePeriod) {
      return false;
    }

    // Get subscription to calculate quota
    const subscription = await storage.getSubscriptionByUserId(userId);
    if (!subscription) {
      return false;
    }

    const plan = await storage.getSubscriptionPlan(subscription.planId);
    if (!plan) {
      return false;
    }

    const quotaGb = plan.storageBaseGb + (subscription.storageAddonGb || 0);
    const quotaBytes = quotaGb * 1024 * 1024 * 1024;
    // Use byte-precise field (no rounding errors!)
    const usedBytes = storageUsage.usedBytes || 0;

    // If user is now under quota and has active grace period, resolve it
    if (usedBytes < quotaBytes) {
      await storage.resolveGracePeriod(userId);
      
      await createAuditLog(storage, {
        actorId: userId,
        actorEmail: undefined,
        actorRole: undefined,
        action: 'GRACE_PERIOD_AUTO_RESOLVED',
        resourceType: 'storage',
        result: 'success',
        ipAddress: undefined,
        userAgent: undefined,
        metadata: {
          grace_period_id: gracePeriod.id,
          current_usage_bytes: usedBytes,
          quota_bytes: quotaBytes,
          resolution_reason: 'user_deleted_files'
        }
      });

      return true;
    }

    return false;
  } catch (error) {
    console.error('[Grace Period Resolution] Error:', error);
    return false;
  }
}
