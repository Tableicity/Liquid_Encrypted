import { storage } from "./storage";
import { proofService } from "./proof-service";
import { NOIR_ENABLED, PROOF_CONFIG } from "./proof-config";

export async function seedSandboxProofs() {
  if (!NOIR_ENABLED) return;

  try {
    const existingCommitments = await storage.getCommitmentsByOrg("__seeded__");
    if (existingCommitments.length > 0) return;

    const users = await storage.getAllUsers();
    if (users.length === 0) return;

    const firstUser = users[0];
    const orgs = await storage.getOrganizationsByUserId(firstUser.id);
    const sandbox = orgs.find(o => o.type === "sandbox");
    if (!sandbox) return;

    const existingOrgCommitments = await storage.getCommitmentsByOrg(sandbox.id);
    if (existingOrgCommitments.length > 0) {
      console.log("[ZKP Seed] Sandbox already has commitments, skipping seed.");
      return;
    }

    const documents = await storage.getDocumentsByUserId(firstUser.id);
    if (documents.length === 0) {
      console.log("[ZKP Seed] No documents found for seeding, skipping.");
      return;
    }

    const seedDocs = documents.slice(0, 4);
    const seedScores = [92, 85, 78, 95];
    const createdCommitments: string[] = [];

    console.log(`[ZKP Seed] Seeding ${seedDocs.length} commitments for sandbox org ${sandbox.id}...`);

    for (let i = 0; i < seedDocs.length; i++) {
      const doc = seedDocs[i];
      const score = seedScores[i] || 85;

      const { commitmentHash, salt } = proofService.generateCommitment(
        doc.encryptionKey || doc.id,
        score
      );

      const commitment = await storage.createCommitment({
        organizationId: sandbox.id,
        documentId: doc.id,
        userId: firstUser.id,
        commitmentHash,
        salt,
        authenticityScore: score,
        metadata: { documentName: doc.name, seeded: true },
      });

      createdCommitments.push(commitment.id);
      console.log(`[ZKP Seed] Created commitment ${i + 1}/${seedDocs.length}: ${commitment.id}`);
    }

    if (createdCommitments.length > 0) {
      const commitmentId = createdCommitments[0];
      const commitment = await storage.getCommitment(commitmentId);

      if (commitment) {
        const proofRequest = await storage.createProofRequest({
          organizationId: sandbox.id,
          userId: firstUser.id,
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

        const SEED_TTL_HOURS = 8760;
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

        await storage.updateProofRequest(proofRequest.id, {
          status: "completed",
          completedAt: new Date(),
        });

        const now = new Date();
        const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const usage = await storage.getOrCreateProofUsage(sandbox.id, periodStart, periodEnd);
        await storage.incrementProofUsage(usage.id, "proofsGenerated");

        console.log(`[ZKP Seed] Created demo proof (verified: ${result.verified}) for commitment ${commitmentId}`);
      }
    }

    console.log(`[ZKP Seed] Sandbox seeding complete: ${createdCommitments.length} commitments, 1 proof.`);
  } catch (error) {
    console.error("[ZKP Seed] Error during sandbox seeding:", error);
  }
}
