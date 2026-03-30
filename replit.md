# Liquid Encrypted Data System

## Overview
The Liquid Encrypted Data System is a security platform that utilizes quantum-resistant encryption through data fragmentation and distribution. It transforms uploaded documents into encrypted fragments stored across multiple nodes, ensuring data security in a "liquid" state. Access is managed via an AI-powered story-based authentication system that verifies user identity through narrative analysis. The system supports document upload, secure storage, and retrieval, featuring a comprehensive UI/UX. It also includes a robust subscription and billing system, along with a 5-tier Role-Based Access Control (RBAC) mechanism.

**Core Innovation**: Documents exist in three states:
- **Solid**: Original uploaded file
- **Liquid**: Fragmented and distributed encrypted data across nodes (default secure state)
- **Accessible**: Temporarily assembled for authorized access after authentication

## User Preferences
- Communication style: Simple, everyday language
- Security-first approach with clear visual feedback
- Modern, clean aesthetic (Linear/Stripe/Notion inspired)
- Minimal user friction - automatic processes where possible

## System Architecture

### UI/UX Decisions
- **Framework**: React 18 with TypeScript
- **UI Components**: Shadcn/ui with Radix UI primitives, "New York" style variant
- **Styling**: Tailwind CSS with custom design tokens
- **Typography**: Inter (UI), JetBrains Mono (technical/code)
- **Color Scheme**: HSL-based with CSS variables for theme support (light/dark mode)

### Technical Implementations
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL (Neon-hosted) with Drizzle ORM and postgres-js driver
- **Encryption**: AES-256-CBC with random IVs and double encryption (file-level + fragment-level with derived keys). Keys are never exposed.
- **Data Fragmentation**: Documents are fragmented into 8 encrypted pieces and distributed across simulated storage nodes.
- **Authentication**: OpenAI (gpt-4o-mini) for story-based narrative analysis. Session-based authentication with 30-minute expiration. JWT-based authentication for user and admin console access with 30-day expiration.
- **File Upload**: Multer for file handling, with a 50MB limit.
- **Subscription & Billing**: Stripe integration for 3-tier subscription plans with a two-step payment process.
- **Role-Based Access Control (RBAC)**: 5-tier role system (`customer`, `support`, `billing_admin`, `super_admin`, `owner`) enforced by security middleware (`requireAuth`, `requireRole`, `assertDocumentAccess`).
- **Security Logging**: Comprehensive audit logging for unauthorized access attempts, document access denials, and critical system actions.
- **Horizontal Privilege Escalation Prevention**: Enforced document ownership checks.
- **Storage Quota Enforcement**: Byte-precise quota tracking using dual-field architecture (usedBytes/quotaBytes for enforcement, usedGb/allocatedGb for display) eliminates ~5MB rounding errors. Automatic grace period management with 7-day enforcement windows. When users exceed their storage quota, the system creates a grace period that automatically expires 7 days later. Pre-upload middleware enforces three-tier checks (under quota, within grace period, expired grace period). Atomic storage operations protect against concurrent upload race conditions. Includes support for warning email tracking and status management (active/resolved/expired).

### Multi-Tenant Organization Layer
- **Organization Types**: `sandbox` (auto-created on signup) and `production` (user-initiated)
- **Tables**: `organizations` (id, name, slug, type, ownerId, settings) and `organization_members` (id, orgId, userId, role, joinedAt, invitedBy)
- **Org-scoped Fields**: `organizationId` added as nullable FK to documents, subscriptions, storageUsage, gracePeriods, payments, auditLogs
- **Startup Backfill**: Idempotent bootstrap creates sandbox orgs for existing users without organizations on every server start
- **Org Context Middleware**: `requireOrgContext` validates `X-Organization-Id` header and membership; `requireAuth` extracts org from header or JWT
- **Frontend**: Org switcher in sidebar, persisted via localStorage, included in all API requests as `X-Organization-Id` header
- **Routes**: `server/org-routes.ts` — full CRUD for orgs + member management (POST/GET/PATCH orgs, POST/GET/DELETE members)
- **Zero Proofs Nav**: Collapsible accordion in sidebar with Commitments, Verify, Proof History items; enabled when `VITE_NOIR_ENABLED=true`

### Zero Knowledge Proofs (Phase 2)
- **Feature Flag**: `NOIR_ENABLED=true` (backend) + `VITE_NOIR_ENABLED=true` (frontend)
- **Packages**: `@noir-lang/noir_js@0.36.0`, `@noir-lang/backend_barretenberg@0.36.0`
- **Tables**: `commitment_records`, `proof_requests`, `proof_results`, `proof_usage` — all org-scoped
- **Proof Service** (`server/proof-service.ts`): Commitment generation (SHA-256), proof generation, proof verification. Salt truncated to 31 bytes (62 hex chars) for BN254 field constraint.
- **Proof Config** (`server/proof-config.ts`): Default TTL 72hrs, threshold 1-100, tier limits (personal: 10/mo, business: 100/mo, enterprise: unlimited), beta mode enabled
- **API Routes** (`server/proof-routes.ts`):
  - `POST /api/proofs/commitments` — Create commitment (document ownership enforced)
  - `GET /api/proofs/commitments` — List org commitments
  - `POST /api/proofs/generate` — Generate proof from commitment
  - `POST /api/proofs/verify` — Verify proof (authenticated)
  - `POST /api/proofs/verify/public` — Public verify (status only, no auth)
  - `GET /api/proofs/usage/current` — Current billing period usage
  - `GET /api/proofs` — List org proofs
  - `GET /api/proofs/:id` — Get proof detail
- **Frontend Pages**:
  - `PrivacyVault.tsx` — Create commitments + generate proofs
  - `VerifyProof.tsx` — Verify proof validity (authenticated + public modes)
  - `AuditProofs.tsx` — Proof history with usage stats
- **Security**: Document ownership check on commitment creation, org-scoped access control, proofHex never exposed in frontend, rate limiting planned for public verify

### Grok Document Intelligence (Phase 3)
- **Feature Flag**: Auto-enabled when `GROK_API_KEY` is set (no separate feature flag needed)
- **API Provider**: xAI (OpenAI-compatible), model `grok-3-mini`, baseURL `https://api.x.ai/v1`
- **Table**: `document_metadata` (unique documentId FK, classification, tags, summary, keyEntities, confidentialityLevel, language, analyzedAt) — org-scoped
- **Service** (`server/grok-service.ts`): Extracts text preview (3000 chars max), sends to Grok for analysis, returns structured JSON. 15s timeout with AbortController.
- **Upload Integration**: Grok analyzes document content ONCE at upload time (after encryption/storage, before response). Graceful fallback — upload succeeds even if Grok fails.
- **API Enrichment**: GET `/api/documents` returns metadata alongside each document (single batch query, not N+1).
- **Frontend**: DocumentCard displays classification badge, confidentiality level, language tag, keyword tags (up to 4), and summary with tooltip (showing key entities on hover).
- **Security**: Document content is sent to xAI only as a truncated text preview; binary files get minimal metadata. Raw file content is never stored in metadata. Grok errors are caught and logged without blocking uploads.

### Landing Page & Auth UI
- **Split-panel landing page** (`LandingPage.tsx`): Left panel (45%) dark navy with beast image slideshow (3 images auto-rotating every 5s), feature highlights, and security credentials; Right panel (55%) with Peek.PNG background, dark overlay, glass-morphism login/signup card
- **Cookie card**: Always shows on every visit (no localStorage persistence), Accept All / Reject All both dismiss — no real cookie logic
- **"Start a Free Trial"**: Green label text on login card — non-functional placeholder for future 1-Day Pass
- **Subscription gate removed**: Users land directly in dashboard after signup/login, no forced subscription page
- **Subscription sidebar page**: Pricing cards and Stripe payment flow accessible from "Subscription" sidebar nav item (replaces forced gate flow)
- **Auth view toggle**: Login/signup forms toggle within the same landing page card

### Feature Specifications
- Document upload with automatic fragmentation and encryption.
- Secure document retrieval and reconstitution.
- User signup/login with JWT (includes organizationId in token).
- Subscription plan selection and payment processing via Stripe (accessible from sidebar).
- Admin console for user, role, subscription, and audit log management.
- Owner bootstrap functionality via environment variables.
- Organization management: create production orgs, switch between orgs, manage members.

### System Design Choices
- **Data Persistence**: PostgreSQL for robust and permanent data storage.
- **Modularity**: IStorage interface for flexible storage implementation.
- **Security-first**: Emphasizing quantum-resistant encryption, secure authentication, and robust access control.
- **Scalability**: Designed with a layered architecture to facilitate future enhancements.

## AWS Migration

### Containerization
- **Dockerfile**: Multi-stage Node.js 20 Alpine build, exposes port 8000
- **Health Check**: `/healthz` endpoint returns database connection status for ALB health checks
- **Port Configuration**: Uses `PORT` environment variable (default 5000 for Replit, set to 8000 for AWS)

### CI/CD Pipelines
- **Production** (`.github/workflows/prod.yml`): Deploys `main` branch to `prod-liquid` ECS cluster
- **Staging** (`.github/workflows/staging.yml`): Deploys `staging` branch to `stg-liquid` ECS cluster with type checks

### Branch Strategy
- `main` - Production releases (immutable history of live deployments)
- `staging` - Staging environment for testing before production
- Feature branches merge to `staging` first, then `staging` merges to `main`

### AWS Resources (to be provisioned)
- ECS Fargate clusters: `prod-liquid`, `stg-liquid`
- ECR repository: `liquid-app`
- Application Load Balancer with HTTPS (ACM cert)
- S3 buckets for Shredder shards (SSE-KMS enabled)
- RDS PostgreSQL database
- Secrets Manager for API keys (Stripe, OpenAI, etc.)

## External Dependencies
- **OpenAI API**: Used for the gpt-4o-mini model for story-based authentication.
- **Stripe API**: Integrated for secure subscription payment processing and webhooks.
- **PostgreSQL**: Primary database for all persistent data storage.
- **Drizzle ORM**: Used for interacting with the PostgreSQL database.
- **Vite**: Frontend build tool.
- **TanStack Query**: For server state management in the frontend.
- **Shadcn/ui & Radix UI**: UI component libraries.
- **Tailwind CSS**: For styling.
- **Multer**: Node.js middleware for handling multipart/form-data, primarily for file uploads.