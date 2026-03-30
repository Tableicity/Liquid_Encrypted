# Liquid Encrypt: Dual-LLM Architecture — OpenAI + Grok

## Platform Identity

Liquid Encrypt is a document security platform where files never exist in a readable state by default. A document enters as solid, gets shattered into 8 encrypted fragments distributed across storage nodes (liquid state), and only reassembles temporarily when someone proves they should have access (accessible state). The Zero Knowledge Proof layer adds mathematical verification on top — you can prove a document is authentic without ever exposing it.

The AI Story Authentication is what makes this platform unlike anything else. Instead of passwords or 2FA codes, a user proves their identity by telling a story that only they would know. The AI analyzes the narrative for authenticity. That's not just a security feature — that's the product's identity.

---

## The Dual-LLM Strategy

### OpenAI (gpt-4o-mini) — The Gatekeeper

**Role:** Real-time story authentication sessions

**What it does:**
- Analyzes user narratives during document access requests
- Scores authenticity based on conversational nuance, tone, and context
- Determines if the person telling the story is who they claim to be
- Manages short-lived, conversational, high-nuance authentication sessions

**Why OpenAI stays:**
- Proven strength in nuanced language understanding
- Excellent context tracking across multi-turn conversations
- Tone and sentiment analysis for authenticity scoring
- Already integrated and battle-tested in the current stack
- Session-based with 30-minute expiration — built for real-time interaction

**Current integration:**
- `server/routes.ts` — `/api/chat/session` and `/api/chat/message` endpoints
- `client/src/components/ChatInterface.tsx` — Frontend conversation UI
- Sandbox orgs: AI Story Auth is greyed out (locked behind live org creation)
- Live orgs: Full AI-powered story authentication

---

### Grok — The Librarian

**Role:** Document intelligence, persistence, and knowledge management

**What Grok will own:**
- **Document Classification**: Automatically categorize uploaded documents (financial, legal, technical, personal) based on content analysis before encryption
- **Smart Tagging**: Generate metadata tags from document content that persist even while the document is in liquid state
- **Relationship Mapping**: Understand how documents relate to each other (e.g., a term sheet references a board resolution, a financial report supports an audit)
- **Intelligent Search**: Search across encrypted document metadata without reconstituting the documents — query the knowledge layer, not the vault
- **Version Intelligence**: Detect when a new upload is a revision of an existing document, track what changed, flag conflicts
- **Retrieval Suggestions**: When a user accesses one document, suggest related documents they may need
- **Document Summaries**: Generate and store summaries at upload time that users can review without triggering full reconstitution

**Why Grok for this role:**
- Long-context persistence — it's not managing a 30-minute session, it's building a knowledge graph that lives as long as the organization does
- Document understanding requires different strengths than conversational authentication
- Separating concerns keeps each LLM focused on what it does best
- Grok's architecture is well-suited for knowledge persistence and retrieval tasks

---

## Architecture: How They Work Together

```
USER UPLOADS DOCUMENT
        |
        v
   [Grok Layer]
   - Analyzes content before encryption
   - Generates classification, tags, summary
   - Maps relationships to existing documents
   - Stores metadata in knowledge graph
        |
        v
   [Encryption Engine]
   - AES-256-CBC double encryption
   - Fragment into 8 pieces
   - Distribute across nodes
   - Document enters LIQUID state
        |
        v
   (Document is now encrypted and distributed)
   (Grok's metadata persists separately)

USER REQUESTS ACCESS
        |
        v
   [OpenAI Layer]
   - Story authentication session begins
   - User tells their narrative
   - AI scores authenticity across conversation
   - Pass/fail determination
        |
        v
   [If authenticated]
   - Fragments reconstitute temporarily
   - Document enters ACCESSIBLE state
   - Grok suggests related documents
   - 30-minute access window
        |
        v
   [Access expires]
   - Document returns to LIQUID state
```

---

## Integration Plan

### Phase 1: Grok Document Intelligence at Upload

**When:** Before encryption, at upload time

**Implementation points:**
- `server/routes.ts` — Upload endpoint, after file receipt but before fragmentation
- New service: `server/grok-service.ts` — Grok API integration for document analysis
- New schema tables: `document_metadata` (tags, classification, summary, relationships)
- Frontend: Display Grok-generated tags and classification on document cards

**Flow:**
1. User uploads document
2. Grok analyzes raw content
3. Grok returns: classification, tags, summary, detected relationships
4. Metadata stored in database
5. Document proceeds to encryption and fragmentation
6. Original content is destroyed — only encrypted fragments and Grok's metadata remain

### Phase 2: Smart Search and Retrieval

**When:** User browses their vault or searches

**Implementation points:**
- New endpoint: `/api/documents/search` — Semantic search across Grok-generated metadata
- New endpoint: `/api/documents/:id/related` — Relationship-based suggestions
- Frontend: Search bar with intelligent results, related document suggestions on access

**Flow:**
1. User searches "board resolution March"
2. Query hits Grok metadata layer (not encrypted documents)
3. Returns matching documents with summaries and tags
4. User selects document, triggers OpenAI story auth to access it

### Phase 3: Knowledge Graph and Version Intelligence

**When:** Organization reaches meaningful document volume

**Implementation points:**
- New service: `server/grok-knowledge.ts` — Cross-document relationship engine
- New schema: `document_relationships` (sourceDocId, targetDocId, relationshipType, confidence)
- Frontend: Visual relationship map showing how documents connect
- Version detection: Flag when uploads appear to be revisions of existing documents

---

## What Each LLM Never Does

### OpenAI does NOT:
- Read or analyze document content for classification
- Store long-term knowledge about document relationships
- Provide search or retrieval intelligence
- Persist any information beyond the 30-minute session

### Grok does NOT:
- Handle authentication or identity verification
- Manage real-time conversational sessions
- Make access control decisions
- Touch encrypted document content after initial analysis

---

## Security Boundaries

- **Grok sees document content exactly once** — at upload, before encryption. After that, it only works with the metadata it generated. The raw content is encrypted and fragmented.
- **OpenAI never sees document content** — it only manages the story authentication conversation. It has no access to documents, metadata, or encryption keys.
- **Metadata is non-reversible** — Grok's tags, summaries, and classifications cannot be used to reconstruct the original document. They are derived insights, not data extracts.
- **Both LLMs are server-side only** — API keys are never exposed to the frontend. All LLM interactions happen through backend services.

---

## Environment Variables

```
# Existing (OpenAI)
OPENAI_API_KEY=<already configured>

# New (Grok)
GROK_API_KEY=<to be configured when ready>

# Feature flags
GROK_ENABLED=true|false
GROK_CLASSIFICATION_ENABLED=true|false
GROK_SEARCH_ENABLED=true|false
```

---

## Summary

| Capability | LLM | Status |
|---|---|---|
| Story Authentication | OpenAI (gpt-4o-mini) | Live |
| Document Classification | Grok | Planned — Phase 1 |
| Smart Tagging | Grok | Planned — Phase 1 |
| Document Summaries | Grok | Planned — Phase 1 |
| Semantic Search | Grok | Planned — Phase 2 |
| Related Documents | Grok | Planned — Phase 2 |
| Knowledge Graph | Grok | Planned — Phase 3 |
| Version Intelligence | Grok | Planned — Phase 3 |

Two LLMs. Two jobs. One platform. The story gets you in the door. Grok knows what's behind it.
