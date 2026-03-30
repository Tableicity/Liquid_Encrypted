import { randomBytes } from "crypto";

export const NOIR_ENABLED = process.env.NOIR_ENABLED === "true";

export const PROOF_CONFIG = {
  defaultTtlHours: 72,
  maxThreshold: 100,
  minThreshold: 1,
  defaultThreshold: 70,
  saltLengthBytes: 31,
  saltLengthHex: 62,
  publicVerifyRateLimit: 10,
  publicVerifyWindowMs: 60 * 1000,
  betaMode: process.env.PROOF_BETA_MODE !== "false",

  tiers: {
    personal: {
      proofsPerMonth: 10,
      canVerify: true,
      canGenerate: true,
    },
    business: {
      proofsPerMonth: 100,
      canVerify: true,
      canGenerate: true,
    },
    enterprise: {
      proofsPerMonth: -1,
      canVerify: true,
      canGenerate: true,
    },
  },
};

export function truncateSalt(salt: string): string {
  return salt.slice(0, PROOF_CONFIG.saltLengthHex);
}

export function generateSalt(): string {
  const rawSalt = randomBytes(PROOF_CONFIG.saltLengthBytes).toString("hex");
  return truncateSalt(rawSalt);
}
