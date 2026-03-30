# Liquid Encrypted Data System 2.2

Revolutionary quantum-resistant security platform featuring data fragmentation, distributed storage, AI-powered story-based authentication, zero knowledge proofs, and Grok-powered document intelligence.

![Security Status](https://img.shields.io/badge/encryption-AES--256--CBC-blue)
![Authentication](https://img.shields.io/badge/auth-AI--Story--Based-green)
![ZKP](https://img.shields.io/badge/ZKP-Noir--BN254-purple)
![Intelligence](https://img.shields.io/badge/intelligence-Grok--3--mini-orange)
![License](https://img.shields.io/badge/license-MIT-brightgreen)

## Core Innovation

Documents exist in three states:
- **Solid**: Original uploaded file
- **Liquid**: Fragmented and encrypted across 8 distributed nodes (default secure state)
- **Accessible**: Temporarily assembled for authorized access after AI authentication

## Key Features

### Split-Panel Landing Experience
- **Marketing Showcase**: Dark navy left panel with auto-rotating beast image slideshow and security feature highlights
- **Glass-Morphism Login**: Right panel with app peek-through background, dark navy overlay, and frosted-glass login card
- **Cookie Gateway**: Privacy consent overlay positioned on the login card with dual-action buttons
- **Free Trial Label**: Green "Start a Free Trial" indicator for future 1-Day Pass integration
- **Mobile Responsive**: Left panel hidden on mobile, full-screen login experience with brand header

### Security Architecture
- **Quantum-Resistant Encryption**: AES-256-CBC with double encryption (file-level + fragment-level)
- **Data Fragmentation**: Documents split into 8 encrypted pieces distributed across nodes
- **AI-Powered Authentication**: OpenAI GPT-4o-mini analyzes personal stories for identity verification
- **Tamper-Proof Audit Logging**: HMAC-SHA256 signed audit trails for compliance

### Zero Knowledge Proofs (Noir)
- **Commitment Generation**: SHA-256 commitments for document ownership verification
- **Proof Generation & Verification**: BN254 curve proofs via Noir/Barretenberg
- **Public Verification**: Third parties can verify proofs without authentication
- **Usage Tracking**: Tier-based proof limits (personal: 10/mo, business: 100/mo, enterprise: unlimited)
- **Sandbox Demo**: 1-proof cap for sandbox organizations

### Grok Document Intelligence
- **Automatic Classification**: Documents classified at upload (financial, legal, technical, medical, etc.)
- **Smart Tagging**: AI-generated keyword tags for document discovery
- **Content Summarization**: Concise summaries with key entity extraction
- **Confidentiality Detection**: Automatic confidentiality level assignment (public to highly confidential)
- **Language Detection**: Multi-language document support
- **Dual-LLM Architecture**: OpenAI handles authentication, Grok handles document intelligence

### Role-Based Access Control (RBAC)
5-tier role system with granular permissions:
- **Customer**: Upload, access, and manage own documents
- **Support**: View user data, assist with access issues
- **Billing Admin**: Manage subscriptions, payments, and billing
- **Super Admin**: User management, system configuration
- **Owner**: Full system control and security oversight

### Multi-Tenant Organizations
- **Sandbox Organizations**: Auto-created on signup for exploration
- **Production Organizations**: User-initiated for real workloads
- **Organization Switching**: Seamless context switching between orgs
- **Member Management**: Invite and manage team members per organization
- **Org-Scoped Data**: Documents, subscriptions, proofs, and audit logs scoped per org

### Subscription Management
- **No-Gate Entry**: Users land directly in the dashboard after signup — no forced subscription page
- **Sidebar Access**: Subscription plans accessible from the "Subscription" sidebar navigation item
- **Personal Plan**: $19.99/mo - 100 documents, 10GB storage
- **Business Plan**: $99.99/mo - Unlimited documents, 100GB storage
- **Enterprise Plan**: $999.99/mo - Unlimited everything, priority support

### Storage Quota Management
- **Byte-Precise Tracking**: Dual-field architecture eliminates rounding errors
- **Grace Periods**: 7-day enforcement windows when quota is exceeded
- **Atomic Operations**: Concurrent upload race condition protection
- **Pre-Upload Middleware**: Three-tier quota checks before upload

### Payment Processing
- Stripe integration with test/live mode toggle
- Secure two-step payment flow (SetupIntent + Subscription)
- Automated subscription lifecycle management

## Quick Start

### Prerequisites
- Node.js 20+ and npm
- PostgreSQL database
- OpenAI API key (for story authentication)
- Grok API key (for document intelligence, optional)
- Stripe account (test/live keys)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/Tableicity/Liquid_Encrypted.git
cd Liquid_Encrypted
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# OpenAI (for AI story authentication)
OPENAI_API_KEY=sk-...

# Grok (for document intelligence - optional)
GROK_API_KEY=xai-...

# Stripe (Payment Processing)
STRIPE_SECRET_KEY=sk_live_...
VITE_STRIPE_PUBLIC_KEY=pk_live_...
TESTING_STRIPE_SECRET_KEY=sk_test_...
TESTING_VITE_STRIPE_PUBLIC_KEY=pk_test_...

# Session Secret
SESSION_SECRET=your-random-secret-key-here

# Owner Account (Auto-bootstrapped)
OWNER_EMAIL=your-email@example.com

# Zero Knowledge Proofs (optional)
NOIR_ENABLED=true
VITE_NOIR_ENABLED=true
```

4. **Initialize the database**
```bash
npm run db:push
```

5. **Start the application**
```bash
npm run dev
```

The application will be available at `http://localhost:5000`

## Project Structure

```
Liquid_Encrypted/
├── client/                    # React frontend
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   │   ├── DocumentCard.tsx    # Document display with Grok intelligence
│   │   │   ├── ChatInterface.tsx   # AI story authentication
│   │   │   └── ui/                 # Shadcn/ui components
│   │   ├── pages/            # Page components
│   │   │   ├── LandingPage.tsx     # Split-panel marketing + auth
│   │   │   ├── Documents.tsx       # Document management
│   │   │   ├── Subscribe.tsx       # Subscription plan selection
│   │   │   ├── PrivacyVault.tsx    # ZKP commitments & proofs
│   │   │   ├── VerifyProof.tsx     # Proof verification
│   │   │   └── AuditProofs.tsx     # Proof history
│   │   └── lib/              # Utilities and helpers
├── server/                    # Express backend
│   ├── routes.ts             # Core API endpoints
│   ├── storage.ts            # Database abstraction (IStorage)
│   ├── middleware.ts         # Auth, RBAC, & security middleware
│   ├── grok-service.ts       # Grok document intelligence
│   ├── proof-service.ts      # ZKP proof generation/verification
│   ├── proof-routes.ts       # ZKP API endpoints
│   ├── proof-config.ts       # ZKP tier limits & configuration
│   ├── org-routes.ts         # Organization management
│   ├── stripe-service.ts     # Payment processing
│   └── admin-routes.ts       # Admin console endpoints
├── shared/                    # Shared types & schemas
│   └── schema.ts             # Database schema (Drizzle ORM)
├── .github/workflows/        # CI/CD pipelines
│   ├── prod.yml              # Production deployment
│   └── staging.yml           # Staging deployment
└── Dockerfile                # Container configuration
```

## Owner Account Bootstrap

On first startup, the system automatically creates an owner account using the `OWNER_EMAIL` from your environment variables with a temporary password. **Important**: Change this password immediately after first login!

## Testing with Stripe

The system defaults to **TEST MODE** for safe development:

### Test Credit Cards
- **Success**: `4242 4242 4242 4242`
- **Success (Mastercard)**: `5555 5555 5555 4444`
- **Declined**: `4000 0000 0000 0002`

Use any future date for expiry, any 3 digits for CVC, and any ZIP code.

### Switch to Live Mode
Set `STRIPE_MODE=live` in your environment variables and restart.

## Database Schema

Built with **Drizzle ORM** and **PostgreSQL**:

- `users` - User accounts with hashed passwords
- `user_roles` - RBAC role assignments
- `documents` - Document metadata and encryption info
- `fragments` - Encrypted document fragments
- `document_metadata` - Grok-generated intelligence (classification, tags, summary)
- `organizations` - Multi-tenant organization management
- `organization_members` - Org membership and roles
- `subscriptions` - Active user subscriptions
- `subscription_plans` - Available plan tiers
- `payments` - Payment transaction records
- `storage_usage` - Byte-precise storage tracking
- `grace_periods` - Quota overage grace period management
- `chat_sessions` - AI authentication sessions
- `audit_logs` - Tamper-proof security audit trail
- `commitment_records` - ZKP document commitments
- `proof_requests` - ZKP proof generation requests
- `proof_results` - ZKP proof verification results
- `proof_usage` - ZKP tier-based usage tracking

## Security Features

### Encryption
- **Algorithm**: AES-256-CBC
- **Key Derivation**: Scrypt with user-specific salts
- **Double Encryption**: File-level + fragment-level with derived keys
- **IV Management**: Random IVs for each fragment

### Authentication
- **JWT Tokens**: 30-day expiration for user sessions
- **Story-Based Verification**: AI analyzes personal narratives for document access
- **Session Management**: Express sessions with 30-minute expiration

### Zero Knowledge Proofs
- **Commitment Scheme**: SHA-256 hash commitments
- **Proof System**: Noir circuits on BN254 curve via Barretenberg
- **Salt Handling**: 31-byte truncation for field compatibility
- **Public Verification**: Stateless proof verification without authentication

### Audit Logging
- **HMAC-SHA256 Signatures**: Cryptographically signed audit logs
- **Comprehensive Coverage**: All security events logged
- **Tamper Detection**: Signature verification prevents log manipulation

## Admin Console

Access the admin console at `/admin` with appropriate role permissions:

- **User Management**: Create, edit, disable accounts
- **Role Assignment**: Manage RBAC permissions
- **Subscription Overview**: Monitor active subscriptions
- **Audit Logs**: Review security events and access patterns
- **System Health**: Monitor documents, fragments, and system status

## AWS Deployment

### Branch Strategy
- `main` - Production releases
- `staging` - Staging environment for testing

### CI/CD Pipelines
- Production deploys from `main` to `prod-liquid` ECS cluster
- Staging deploys from `staging` to `stg-liquid` ECS cluster

### Health Check
- `/healthz` endpoint returns database connection status for ALB health checks

## Development

### Available Scripts
- `npm run dev` - Start development server (frontend + backend)
- `npm run db:push` - Sync database schema
- `npm run build` - Build for production
- `npm run start` - Run production build

### Tech Stack
- **Frontend**: React 18, TypeScript, Tailwind CSS, Shadcn/ui, Radix UI
- **Backend**: Express.js, Node.js 20
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: JWT + OpenAI GPT-4o-mini
- **Document Intelligence**: xAI Grok-3-mini
- **Zero Knowledge Proofs**: Noir 0.36.0 + Barretenberg
- **Payment**: Stripe
- **Build**: Vite (frontend) + esbuild (backend)

## Contributing

This is a proprietary security platform. Contributions are welcome with prior approval.

## License

MIT License - See LICENSE file for details

## Support

For issues, questions, or feature requests, please contact the development team.

---

**Built with security first. Protected by quantum-resistant encryption.**
