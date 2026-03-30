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
- **Zero Proofs Nav**: Collapsible accordion in sidebar with Commitments, Verify, Proof History items; disabled unless `VITE_NOIR_ENABLED=true`

### Feature Specifications
- Document upload with automatic fragmentation and encryption.
- Secure document retrieval and reconstitution.
- User signup/login with JWT (includes organizationId in token).
- Subscription plan selection and payment processing via Stripe.
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