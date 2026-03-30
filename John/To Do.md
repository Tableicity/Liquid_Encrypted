# To Do: SNARK-to-STARK Quantum Resistance Upgrade

## Priority: Future Phase (At Scale)

---

## What

Upgrade Liquid Encrypt's Zero Knowledge Proof layer from zk-SNARKs (currently Noir/Barretenberg on BN254 elliptic curves) to zk-STARKs (hash-based, quantum-resistant proofs). This ensures the platform's privacy guarantees remain intact even against future quantum computing threats.

Today, the ZKP system generates proofs that a document's authenticity score meets a threshold without revealing the score. The underlying math relies on elliptic curve cryptography (BN254), which a sufficiently powerful quantum computer could theoretically break using Shor's algorithm. The STARK upgrade replaces that cryptographic foundation with hash-based primitives that are immune to quantum attacks.

---

## Where

### Files and Systems Affected

**Backend proof engine (server-side):**
- `server/proof-service.ts` — Core proof generation and verification logic. Currently imports `@noir-lang/noir_js` and `@noir-lang/backend_barretenberg`. These would be replaced with a STARK-compatible proving system.
- `server/proof-config.ts` — Proof configuration (TTL, thresholds, tier limits). Proof size limits and verification timeouts will need adjustment since STARK proofs are significantly larger (kilobytes vs hundreds of bytes for SNARKs).
- `server/proof-routes.ts` — API endpoints for generate/verify. The request/response payloads will grow due to larger proof sizes.
- `server/proof-middleware.ts` — Rate limiting and access control. May need tuning for longer verification times.

**Database (shared):**
- `shared/schema.ts` — The `proof_results` table stores proof data. The `proofHex` column will need to accommodate larger STARK proofs (potentially 10-100x larger than current SNARK proofs).
- Migration consideration: Existing SNARK proofs in the database remain valid historical records but cannot be re-verified under the new system. A `proofVersion` or `proofType` field should be added to distinguish SNARK vs STARK proofs.

**Frontend (minimal impact):**
- `client/src/pages/PrivacyVault.tsx` — Proof generation UI. The Security Ritual progress animation may need longer timeouts since STARK proof generation takes more time.
- `client/src/pages/VerifyProof.tsx` — Verification UI. No structural changes, but loading states may need to account for slower verification.
- `client/src/components/SecurityRitualProgress.tsx` — May need step duration adjustments.

**No impact on:**
- Document encryption (AES-256-CBC) — already quantum-safe for symmetric encryption
- Data fragmentation and distribution — independent of proof system
- AI Story Authentication — unrelated to ZKP layer
- Stripe billing and subscriptions — unrelated

---

## How

### Phase 1: Dual-Mode Architecture (Recommended)

Rather than a hard cutover, run both proof systems simultaneously:

1. **Add a `proofSystem` field** to the proof schema (`"snark"` or `"stark"`), defaulting to `"snark"` for backward compatibility.

2. **Implement a STARK proof service** alongside the existing SNARK service. Candidate libraries:
   - **Stone Prover** (StarkWare's open-source STARK prover)
   - **Winterfell** (Rust-based STARK library with WASM bindings for Node.js)
   - **ethSTARK** (if on-chain verification becomes relevant)

3. **Feature-flag the transition** using an environment variable (e.g., `PROOF_SYSTEM=snark|stark|dual`):
   - `snark` — Current behavior, no changes
   - `dual` — New proofs generated as STARKs, old SNARK proofs still verifiable
   - `stark` — Full cutover, SNARK generation disabled

4. **Adjust storage and bandwidth:**
   - SNARK proofs: ~200-300 bytes
   - STARK proofs: ~20-200 KB
   - Database column type may need to change from `text` to `bytea` or a blob-compatible type for efficiency
   - API response compression becomes important

5. **Update verification logic:**
   - SNARK verification: ~1-5ms (current)
   - STARK verification: ~10-50ms (expected)
   - Public verify rate limits may need adjustment

### Phase 2: Full STARK Cutover

Once all active proofs have either expired (current TTL: 72 hours, seeded: 1 year) or been re-generated:

1. Remove Noir/Barretenberg dependencies
2. Set `PROOF_SYSTEM=stark` as default
3. Archive SNARK verification code for historical proof validation
4. Update tier limits if STARK generation costs differ materially

### Phase 3: On-Chain Attestation (Optional Future)

If the platform moves toward blockchain integration:

1. Post STARK proof commitments on-chain (Ethereum L2 or dedicated chain)
2. Use Chainlink oracles to attest document authenticity to external parties
3. Enable cross-platform proof verification without trusting Liquid Encrypt's server

---

## Why

### The Quantum Threat

- **BN254 elliptic curves** (used by our current Barretenberg backend) rely on the hardness of the Discrete Logarithm Problem. Shor's algorithm on a quantum computer solves this in polynomial time.
- **Timeline estimates** for cryptographically relevant quantum computers range from 10-20 years, but NIST and major governments are already mandating post-quantum migration plans.
- **Regulatory pressure** is building. NIST's Post-Quantum Cryptography standardization (completed 2024) signals that compliance frameworks will increasingly require quantum-resistant primitives.

### Why STARKs Specifically

| Property | SNARKs (Current) | STARKs (Target) |
|---|---|---|
| Quantum Resistant | No | Yes |
| Trusted Setup | Required (inherited from Aztec) | Not required |
| Proof Size | ~200 bytes | ~20-200 KB |
| Verification Speed | ~1-5ms | ~10-50ms |
| Generation Speed | Fast | Moderate |
| Maturity | High | Growing |
| Single Point of Failure | Setup ceremony | None |

### Why Not Now

- **Proof size overhead**: STARK proofs are 100-1000x larger. At current scale, this increases storage and bandwidth costs without immediate benefit.
- **Library maturity**: STARK tooling for Node.js/TypeScript is less mature than Noir/Barretenberg. Rushing adoption risks instability.
- **No immediate threat**: Quantum computers capable of breaking BN254 don't exist yet. The current SNARK system is secure today.
- **Cost**: STARK proof generation is more computationally expensive. At startup scale, this impacts margins before revenue justifies it.

### When to Trigger This Work

- When the platform reaches **enterprise scale** (thousands of proofs per day)
- When **regulatory requirements** mandate post-quantum cryptography
- When **STARK tooling** for TypeScript/Node.js reaches production maturity
- When a **credible quantum computing milestone** (e.g., 1000+ logical qubits) is announced

---

## Reference Architecture

```
Current (SNARKs):
  Document -> SHA-256 Commitment -> Noir Circuit (BN254) -> SNARK Proof -> Verify

Future (STARKs):
  Document -> SHA-256 Commitment -> STARK Circuit (Hash-based) -> STARK Proof -> Verify

Dual Mode:
  Document -> SHA-256 Commitment -> [SNARK or STARK based on config] -> Proof -> Verify
                                      ^-- proofSystem field tracks which was used
```

---

## Dependencies to Watch

- **Noir project**: If Aztec adds STARK backend support natively, the migration could be as simple as swapping the backend without rewriting circuits
- **Winterfell WASM**: Currently the most promising STARK library for Node.js integration
- **NIST PQC standards**: Will define which hash functions and parameters are considered compliant
- **Barretenberg updates**: Aztec may migrate to quantum-safe curves before we need to switch toolkits entirely
