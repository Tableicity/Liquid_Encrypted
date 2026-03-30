import type { Response, NextFunction } from "express";
import type { AuthRequest } from "./middleware";
import { storage } from "./storage";
import { PROOF_CONFIG } from "./proof-config";

type TierName = "personal" | "business" | "enterprise";

function planTypeToTier(planType: string): TierName {
  if (planType === "enterprise") return "enterprise";
  if (planType === "business") return "business";
  return "personal";
}

export async function requireProofAccess(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (PROOF_CONFIG.betaMode) {
      return next();
    }

    const userId = req.userId;
    if (!userId || !req.organizationId) {
      return res.status(401).json({ error: "Authentication and organization context required" });
    }

    const subscription = await storage.getSubscriptionByUserId(userId);
    if (!subscription || subscription.status !== "active") {
      return res.status(403).json({
        error: "Active subscription required for proof generation",
        code: "SUBSCRIPTION_REQUIRED",
      });
    }

    const plan = await storage.getSubscriptionPlan(subscription.planId);
    if (!plan) {
      return res.status(403).json({
        error: "Subscription plan not found",
        code: "PLAN_NOT_FOUND",
      });
    }

    const tier = planTypeToTier(plan.planType);
    const tierConfig = PROOF_CONFIG.tiers[tier];

    if (!tierConfig.canGenerate) {
      return res.status(403).json({
        error: "Your plan does not include proof generation",
        code: "TIER_NO_ACCESS",
      });
    }

    if (tierConfig.proofsPerMonth !== -1) {
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const usage = await storage.getOrCreateProofUsage(req.organizationId, periodStart, periodEnd);

      if (usage.proofsGenerated >= tierConfig.proofsPerMonth) {
        return res.status(429).json({
          error: `Monthly proof limit reached (${tierConfig.proofsPerMonth} per month for ${plan.name})`,
          code: "TIER_LIMIT_REACHED",
          limit: tierConfig.proofsPerMonth,
          used: usage.proofsGenerated,
        });
      }
    }

    (req as any).proofTier = tier;
    (req as any).proofTierConfig = tierConfig;
    next();
  } catch (error) {
    console.error("[ZKP Middleware] Error checking proof access:", error);
    res.status(500).json({ error: "Failed to verify proof access" });
  }
}

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function publicVerifyRateLimit(req: any, res: Response, next: NextFunction) {
  const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
  const key = `public-verify:${ip}`;
  const now = Date.now();

  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + PROOF_CONFIG.publicVerifyWindowMs });
    return next();
  }

  if (entry.count >= PROOF_CONFIG.publicVerifyRateLimit) {
    const retryAfterMs = entry.resetAt - now;
    res.set("Retry-After", String(Math.ceil(retryAfterMs / 1000)));
    return res.status(429).json({
      error: "Rate limit exceeded. Please try again later.",
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
    });
  }

  entry.count++;
  next();
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);
