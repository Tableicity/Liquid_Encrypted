# Liquid Encrypted Data System

## Overview

The Liquid Encrypted Data System is a revolutionary security platform that implements quantum-resistant encryption through data fragmentation and distribution. The system transforms uploaded documents into encrypted fragments distributed across multiple storage nodes, making data inherently secure in its "liquid" state. Access is granted through an innovative story-based AI authentication system that verifies user identity through narrative analysis rather than traditional passwords.

**Core Innovation**: Documents exist in three states:
- **Solid**: Original uploaded file
- **Liquid**: Fragmented and distributed encrypted data across nodes
- **Reconstituted**: Temporarily assembled for authorized access

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack**:
- React with TypeScript for type-safe component development
- Vite as the build tool and development server
- TanStack Query (React Query) for server state management and caching
- Shadcn/ui component library with Radix UI primitives for accessible, customizable components
- Tailwind CSS for utility-first styling with custom design tokens

**Design System**:
- Typography: Inter (body/UI), JetBrains Mono (technical/code elements)
- Color system: HSL-based with CSS variables for theme support (light/dark modes)
- Spacing: Tailwind units (4, 6, 8, 12, 16, 24) for consistent layout rhythm
- Component library: Custom-themed Shadcn components following "New York" style variant

**State Management Pattern**:
- Server state handled by React Query with disabled auto-refetch to prevent unnecessary API calls
- Local UI state managed through React hooks (useState, useContext)
- Theme state persisted to localStorage via ThemeProvider context
- Form state managed by React Hook Form with Zod validation

**Routing Strategy**:
- Client-side page navigation through state management (no traditional router)
- Pages: Dashboard, Upload, Documents, Architecture
- Navigation handled via callbacks passed as props to page components

### Backend Architecture

**Server Framework**:
- Express.js with TypeScript for type-safe API development
- HTTP server creation and routing through modular route registration
- Development mode uses Vite middleware for HMR and SSR
- Production mode serves pre-built static assets

**API Design**:
- RESTful endpoints under `/api` namespace
- File upload handling via Multer with in-memory storage (50MB limit)
- Multipart form data for document uploads
- JSON request/response format for all other endpoints
- Custom logging middleware for API request tracking

**Data Flow**:
1. Document upload triggers liquification process
2. File encrypted with AES-256-CBC using random key and IV
3. Encrypted data split into 8 fragments
4. Each fragment double-encrypted with fragment-specific key derived from main key
5. Fragments distributed across 5 simulated storage nodes
6. Fragment metadata stored with checksums for integrity verification
7. Chat-based authentication required for reconstitution
8. OpenAI integration for story-based identity verification

**Storage Abstraction**:
- IStorage interface defines contract for data operations
- MemStorage implements in-memory storage with Map data structures
- Documents, Fragments, and ChatSessions stored separately
- Design allows easy swap to persistent database (PostgreSQL configured via Drizzle)

### Security Architecture

**Encryption Strategy**:
- Double encryption: File-level + Fragment-level
- AES-256-CBC cipher for both layers
- Random IV generation for each encryption operation
- Master encryption key stored with document metadata (in-memory)
- Fragment keys derived via SHA-256 hash of master key + fragment index
- Checksum validation (SHA-256) for data integrity

**Authentication Model**:
- Story-based authentication via AI conversation
- OpenAI API integration for narrative analysis
- Chat sessions track authentication state
- Session expiration for time-limited access
- Document-specific or general authentication flows

**Data States & Lifecycle**:
- **Liquid**: Default state, fragments distributed, no access
- **Reconstituted**: Fragments gathered but still encrypted
- **Accessible**: Decrypted and ready for download after successful authentication

### Database Schema (Configured for PostgreSQL)

**Documents Table**:
- id (primary key), name, size, status, fragmentCount
- encryptionKey (sensitive, never exposed in public API)
- uploadedAt, lastAccessed timestamps

**Fragments Table**:
- id (primary key), documentId (foreign key)
- fragmentIndex, encryptedData (base64), iv (initialization vector)
- node (storage location), checksum (SHA-256)

**ChatSessions Table**:
- id (primary key), documentId (optional foreign key)
- messages array (role, content, timestamp)
- authenticated boolean, createdAt, expiresAt timestamps

**Migration Strategy**:
- Drizzle ORM configured for PostgreSQL
- Schema defined in TypeScript with type inference
- Zod schemas for runtime validation
- Current implementation: in-memory storage with database-ready interface

## External Dependencies

**AI Services**:
- **OpenAI API**: GPT model for story-based authentication and narrative analysis
- Requires OPENAI_API_KEY environment variable
- Used in chat interface for conversational identity verification

**Database**:
- **PostgreSQL**: Configured via Neon serverless driver
- Drizzle ORM for type-safe database operations
- Connection via DATABASE_URL environment variable
- Session storage via connect-pg-simple

**UI Component Libraries**:
- **Radix UI**: Headless accessible component primitives (40+ components)
- **Shadcn/ui**: Pre-styled component implementations
- **Lucide React**: Icon library for consistent iconography
- **cmdk**: Command palette component
- **react-day-picker**: Calendar/date picker

**Development Tools**:
- **Vite**: Fast development server with HMR
- **TypeScript**: Type safety across full stack
- **ESBuild**: Production bundling
- **Tailwind CSS**: Utility-first styling with PostCSS

**File Handling**:
- **Multer**: Multipart form data parsing for file uploads
- In-memory storage buffer with 50MB size limit

**Fonts**:
- **Google Fonts**: Inter (UI), JetBrains Mono (technical elements)
- Preconnected for performance optimization