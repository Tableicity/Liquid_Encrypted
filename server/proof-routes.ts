import type { Express } from "express";
import { storage } from "./storage";
import { requireAuth, requireOrgContext, type AuthRequest } from "./middleware";
import { proofService } from "./proof-service";
import { NOIR_ENABLED, PROOF_CONFIG } from "./proof-config";
import { createAuditLog } from "./utils/auditLog";

export function registerProofRoutes(app: Express) {
  if (!NOIR_ENABLED) {
    console.log("[ZKP Routes] NOIR_ENABLED is false — proof routes disabled");
    return;
  }

  console.log("[ZKP Routes] Registering proof endpoints");

  app.post("/api/proofs/commitments", requireAuth, requireOrgContext, async (req: AuthRequest, res) => {
    try {
      const { documentId, authenticityScore } = req.body;
      if (!documentId || authenticityScore === undefined) {
        return res.status(400).json({ error: "documentId and authenticityScore are required" });
      }

      if (authenticityScore < 0 || authenticityScore > 100) {
        return res.status(400).json({ error: "authenticityScore must be between 0 and 100" });
      }

      const document = await storage.getDocument(documentId);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      const { commitmentHash, salt } = proofService.generateCommitment(
        document.encryptionKey || documentId,
        authenticityScore
      );

      const commitment = await storage.createCommitment({
        organizationId: req.organizationId!,
        documentId,
        userId: req.userId!,
        commitmentHash,
        salt,
        authenticityScore,
        metadata: { documentName: document.name },
      });

      await createAuditLog(storage, {
        actorId: req.userId!,
        actorEmail: req.userEmail!,
        actorRole: req.userRole!,
        action: "ZKP_COMMITMENT_CREATED",
        resourceType: "commitment",
        resourceId: commitment.id,
        result: "success",
        metadata: { documentId, authenticityScore },
      });

      res.json({
        commitment: {
          id: commitment.id,
          documentId: commitment.documentId,
          commitmentHash: commitment.commitmentHash,
          authenticityScore: commitment.authenticityScore,
          createdAt: commitment.createdAt,
        },
      });
    } catch (error) {
      console.error("[ZKP] Error creating commitment:", error);
      res.status(500).json({ error: "Failed to create commitment" });
    }
  });

  app.get("/api/proofs/commitments", requireAuth, requireOrgContext, async (req: AuthRequest, res) => {
    try {
      const commitments = await storage.getCommitmentsByOrg(req.organizationId!);
      res.json({
        commitments: commitments.map(c => ({
          id: c.id,
          documentId: c.documentId,
          commitmentHash: c.commitmentHash,
          authenticityScore: c.authenticityScore,
          createdAt: c.createdAt,
          expiresAt: c.expiresAt,
        })),
      });
    } catch (error) {
      console.error("[ZKP] Error fetching commitments:", error);
      res.status(500).json({ error: "Failed to fetch commitments" });
    }
  });

  app.post("/api/proofs/generate", requireAuth, requireOrgContext, async (req: AuthRequest, res) => {
    try {
      const { commitmentId, threshold } = req.body;
      if (!commitmentId) {
        return res.status(400).json({ error: "commitmentId is required" });
      }

      const effectiveThreshold = threshold || PROOF_CONFIG.defaultThreshold;
      if (effectiveThreshold < PROOF_CONFIG.minThreshold || effectiveThreshold > PROOF_CONFIG.maxThreshold) {
        return res.status(400).json({ error: `Threshold must be between ${PROOF_CONFIG.minThreshold} and ${PROOF_CONFIG.maxThreshold}` });
      }

      const commitment = await storage.getCommitment(commitmentId);
      if (!commitment) {
        return res.status(404).json({ error: "Commitment not found" });
      }
      if (commitment.organizationId !== req.organizationId) {
        return res.status(403).json({ error: "Commitment does not belong to this organization" });
      }

      const proofRequest = await storage.createProofRequest({
        organizationId: req.organizationId!,
        userId: req.userId!,
        commitmentId,
        status: "processing",
        threshold: effectiveThreshold,
      });

      try {
        const result = await proofService.generateProof(
          commitment.commitmentHash,
          commitment.authenticityScore,
          commitment.salt,
          effectiveThreshold
        );

        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + PROOF_CONFIG.defaultTtlHours);

        const proofResult = await storage.createProofResult({
          proofRequestId: proofRequest.id,
          organizationId: req.organizationId!,
          proofHex: result.proofHex,
          verificationKey: result.verificationKey,
          verified: result.verified,
          publicInputsHash: result.publicInputsHash,
          ttlHours: PROOF_CONFIG.defaultTtlHours,
          expiresAt,
        });

        await storage.updateProofRequest(proofRequest.id, {
          status: "completed",
          completedAt: new Date(),
        });

        const now = new Date();
        const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const usage = await storage.getOrCreateProofUsage(req.organizationId!, periodStart, periodEnd);
        await storage.incrementProofUsage(usage.id, "proofsGenerated");

        await createAuditLog(storage, {
          actorId: req.userId!,
          actorEmail: req.userEmail!,
          actorRole: req.userRole!,
          action: "ZKP_PROOF_GENERATED",
          resourceType: "proof",
          resourceId: proofResult.id,
          result: "success",
          metadata: { commitmentId, threshold: effectiveThreshold, verified: result.verified },
        });

        res.json({
          proofRequest: {
            id: proofRequest.id,
            status: "completed",
            commitmentId,
            threshold: effectiveThreshold,
          },
          proof: {
            id: proofResult.id,
            verified: proofResult.verified,
            publicInputsHash: proofResult.publicInputsHash,
            ttlHours: proofResult.ttlHours,
            expiresAt: proofResult.expiresAt,
            createdAt: proofResult.createdAt,
          },
        });
      } catch (proofError: any) {
        await storage.updateProofRequest(proofRequest.id, {
          status: "failed",
          completedAt: new Date(),
          errorMessage: "Proof generation failed",
        });
        throw proofError;
      }
    } catch (error) {
      console.error("[ZKP] Error generating proof:", error);
      res.status(500).json({ error: "Failed to generate proof" });
    }
  });

  app.post("/api/proofs/verify", requireAuth, requireOrgContext, async (req: AuthRequest, res) => {
    try {
      const { proofId } = req.body;
      if (!proofId) {
        return res.status(400).json({ error: "proofId is required" });
      }

      const proof = await storage.getProofResult(proofId);
      if (!proof) {
        return res.status(404).json({ error: "Proof not found" });
      }
      if (proof.organizationId !== req.organizationId) {
        return res.status(403).json({ error: "Proof does not belong to this organization" });
      }

      if (new Date() > proof.expiresAt) {
        return res.json({ valid: false, reason: "Proof has expired", expired: true });
      }

      const verification = await proofService.verifyProof(
        proof.proofHex,
        proof.verificationKey,
        proof.publicInputsHash || ""
      );

      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const usage = await storage.getOrCreateProofUsage(req.organizationId!, periodStart, periodEnd);
      await storage.incrementProofUsage(usage.id, "proofsVerified");

      res.json({
        valid: verification.valid,
        reason: verification.reason,
        proofId: proof.id,
        expiresAt: proof.expiresAt,
      });
    } catch (error) {
      console.error("[ZKP] Error verifying proof:", error);
      res.status(500).json({ error: "Failed to verify proof" });
    }
  });

  app.get("/api/proofs/:id", requireAuth, requireOrgContext, async (req: AuthRequest, res) => {
    try {
      const proof = await storage.getProofResult(req.params.id);
      if (!proof) {
        return res.status(404).json({ error: "Proof not found" });
      }
      if (proof.organizationId !== req.organizationId) {
        return res.status(403).json({ error: "Proof does not belong to this organization" });
      }

      const request = await storage.getProofRequest(proof.proofRequestId);

      res.json({
        proof: {
          id: proof.id,
          verified: proof.verified,
          publicInputsHash: proof.publicInputsHash,
          ttlHours: proof.ttlHours,
          expiresAt: proof.expiresAt,
          createdAt: proof.createdAt,
          expired: new Date() > proof.expiresAt,
        },
        request: request ? {
          id: request.id,
          commitmentId: request.commitmentId,
          threshold: request.threshold,
          status: request.status,
          createdAt: request.createdAt,
        } : null,
      });
    } catch (error) {
      console.error("[ZKP] Error fetching proof:", error);
      res.status(500).json({ error: "Failed to fetch proof" });
    }
  });

  app.get("/api/proofs", requireAuth, requireOrgContext, async (req: AuthRequest, res) => {
    try {
      const results = await storage.getProofResultsByOrg(req.organizationId!);
      res.json({
        proofs: results.map(p => ({
          id: p.id,
          verified: p.verified,
          publicInputsHash: p.publicInputsHash,
          ttlHours: p.ttlHours,
          expiresAt: p.expiresAt,
          createdAt: p.createdAt,
          expired: new Date() > p.expiresAt,
        })),
      });
    } catch (error) {
      console.error("[ZKP] Error fetching proofs:", error);
      res.status(500).json({ error: "Failed to fetch proofs" });
    }
  });

  app.get("/api/proofs/usage/current", requireAuth, requireOrgContext, async (req: AuthRequest, res) => {
    try {
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const usage = await storage.getOrCreateProofUsage(req.organizationId!, periodStart, periodEnd);

      res.json({
        usage: {
          proofsGenerated: usage.proofsGenerated,
          proofsVerified: usage.proofsVerified,
          billingPeriodStart: usage.billingPeriodStart,
          billingPeriodEnd: usage.billingPeriodEnd,
        },
      });
    } catch (error) {
      console.error("[ZKP] Error fetching usage:", error);
      res.status(500).json({ error: "Failed to fetch proof usage" });
    }
  });

  app.post("/api/proofs/verify/public", async (req, res) => {
    try {
      const { proofId } = req.body;
      if (!proofId) {
        return res.status(400).json({ error: "proofId is required" });
      }

      const proof = await storage.getProofResult(proofId);
      if (!proof) {
        return res.json({ status: "not_found" });
      }

      if (new Date() > proof.expiresAt) {
        return res.json({ status: "expired" });
      }

      const verification = await proofService.verifyProof(
        proof.proofHex,
        proof.verificationKey,
        proof.publicInputsHash || ""
      );

      res.json({
        status: verification.valid ? "valid" : "invalid",
      });
    } catch (error) {
      console.error("[ZKP] Error in public verify:", error);
      res.status(500).json({ error: "Verification failed" });
    }
  });
}
