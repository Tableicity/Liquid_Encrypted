# Zero Proof Build Plan
## Liquid Encrypted Data System — Organization Layer + Zero Knowledge Proofs

---

## Vision

Transform Liquid Encrypt from a user-scoped security platform into a true multi-tenant organization-based platform, then layer Zero Knowledge Proofs on top of that solid foundation. Every new user gets a sandbox with seeded data to explore Zero Proofs before creating their actual organization. The system scales to GitHub and AWS.

---

## Option A: Build the Organization Foundation First

We are building the organization layer before touching Zero Knowledge Proofs. This ensures every ZKP table, route, and query is built correctly from day one with `organizationId` scoping. No retrofit, no migration debt.

---

## Phase 1: Organization Foundation

### 1.1 New Database Tables

**`organizations` table**
| Column | Type | Notes |
|--------|------|-------|
| id | varchar PK (uuid) | |
| name | varchar(255) | Organization display name |
| slug | varchar(100), unique | URL-friendly identifier |
| type | varchar(20) | 'sandbox' or 'production' |
| ownerId | varchar FK → users | User who created the org |
| plan | varchar(50) | Current subscription plan type |
| stripeCustomerId | varchar(255), nullable | For org-level billing |
| settings | jsonb | Org-level config |
| createdAt | timestamp | |
| updatedAt | timestamp | |

**`organization_members` table**
| Column | Type | Notes |
|--------|------|-------|
| id | varchar PK (uuid) | |
| organizationId | varchar FK → organizations | |
| userId | varchar FK → users | |
| role | varchar(50) | 'owner', 'admin', 'member', 'viewer' |
| joinedAt | timestamp | |
| invitedBy | varchar FK → users, nullable | |

Unique constraint: `(organizationId, userId)` — one membership per user per org.

### 1.2 Auto-Sandbox on Signup

When a new user signs up:
1. Create the user account (existing flow)
2. Auto-create a sandbox organization: `{ name: "{email}'s Sandbox", type: "sandbox" }`
3. Add user as org owner in `organization_members`
4. Seed the sandbox with demo data (documents, fragments) so they can explore immediately

### 1.3 Create Organization Flow

Users can create a "production" organization:
1. New page: "Create Organization" — name, slug
2. Creates org with `type: "production"`
3. User becomes org owner
4. Subscription/billing attaches to the org (not the user)

### 1.4 Re-scope Existing Tables

Existing tables that need `organizationId` added:
- `documents` — add `organizationId`, keep `userId` for "who uploaded it"
- `subscriptions` — scope to org (org pays, not individual users)
- `storage_usage` — scope to org
- `grace_periods` — scope to org
- `payments` — scope to org
- `audit_logs` — add `organizationId` for org-scoped audit trails

Tables that stay user-scoped (no change):
- `users` — global user identity
- `chat_sessions` — individual user sessions
- `quota_warnings` — user-level notifications

### 1.5 Migration Strategy

Since this is a structural change to existing tables:
1. Add `organizationId` columns as nullable first
2. Run a backfill script: for every existing user, create a sandbox org and populate `organizationId` on their existing records
3. Once backfilled, make `organizationId` NOT NULL on new records going forward
4. Update all queries in `storage.ts` to filter by `organizationId`
5. Update all routes to resolve the current org from the authenticated user
6. Update middleware to include org context

### 1.6 Middleware Changes

- `requireAuth` — continues to verify user identity via JWT
- New: `resolveOrganization` — after auth, resolve which org the user is operating in (from header, query param, or default to their sandbox)
- `assertDocumentAccess` — update to check org membership, not just userId
- `requireRole` — org-level roles (org owner, admin) vs platform-level roles (super_admin, owner)

### 1.7 Frontend Changes

- Sidebar: Add org switcher (sandbox vs production orgs)
- Signup flow: Auto-lands in sandbox after signup + subscription
- New page: "Create Organization"
- All data-fetching hooks pass `organizationId`

### 1.8 Existing User Backward Compatibility

- All existing users get a sandbox org auto-created
- Their existing documents, subscriptions, and storage move under that sandbox org
- No data loss, no broken references
- They can create a production org when ready

---

## Phase 2: Zero Knowledge Proofs (Built on Org Foundation)

### 2.1 Navigation

Add "Zero Proofs" to the left sidebar with an accordion containing three pages:
1. **Privacy Vault** — Generate proofs for documents
2. **Verify Proof** — Verify proof validity (internal)
3. **Audit Proofs** — Proof history and audit trail

Feature-flagged: Only visible when `VITE_NOIR_ENABLED=true` (frontend) and `NOIR_ENABLED=true` (backend).

### 2.2 Noir Stack (Locked Versions)

```
@noir-lang/noir_js: v0.36.0
@noir-lang/backend_barretenberg: v0.36.0
```

Circuits compiled locally, JSON artifacts committed to repo.

### 2.3 Gate Progression (from Tableicity Blueprint)

**Gate 0: Foundation** — Prove toolchain works
- Install Noir packages
- Create test_hash circuit (Pedersen hash)
- Generate and verify a test proof
- Log SUCCESS

**Gate 1: Commitment Engine** — Data layer
- Add 4 new tables (all scoped to `organizationId`):
  - `commitment_records` — cryptographic commitments
  - `proof_requests` — proof generation requests
  - `proof_results` — generated proofs + verification keys
  - `proof_usage` — monetization tracking per billing period
- Commitment generation script
- Stub proof service functions

**Gate 2: Circuit + API** — Real proofs
- Document authenticity circuit (score ≥ threshold)
- `proof-service.ts` — NoirJS integration (generate + verify)
- API routes (POST generate, POST verify, GET details, GET list, GET usage)
- Frontend shell pages

**Gate 3: Wire Frontend + Public Verify**
- Connect frontend pages to proof API
- Public verification endpoint (no auth, rate-limited, CORS)
- Proof TTL (72 hours default)
- Security Ritual progress animation

**Gate 4: Monetization + Tier Gating**
- Tier config tied to existing Stripe subscription plans
- Proof access middleware (checks org plan)
- Usage tracking per billing period (atomic increment)
- Upgrade CTAs for gated users
- Beta mode: everyone gets access during testing

### 2.4 ZKP Database Tables (All Org-Scoped)

```
commitment_records.organizationId → organizations.id
proof_requests.organizationId → organizations.id
proof_usage.organizationId → organizations.id
```

### 2.5 Sandbox Seeding for ZKP

Every sandbox org gets:
- 4 commitment records from seeded demo documents
- 1 pre-verified demo proof with 1-year TTL
- User can test the full Zero Proof flow before creating their real org

### 2.6 Security Rules (Non-Negotiable)

1. Private inputs NEVER in any API response
2. proofHex NEVER exposed in frontend-facing endpoints
3. Public verify returns status only — no PII, no org info
4. Salt values truncated to 31 bytes (62 hex chars) — BN254 field constraint
5. Rate limit public endpoints — 10 req/min per IP
6. Feature flag entire ZKP section behind NOIR_ENABLED
7. Proof generation errors must not leak circuit details

---

## Phase 3: LLM Upgrade (Future — After Noir is Solid)

### 3.1 Grok Integration
- Replace or augment OpenAI with Grok API
- Grok handles "Narrative Persistence" with 1M+ token context
- Extracts 5 Semantic Anchors: Time, Subject, Location, Object, Emotion
- Output: strict JSON for Noir witness generation

### 3.2 5 Semantic Anchor Circuit
- New Noir circuit: hash 5 anchors → compare to stored commitment
- Middleware: normalize anchors (lowercase, trim) before hashing
- Poseidon hash (8x fewer constraints than Pedersen/SHA-256)

### 3.3 Multi-Model Consensus (Liquid Stack)
- Grok (Logic Engine): manages persistent narrative
- OpenAI (Forensic Extractor): extracts anchors from Grok's narrative
- Two AI "minds" agree on anchors before Noir verification
- Eliminates hallucination risk in security gate

### 3.4 Persistence Without Storage
- Grok maintains story context during active session
- Session ends → story deleted (liquified)
- Only Noir commitment (hash) stored on server
- Return visit: retell story → extract anchors → Noir verifies → unlock

---

## File Structure (Target)

```
liquid-encryption/
├── noir_circuits/
│   ├── test_hash/
│   │   ├── src/main.nr
│   │   ├── Nargo.toml
│   │   └── target/test_hash.json          (compiled artifact)
│   └── document_authenticity/
│       ├── src/main.nr
│       ├── Nargo.toml
│       └── target/document_authenticity.json
├── server/
│   ├── proof-service.ts
│   ├── proof-routes.ts
│   ├── proof-middleware.ts
│   └── proof-config.ts
├── client/src/pages/
│   ├── PrivacyVault.tsx
│   ├── VerifyProof.tsx
│   └── AuditProofs.tsx
├── scripts/
│   └── generate-commitments.ts
├── shared/
│   └── schema.ts                          (org tables + proof tables)
└── John/
    └── Zero Proof.md                      (this document)
```

---

## Execution Order

1. **Phase 1.1–1.2**: Create `organizations` + `organization_members` tables, auto-sandbox on signup
2. **Phase 1.3**: Create Organization UI flow
3. **Phase 1.4–1.5**: Re-scope existing tables, backfill migration
4. **Phase 1.6–1.7**: Update middleware, routes, frontend
5. **Phase 1.8**: Verify backward compatibility
6. **Phase 2 Gates 0–4**: Zero Knowledge Proof implementation
7. **Phase 3**: LLM upgrade (Grok + Semantic Anchors)

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Org layer before ZKP | Yes (Option A) | Build once, build right. No retrofit. |
| Sandbox auto-creation | On signup | Every user explores before committing |
| Billing scope | Organization | Teams share a plan, not individuals |
| Noir versions | Locked at v0.36.0 | Battle-tested from Tableicity |
| Circuit approach | Authenticity score first | Simpler, proven. 5-anchor circuit comes with Grok. |
| LLM strategy | Keep OpenAI during Noir build | Don't change two systems at once |
| Feature flagging | NOIR_ENABLED env var | Ship incrementally, don't expose unfinished work |
