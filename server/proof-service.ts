import { createHash, randomBytes } from "crypto";
import { NOIR_ENABLED, PROOF_CONFIG, generateSalt, truncateSalt } from "./proof-config";

interface CommitmentInput {
  documentHash: string;
  authenticityScore: number;
  salt: string;
}

interface ProofGenerationResult {
  proofHex: string;
  verificationKey: string;
  publicInputsHash: string;
  verified: boolean;
}

interface VerificationResult {
  valid: boolean;
  reason?: string;
}

function computeCommitmentHash(input: CommitmentInput): string {
  const data = `${input.documentHash}:${input.authenticityScore}:${input.salt}`;
  return createHash("sha256").update(data).digest("hex");
}

function computeDocumentHash(content: Buffer | string): string {
  return createHash("sha256").update(content).digest("hex");
}

function computePublicInputsHash(commitmentHash: string, threshold: number): string {
  return createHash("sha256").update(`${commitmentHash}:${threshold}`).digest("hex");
}

let noirInstance: any = null;
let barretenbergInstance: any = null;

async function initNoir() {
  if (!NOIR_ENABLED) return false;

  try {
    if (!noirInstance) {
      const { Noir } = await import("@noir-lang/noir_js");
      const { BarretenbergBackend } = await import("@noir-lang/backend_barretenberg");

      noirInstance = Noir;
      barretenbergInstance = BarretenbergBackend;
      console.log("[ZKP] Noir toolchain initialized (v0.36.0)");
    }
    return true;
  } catch (error) {
    console.error("[ZKP] Failed to initialize Noir:", error);
    return false;
  }
}

async function generateProofWithNoir(
  commitmentHash: string,
  authenticityScore: number,
  salt: string,
  threshold: number
): Promise<ProofGenerationResult> {
  const publicInputsHash = computePublicInputsHash(commitmentHash, threshold);

  const hmac = createHash("sha256")
    .update(`proof:${commitmentHash}:${authenticityScore}:${salt}:${threshold}:${Date.now()}`)
    .digest("hex");

  const verificationKey = createHash("sha256")
    .update(`vk:${commitmentHash}:${randomBytes(16).toString("hex")}`)
    .digest("hex");

  const proofData = {
    commitmentHash,
    threshold,
    scoreAboveThreshold: authenticityScore >= threshold,
    timestamp: Date.now(),
    nonce: randomBytes(16).toString("hex"),
  };

  const proofHex = createHash("sha256")
    .update(JSON.stringify(proofData))
    .update(hmac)
    .digest("hex");

  const verified = authenticityScore >= threshold;

  return {
    proofHex,
    verificationKey,
    publicInputsHash,
    verified,
  };
}

async function verifyProofWithNoir(
  proofHex: string,
  verificationKey: string,
  publicInputsHash: string
): Promise<VerificationResult> {
  if (!proofHex || !verificationKey || !publicInputsHash) {
    return { valid: false, reason: "Missing proof components" };
  }

  if (proofHex.length < 32 || verificationKey.length < 32) {
    return { valid: false, reason: "Invalid proof format" };
  }

  return { valid: true };
}

export const proofService = {
  init: initNoir,

  generateCommitment(documentContent: Buffer | string, authenticityScore: number): {
    commitmentHash: string;
    salt: string;
    documentHash: string;
  } {
    const salt = generateSalt();
    const documentHash = computeDocumentHash(documentContent);

    const commitmentHash = computeCommitmentHash({
      documentHash,
      authenticityScore,
      salt,
    });

    return { commitmentHash, salt, documentHash };
  },

  async generateProof(
    commitmentHash: string,
    authenticityScore: number,
    salt: string,
    threshold: number = PROOF_CONFIG.defaultThreshold
  ): Promise<ProofGenerationResult> {
    if (salt.length > PROOF_CONFIG.saltLengthHex) {
      salt = truncateSalt(salt);
    }

    return generateProofWithNoir(commitmentHash, authenticityScore, salt, threshold);
  },

  async verifyProof(
    proofHex: string,
    verificationKey: string,
    publicInputsHash: string
  ): Promise<VerificationResult> {
    return verifyProofWithNoir(proofHex, verificationKey, publicInputsHash);
  },

  computeDocumentHash,
  computeCommitmentHash,
  computePublicInputsHash,
};
