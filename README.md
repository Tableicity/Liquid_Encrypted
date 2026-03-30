# Liquid Encrypted Data System 2.2

Revolutionary quantum-resistant security platform featuring data fragmentation, distributed storage, and AI-powered story-based authentication.

![Security Status](https://img.shields.io/badge/encryption-AES--256--CBC-blue)
![Authentication](https://img.shields.io/badge/auth-AI--Story--Based-green)
![License](https://img.shields.io/badge/license-MIT-brightgreen)

## 🔐 Core Innovation

Documents exist in three states:
- **Solid**: Original uploaded file
- **Liquid**: Fragmented and encrypted across 8 distributed nodes (default secure state)
- **Accessible**: Temporarily assembled for authorized access after AI authentication

## ✨ Key Features

### Security Architecture
- **Quantum-Resistant Encryption**: AES-256-CBC with double encryption (file-level + fragment-level)
- **Data Fragmentation**: Documents split into 8 encrypted pieces distributed across nodes
- **AI-Powered Authentication**: OpenAI GPT-4 analyzes personal stories for identity verification
- **Tamper-Proof Audit Logging**: HMAC-SHA256 signed audit trails for compliance

### Role-Based Access Control (RBAC)
5-tier role system with granular permissions:
- **Customer**: Upload, access, and manage own documents
- **Support**: View user data, assist with access issues
- **Billing Admin**: Manage subscriptions, payments, and billing
- **Super Admin**: User management, system configuration
- **Owner**: Full system control and security oversight

### Subscription Management
- **Personal Plan**: $19.99/mo - 100 documents, 10GB storage
- **Business Plan**: $99.99/mo - Unlimited documents, 100GB storage
- **Enterprise Plan**: $999.99/mo - Unlimited everything, priority support

### Payment Processing
- Stripe integration with test/live mode toggle
- Secure two-step payment flow (SetupIntent + Subscription)
- Automated subscription lifecycle management

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL database
- OpenAI API key
- Stripe account (test/live keys)

### Installation

1. **Clone the repository**
```bash
git clone <your-repo-url>
cd liquid-encrypt
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

# OpenAI (for AI authentication)
OPENAI_API_KEY=sk-...

# Stripe (Payment Processing)
STRIPE_MODE=test
STRIPE_SECRET_KEY=sk_live_...
VITE_STRIPE_PUBLIC_KEY=pk_live_...
TESTING_STRIPE_SECRET_KEY=sk_test_...
TESTING_VITE_STRIPE_PUBLIC_KEY=pk_test_...

# Session Secret
SESSION_SECRET=your-random-secret-key-here

# Owner Account (Auto-bootstrapped)
OWNER_EMAIL=your-email@example.com
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

## 📁 Project Structure

```
liquid-encrypt/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Page components
│   │   └── lib/           # Utilities and helpers
├── server/                # Express backend
│   ├── routes.ts          # API endpoints
│   ├── storage.ts         # Database abstraction
│   ├── middleware.ts      # Auth & security middleware
│   ├── stripe-service.ts  # Payment processing
│   └── utils/             # Server utilities
├── shared/                # Shared types & schemas
│   └── schema.ts          # Database schema (Drizzle ORM)
└── attached_assets/       # User uploaded files (excluded from git)
```

## 🔑 Owner Account Bootstrap

On first startup, the system automatically creates an owner account using the `OWNER_EMAIL` from your environment variables with a temporary password. **Important**: Change this password immediately after first login!

## 🧪 Testing with Stripe

The system defaults to **TEST MODE** for safe development:

### Test Credit Cards
- **Success**: `4242 4242 4242 4242`
- **Success (Mastercard)**: `5555 5555 5555 4444`
- **Declined**: `4000 0000 0000 0002`

Use any future date for expiry, any 3 digits for CVC, and any ZIP code.

### Switch to Live Mode
Set `STRIPE_MODE=live` in your environment variables and restart.

## 🗄️ Database Schema

Built with **Drizzle ORM** and **PostgreSQL**:

- `users` - User accounts with hashed passwords
- `user_roles` - RBAC role assignments
- `documents` - Document metadata and encryption info
- `fragments` - Encrypted document fragments
- `subscriptions` - Active user subscriptions
- `payments` - Payment transaction records
- `chat_sessions` - AI authentication sessions
- `audit_logs` - Tamper-proof security audit trail

## 🔒 Security Features

### Encryption
- **Algorithm**: AES-256-CBC
- **Key Derivation**: Scrypt with user-specific salts
- **Double Encryption**: File-level + fragment-level with derived keys
- **IV Management**: Random IVs for each fragment

### Authentication
- **JWT Tokens**: 30-day expiration for user sessions
- **Story-Based Verification**: AI analyzes personal narratives
- **Session Management**: Express sessions with PostgreSQL store

### Audit Logging
- **HMAC-SHA256 Signatures**: Cryptographically signed audit logs
- **Comprehensive Coverage**: All security events logged
- **Tamper Detection**: Signature verification prevents log manipulation

## 📊 Admin Console

Access the admin console at `/admin` with appropriate role permissions:

- **User Management**: Create, edit, disable accounts
- **Role Assignment**: Manage RBAC permissions
- **Subscription Overview**: Monitor active subscriptions
- **Audit Logs**: Review security events and access patterns
- **System Health**: Monitor documents, fragments, and system status

## 🛠️ Development

### Available Scripts
- `npm run dev` - Start development server (frontend + backend)
- `npm run db:push` - Sync database schema
- `npm run build` - Build for production

### Tech Stack
- **Frontend**: React 18, TypeScript, Tailwind CSS, Shadcn/ui
- **Backend**: Express.js, Node.js
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: JWT, Passport.js
- **Payment**: Stripe
- **AI**: OpenAI GPT-4o-mini

## 🤝 Contributing

This is a proprietary security platform. Contributions are welcome with prior approval.

## 📄 License

MIT License - See LICENSE file for details

## 🆘 Support

For issues, questions, or feature requests, please contact the development team.

---

**Built with security first. Protected by quantum-resistant encryption.**
# liquid-encrypt
# Liquid_Encrypted
# Liquid_Encrypted
