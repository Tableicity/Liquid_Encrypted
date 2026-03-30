import { randomBytes, createHash, createCipheriv, randomUUID } from "crypto";
import { storage } from "./storage";
import { proofService } from "./proof-service";
import { NOIR_ENABLED } from "./proof-config";

const SEED_DOCUMENTS = [
  { name: "Q4-2025-Financial-Report.pdf", size: 2_340_000 },
  { name: "Series-A-Term-Sheet.docx", size: 856_000 },
  { name: "Board-Resolution-March-2026.pdf", size: 1_120_000 },
];

const SEED_SCORES = [94, 87, 91];
const SEED_TTL_HOURS = 8760;
const FRAGMENT_COUNT = 8;

function generateSeedEncryptionKey(): string {
  return randomBytes(32).toString("hex");
}

function generateSeedFragment(docId: string, index: number): {
  documentId: string;
  fragmentIndex: number;
  encryptedData: string;
  iv: string;
  node: string;
  checksum: string;
} {
  const iv = randomBytes(16);
  const key = randomBytes(32);
  const cipher = createCipheriv("aes-256-cbc", key, iv);
  const sampleData = `SEED_FRAGMENT_${docId}_${index}_${randomBytes(64).toString("hex")}`;
  const encrypted = Buffer.concat([cipher.update(sampleData, "utf8"), cipher.final()]);
  const checksum = createHash("sha256").update(encrypted).digest("hex");
  const nodes = ["node-alpha", "node-beta", "node-gamma", "node-delta", "node-epsilon", "node-zeta", "node-eta", "node-theta"];

  return {
    documentId: docId,
    fragmentIndex: index,
    encryptedData: encrypted.toString("base64"),
    iv: iv.toString("hex"),
    node: nodes[index % nodes.length],
    checksum,
  };
}

async function seedUserSandbox(user: { id: string; email: string }) {
  const orgs = await storage.getOrganizationsByUserId(user.id);
  const sandbox = orgs.find(o => o.type === "sandbox");
  if (!sandbox) return;

  const existingOrgCommitments = await storage.getCommitmentsByOrg(sandbox.id);
  if (existingOrgCommitments.length > 0) return;

  const existingDocs = await storage.getDocumentsByUserId(user.id);
  let createdDocs: { id: string; name: string; encryptionKey: string }[] = [];

  const existingSeedDocs = existingDocs.filter(d => SEED_DOCUMENTS.some(sd => sd.name === d.name));

  if (existingSeedDocs.length >= SEED_DOCUMENTS.length) {
    createdDocs = existingSeedDocs.map(d => ({ id: d.id, name: d.name, encryptionKey: d.encryptionKey }));
  } else {
    for (const seedDoc of SEED_DOCUMENTS) {
      const existing = existingDocs.find(d => d.name === seedDoc.name);
      if (existing) {
        createdDocs.push({ id: existing.id, name: existing.name, encryptionKey: existing.encryptionKey });
        continue;
      }

      const encryptionKey = generateSeedEncryptionKey();
      const doc = await storage.createDocument({
        userId: user.id,
        organizationId: sandbox.id,
        name: seedDoc.name,
        size: seedDoc.size,
        fragmentCount: FRAGMENT_COUNT,
        encryptionKey,
      });

      for (let i = 0; i < FRAGMENT_COUNT; i++) {
        await storage.createFragment(generateSeedFragment(doc.id, i));
      }

      await storage.updateDocument(doc.id, { status: "liquified" });
      createdDocs.push({ id: doc.id, name: doc.name, encryptionKey });
    }
  }

  console.log(`[ZKP Seed] Seeding sandbox for ${user.email} (${sandbox.id})...`);

  const createdCommitments: string[] = [];

  for (let i = 0; i < createdDocs.length; i++) {
    const doc = createdDocs[i];
    const score = SEED_SCORES[i];

    const { commitmentHash, salt } = proofService.generateCommitment(doc.encryptionKey, score);

    const commitment = await storage.createCommitment({
      organizationId: sandbox.id,
      documentId: doc.id,
      userId: user.id,
      commitmentHash,
      salt,
      authenticityScore: score,
      metadata: { documentName: doc.name, seeded: true },
    });

    createdCommitments.push(commitment.id);
  }

  const commitmentId = createdCommitments[0];
  const commitment = await storage.getCommitment(commitmentId);

  if (commitment) {
    const proofRequest = await storage.createProofRequest({
      organizationId: sandbox.id,
      userId: user.id,
      commitmentId,
      status: "processing",
      threshold: 70,
    });

    const result = await proofService.generateProof(
      commitment.commitmentHash,
      commitment.authenticityScore,
      commitment.salt,
      70
    );

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + SEED_TTL_HOURS);

    await storage.createProofResult({
      proofRequestId: proofRequest.id,
      organizationId: sandbox.id,
      proofHex: result.proofHex,
      verificationKey: result.verificationKey,
      verified: result.verified,
      publicInputsHash: result.publicInputsHash,
      ttlHours: SEED_TTL_HOURS,
      expiresAt,
    });

    await storage.updateProofRequest(proofRequest.id, { status: "completed", completedAt: new Date() });

    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const usage = await storage.getOrCreateProofUsage(sandbox.id, periodStart, periodEnd);
    await storage.incrementProofUsage(usage.id, "proofsGenerated");
  }

  console.log(`[ZKP Seed] ${user.email}: ${createdDocs.length} docs, ${createdCommitments.length} commitments, 1 proof.`);
}

export async function seedSandboxProofs() {
  if (!NOIR_ENABLED) return;

  try {
    const users = await storage.getAllUsers();
    if (users.length === 0) return;

    for (const user of users) {
      await seedUserSandbox(user);
    }
  } catch (error) {
    console.error("[ZKP Seed] Error during sandbox seeding:", error);
  }
}
