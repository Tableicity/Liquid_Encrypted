# Design Guidelines: Liquid Encrypted Data System

## Design Approach

**Selected System**: Modern Security-First Hybrid  
Drawing inspiration from Linear (clean, tech-forward), Stripe (trust and clarity), and Notion (intuitive complexity management) to create a professional interface that balances cutting-edge innovation with enterprise reliability.

**Core Principles**:
- Convey security and trust through clean, precise design
- Make complex technology feel accessible and understandable
- Create visual distinction between states (upload → liquid → reconstituted)
- Emphasize the innovative nature of the system

---

## Typography

**Font Stack**:
- Primary: Inter (body text, UI elements) - professional and highly legible
- Accent: JetBrains Mono (code, technical data, fragment IDs) - reinforces technical precision
- Display: Inter (headings with tight letter-spacing for modern feel)

**Hierarchy**:
- Hero Headings: text-5xl to text-6xl, font-bold, tight tracking (-0.02em)
- Section Headings: text-3xl, font-semibold
- Subsection Headings: text-xl, font-medium
- Body Text: text-base (16px), leading-relaxed
- Technical Labels: text-sm, font-mono, uppercase tracking-wide
- Chat Messages: text-base, leading-normal

---

## Layout System

**Spacing Primitives**: Use Tailwind units of **4, 6, 8, 12, 16, 24** (p-4, p-6, p-8, m-12, gap-16, py-24)

**Grid Structure**:
- Container: max-w-7xl with mx-auto for main content
- Sidebar Navigation: 280px fixed width (w-70)
- Main Content Area: Flexible with appropriate padding (p-8 to p-12)
- Dashboard Layouts: 3-column grid (grid-cols-3) for cards/metrics
- Documentation: 2-column (grid-cols-2) for architecture diagrams

---

## Component Library

### Navigation
- **Sidebar**: Fixed left navigation with logo, main sections, user profile at bottom
- **Top Bar**: Breadcrumbs, global search, notifications, user menu
- **Tab Navigation**: For switching between Upload/Documents/Architecture views

### Core UI Elements

**File Upload Zone**:
- Large drag-and-drop area with dashed border
- Icon (upload cloud), heading, and supporting text
- File type restrictions and size limits clearly displayed
- Visual feedback on hover and during upload

**Chat Interface**:
- Full-height chat panel (can be modal or sidebar)
- Distinct message bubbles: AI (left-aligned, subtle background), User (right-aligned, primary accent)
- Avatar icons for AI (lock/shield symbol) and User
- Input area with auto-expanding textarea
- Real-time typing indicators

**Document Cards**:
- Grid layout with document preview/icon
- Document name, fragment count, last accessed date
- Status badges (Liquid, Reconstituted, Accessible)
- Quick action buttons (View, Download, Delete)

**Fragment Visualization**:
- Interactive diagram showing distributed fragments
- Node representations for different storage locations
- Animated connections/flows during reconstitution
- Color-coded by encryption layer or storage provider

**Architecture Diagrams**:
- Clean, professional flowcharts using SVG
- Directional arrows showing data flow
- Labeled states and transitions
- Legend for symbols and color meanings

### Forms & Inputs
- Floating labels for text inputs
- Clear error states with helper text below fields
- Submit buttons with loading states
- Search inputs with icon prefix

### Data Display
- **Metrics Cards**: Large number, label, trend indicator
- **Status Indicators**: Dot notation with color + text label
- **Tables**: Striped rows, sortable columns, hover states
- **Progress Bars**: For upload/reconstitution progress

### Overlays
- **Modals**: Centered, backdrop blur, for critical actions (delete confirmation, session warnings)
- **Toasts**: Top-right corner for success/error notifications
- **Tooltips**: On hover for technical terms and icons

---

## Visual States & Animations

**Data Lifecycle States** (use color/iconography to distinguish):
- **Solid** (pre-upload): Standard document icon, neutral state
- **Liquifying**: Animated particle effect, fragments dispersing
- **Liquid** (fragmented): Scattered fragment icons across node map
- **Reconstituting**: Fragments converging animation
- **Reconstituted**: Complete document icon, highlight/glow effect
- **Dissolving**: Reverse of reconstitution, returning to fragments

**Interactions**:
- Smooth transitions (transition-all duration-200) for state changes
- Subtle hover lifts (hover:translate-y-[-2px]) on cards
- Button press states (active:scale-95)
- Loading spinners for async operations
- Micro-animations for chat message appearance (slide-in)

**Minimize Distracting Animations**: Use purposefully only for:
- File upload progress
- Fragment visualization during liquification/reconstitution
- Authentication success/failure feedback

---

## Page Layouts

### Dashboard (Landing After Login)
- Hero metrics section: Total documents, active sessions, security status
- Quick actions: Upload New Document, View All Documents
- Recent activity feed
- System health/fragment distribution overview

### Upload Interface
- Large, centered upload zone
- File queue below showing upload progress
- Post-upload: Animated transition showing liquification process
- Success state with fragment distribution visualization

### Chat Authentication
- Clean chat interface (full-screen or modal overlay)
- Story prompt from AI clearly displayed
- User response area with character guidance
- Visual authentication progress (steps or confidence meter)
- Success: Smooth transition to requested document/action

### Document Library
- Grid or list view toggle
- Filters: Status, Date, Type
- Search bar
- Document cards with metadata
- Pagination for large collections

### Architecture Documentation
- Sidebar table of contents
- Main content area with diagrams and text
- Interactive/zoomable diagrams
- Download PDF/Markdown options

### System Architecture Visualization
- Full-screen canvas for fragment distribution map
- Real-time updates showing fragment locations
- Click nodes to see fragment details
- Filter by document or encryption layer

---

## Images

**Hero Section** (Dashboard/Landing):
- Abstract, high-tech visualization of data fragmentation
- Suggest: Geometric particles dispersing across a gradient field, conveying distribution and security
- Subtle animation (particles gently floating)
- Placement: Background with overlay gradient for text readability

**Authentication Chat**:
- AI avatar: Abstract shield/lock icon in circle
- User avatar: Generated initial or uploaded photo

**Documentation**:
- Architecture diagrams: Custom-designed flowcharts (SVG)
- System state diagrams: Lifecycle visualization
- No stock photos - all visuals should be technical/diagram-based

**Empty States**:
- Illustration for "No documents yet" - simple line art of upload icon
- "No active sessions" - abstract representation of liquid state at rest

---

**Design Confidence**: This system creates a professional, security-focused interface that makes advanced technology approachable. The clear visual hierarchy and state differentiation help users understand complex processes while maintaining enterprise credibility.