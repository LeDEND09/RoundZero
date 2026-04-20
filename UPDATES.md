# Project Updates & History

This file tracks our progress and implemented features chronologically for the **RoundZero** project.

## [Draft Stage] - RoundZero MVP Setup

**Completed Tasks (Foundation Setup):**

- [x] **Project Structure Validation**
  - Confirmed core files exist: `src/main.jsx`, `src/App.jsx`, `src/firebase.js`.
  - Created missing `src/pages/` directory.

- [x] **Firebase Configuration**
  - Validated `src/firebase.js` properly initializes `app`, `auth`, and `db`.
  - Created and populated `.env.local` with placeholder Firebase variables (`VITE_FIREBASE_API_KEY`, etc.) preventing hardcoded secrets.

- [x] **React Router Setup**
  - Wrapped app in `<BrowserRouter>` inside `main.jsx`.
  - Set up `<Routes>` in `App.jsx` with placeholder pages for all MVP paths: `/`, `/login`, `/onboarding`, `/dashboard`, `/explore`, `/expert/:uid`, `/book/:expertUid`, and `/room/:callId`.

- [x] **Dependencies Validation**
  - Confirmed required packages are successfully installed in `package.json`:
    - `firebase`
    - `react-router-dom`
    - `tailwindcss`

- [x] **Product Requirements Saved**
  - Stored the Project PRD inside `PRD.md` for permanent context tracking.

## [Phase 4.A] - Authentication & Onboarding

**Completed Tasks:**

- [x] **Authentication Core (`LoginPage`)**
  - Configured `@tailwindcss/postcss` for Tailwind CSS compatibility.
  - Implemented `/login` with 52/48 split screen UI.
  - Added hex background, Syne fonts, and custom glowing animations.
  - Implemented dynamic forms for "Log in" and "Sign up".
  - Rolled out Google OAuth pop-up login.
  - Mapped specific Firebase error codes to user-friendly messages.
  - Auto-creates initial user documents in Firestore.

- [x] **Dual Split Onboarding Flow (`OnboardingPage`)**
  - Implemented unified `/onboarding` step-by-step form.
  - Added Firestore lookup to route user to correct sub-flow based on `role` field.
  - Automatically redirects users to `/dashboard` if `onboarded: true`.
  - Candidate Steps (Target Role, Experience & Tech Tag Multi-select, Focus Areas).
  - Expert Steps (Company/Title, Domain specializations, Custom Bio).
  - Wired Finish button to persist state directly back to Firestore with `updateDoc()`.

## [Phase B] - Profiles & Dashboards

**Completed Tasks:**

- [x] **B1: Candidate Profile Page (`CandidateProfilePage`)**
  - Created shared layout `Sidebar.jsx` with navigation routes (`/dashboard`, `/explore`, `/profile`) and Auth Sign Out.
  - Built out full `/profile` view for Candidate Users matching visual design.
  - Implemented interactive toggle between Read-Only and Edit Mode for updating Firestore documents.
  - Wired live Firebase Stats queries dynamically loading past **Completed Sessions**, **Avg Tech Score**, and **Avg Comm Score** by filtering collections (`bookings`, `feedback`) by `candidateUid`.

- [x] **Universal Dual Dashboard (`DashboardPage`)**
  - Updated `Sidebar.jsx` to natively branch navigational routes based on user role (Candidate vs Expert). Added real-time notification dot for upcoming bookings.
  - Built unified `/dashboard` that toggles components based on roles.
  - Real-time `onSnapshot` fetching mappings on `bookings` and `feedback` to dynamically supply logic for the views.
  - Included the Upcoming Banner (with glowing CSS pulse dot), the latest AI scorecard UI with interactive percentage bars, and full Expert quick action lists.

- [x] **B2: Expert Profile Page (`ExpertProfilePage`)**
  - Designed the public-facing expert view at `/expert/:uid` ensuring security checks filter out non-experts.
  - Implemented dynamic session counting using live `bookings` aggregation and mocked out upcoming sub-collection `slots` query fetching.
  - Developed conditional CTA buttons routing Candidates to `/book/:uid` and returning Experts to their own native settings (`/profile`).

- [x] **B3: Expert Browse Page (`ExplorePage`)**
  - Fully implemented the interactive candidate discoverability grid.
  - Built a completely Client-Side filtering engine running in real-time on search inputs and Domain pills.
  - Designed responsive animated CSS grid cards that stagger upon loading and expose a gradient CTA button upon hovering.
  - Added full loading skeleton (shimmer) effects and stylized empty states.

### Phase C: Scheduling Engine

- [x] **C1: Expert Availability Setup (`AvailabilityPage`)**
  - Designed the master Availability management portal for Experts mapped to `/availability`.
  - Built a reactive dual `date / time` HTML5 native input block that safely validates time blocks client-side preventing negative times and past bookings.
  - Enabled live real-time `onSnapshot` fetching from `availability/{uid}/slots` using `orderBy()` mapping slots into daily grouped arrays.
  - Integrated conditional interactions hiding the Native Trash button when a Slot commits to `isBooked: true`.

- [x] **C2: Booking Checkout Flow (`BookingPage`)**
  - Built full `/book/:expertUid` flow with auth guard and expert data loading.
  - Grouped available slots by date and laid out interactive time-slot selection grid.
  - Implemented `writeBatch` to atomically create a `bookings` doc and mark the slot `isBooked: true`.
  - Added role description display in booking summary so candidates see what topic the interview covers.
  - Auto-generates `streamCallId` via `crypto.randomUUID()` for future video room linking.
  - Designed success celebration card with confetti-style confirmation.

- [x] **C3: Role Description on Availability Slots**
  - Added a "Role Description (Target)" text input to the Availability slot creation form.
  - Saves `roleDescription` field into each `availability/{uid}/slots` Firestore document.
  - Renders role description under each slot row in the upcoming list view.
  - Propagates `roleDescription` into the `bookings` document on checkout.
  - Expert Profile (`/expert/:uid`) now displays actual role description per slot instead of mock difficulty labels.

### Phase C.5: Mobile & Tablet Responsive Refactoring

- [x] **Responsive Sidebar**
  - Added mobile hamburger menu with animated SVG transitions (3 bars → X).
  - Sidebar slides in/out via CSS translateX with cubic-bezier easing.
  - Implemented dark overlay with `backdrop-filter: blur` on mobile.
  - Auto-closes drawer on route change and locks body scroll when open.

### Phase C.7: Advanced Expert Profile Redesign

- [x] **Expert Profile Hero Card**
  - Redesigned with gradient border, hexagonal avatar frame (CSS `clip-path`), and verified badge.
  - Two-column grid layout with Available Sessions and Interview Style sections.
  - Dynamic progress bar metrics for Technical Depth, Communication, and Real-World Focus.
  - Reviews section with graceful empty state handling.

### Phase D: Interview Room

- [x] **D1: Room Page (`RoomPage`)**
  - Built full-screen 3-panel layout (Chat, Video, AI Questions) at `/room/:callId`.
  - Integrated Stream Video SDK with `DEV_MODE` flag:
    - Dev mode: renders mock video tile with circle avatar, "Camera off" label, and amber dev banner.
    - Production mode: fetches token from Cloud Function and initializes `StreamVideoClient`.
  - Floating controls bar with mic/cam toggles and leave confirmation popover.
  - Session timer counting elapsed time from mount.
  - Custom CSS dark-theme overrides for Stream SDK components.

### Phase D.2: Session Management

- [x] **D2a: Upcoming Sessions Page (`UpcomingSessionsPage`)**
  - Built dedicated `/upcoming` route with real-time `onSnapshot` queries.
  - Groups sessions by date ("Today", "Tomorrow", "Wednesday, 9 Apr").
  - Dynamic countdown logic: "Starting soon" (< 30 min, green pulse dot), "in Xhr Ymin" (amber), "in X days" (gray).
  - Staggered Framer Motion entrance animations with `AnimatePresence mode="popLayout"`.
  - Cancel confirmation modal with batch Firestore writes (nulls booking + frees slot).
  - "Join Room →" button links directly to `/room/{streamCallId}`.

- [x] **D2b: Past Sessions Page (`PastSessionsPage`) — Full Rebuild**
  - Replaced basic list with comprehensive session history at `/past-sessions`.
  - Dual `onSnapshot` listeners for `confirmed` + `cancelled` bookings.
  - Enriches each booking with `users/{otherId}` profile data AND `feedback/{bookingId}` AI scorecard.
  - **Filter pills**: "All", "Completed", "Cancelled" — client-side filtering.
  - **Session cards** with:
    - Left accent stripe (green = has feedback, gray = pending, red = cancelled).
    - Date block, user info (hex avatar for experts, circle for candidates), domain tags.
    - Score pill with color coding: ≥8.0 green, ≥6.0 amber, <6.0 red.
    - "Feedback pending" and "Cancelled" status pills.
    - Click-to-expand chevron with 180° rotation animation.
  - **Expanded AI Scorecard**:
    - Animated score bars (width animates from 0 → score%) for Technical and Communication.
    - AI Summary block with italic text and left border accent.
    - Strengths chips (green tint) and Improvements chips (amber tint).
    - "Download full report" ghost button (placeholder).
    - Pending state with clock icon when no feedback doc exists.
  - Empty state with role-aware CTAs ("Book a session →" / "Set availability →").
  - Loading skeleton with shimmer animation.

### Cross-App Improvements

- [x] **Hexagon Background Consistency**
  - Applied animated `HexagonBackground` component with hover-glow effect across ALL pages.
  - Upgraded glow from 60% to full 100% opacity purple (`rgba(124,106,247,1)`).

- [x] **Experience Options Refactor**
  - Candidates: Replaced "0–1 yrs" with "Fresher".
  - Experts: Options start at "5–8 yrs", include "8–10 yrs" and "10+ yrs" (enforcing seniority).
  - Applied to both `OnboardingPage` (account creation) and `CandidateProfilePage` (editing).

- [x] **Tech Stack for Experts**
  - Separated "Expertise Domains" and "Tech Stack Expertise" into independent sections on profile editing.
  - Experts can now select both domains (Frontend, Backend, etc.) AND specific technologies (React, Python, etc.).
  - Tech stack renders on Expert Profile hero card alongside domains (dashed border to differentiate).
  - Tech stack also shows on Booking Page expert mini-card.

- [x] **Selected State Visibility Fix**
  - Upgraded `.tag-pill.selected` and `.option-card.selected` styles from dim translucent to solid purple with white text.
  - Added glowing `box-shadow` on selected option cards.
  - Applied fix to both `OnboardingPage.css` and `CandidateProfilePage.css`.

### Phase E: Cloud Functions & Stream Video Integration

- [x] **E1: Firebase Cloud Functions Setup**
  - Installed Firebase CLI globally (`firebase-tools`).
  - Scaffolded `functions/` directory with `package.json` (Node 20, firebase-functions v6, firebase-admin v13).
  - Installed `@stream-io/node-sdk` for server-side token generation.
  - Created `firebase.json` project config pointing to the functions source.
  - Added `functions/.env` with public `STREAM_API_KEY`.
  - Secret `STREAM_API_SECRET` to be set via `firebase functions:secrets:set`.

- [x] **E2: getStreamToken Cloud Function (`functions/index.js`)**
  - Implemented v2 HTTPS Callable function using `onCall` from `firebase-functions/v2/https`.
  - Uses `defineSecret("STREAM_API_SECRET")` for secure secret access (never in source).
  - Auth guard: rejects unauthenticated requests with `HttpsError("unauthenticated")`.
  - Upserts the Firebase user into Stream's user registry.
  - Generates a 1-hour JWT token via `client.generateUserToken()`.
  - Returns `{ token, apiKey }` to the frontend.

- [x] **E3: RoomPage Production Wiring**
  - Imported `getFunctions` and `httpsCallable` from `firebase/functions`.
  - Replaced placeholder `initRealStreamClient` with real callable invocation.
  - On success: initializes `StreamVideoClient`, joins the call, renders `SpeakerLayout`.
  - On failure: gracefully falls back to mock tile UI (no crash).
  - Removed hardcoded `STREAM_KEY` constant — API key now comes from the Cloud Function response.
  - Simplified video wrapper: shows `StreamVideo` when client+call exist, mock tile otherwise (works for both dev and prod failure cases).

### Phase F: Final Polish & UI Interactions

- [x] **F1: Global Clickability & Layer Fix**
  - Resolved a systemic UI bug where the hexagon background was blocking button/input interactions.
  - Implemented `pointer-events: none` on main content layers combined with `pointer-events: auto` on all interactive child elements.
  - Fix applied to: Dashboard, Explore, Profiles, Booking, and Availability pages.

- [x] **F2: 'Neon Bloom' Visual Upgrade**
  - Redesigned the `HexagonBackground` hover effect for maximum vibrancy.
  - Added **Stacked Bloom Shadows** (double-layer box-shadows at 50px and 100px) in the core component.
  - Boosted hover opacity to **100% Electric Purple** and reduced transition time to **100ms** for an "explosive" neon response.
  - Integrated `hover:z-10` to ensure glowing hexagons overlap their neighbors with atmospheric light.

- [x] **F3: Upcoming Sessions Dashboard Cleanup**
  - Moved the **Expert "Set Availability"** trigger into the top-right header for better accessibility.
  - Streamlined "No sessions" empty states by removing bulky center CTA buttons for both Candidates and Experts.
  - Maintained clear "Book a session" header navigation for candidate users.

- [x] **F4: Mobile Responsiveness Refactor**
  - Completely rewrote `LoginPage.css` to handle small screens (mobile-first approach).
  - Implemented a stackable flex layout (Vertical on mobile, Horizontal on desktop) for the 52/48 split-screen UI.
  - Adjusted font sizes and padding across profile cards to prevent overflow on portrait devices.

- [x] **F5: Firestore Performance Optimization**
  - Refactored `UpcomingSessionsPage` and `PastSessionsPage` queries to eliminate the need for complex composite indexes.
  - Switched to single-field `where` clauses combined with efficient client-side JavaScript filtering, resolving "Missing Index" errors and improving load speed.

### Phase G: Professional Typography & Modern Aesthetics

- [x] **Global Typography Overhaul**
  - Replaced legacy font stack (Syne/DM Sans) with **Outfit** (Headings) and **Plus Jakarta Sans** (Body) across 50+ files.
  - Applied global `line-height: 1.6` and `letter-spacing: 0.02em` in `index.css` for a more "airy" and professional SaaS aesthetic.
  - Eliminated "compressed" text visuals to achieve a "Professional & Meticulous" standard.

### Phase H: RoomPage Feature Completion

- [x] **H1: Integrated Stream Chat**
  - Replaced left panel placeholder with a real-time persistent chat using `StreamChat`.
  - Implemented custom dark-theme overrides to match the RoundZero aesthetic.
  - Chat persists across page refreshes during the session.

- [x] **H2: AI Interviewer (Gemini 1.5 Pro)**
  - Replaced right panel placeholder with an AI technical assistant powered by **Gemini 1.5 Pro**.
  - **Dynamic Questioning**: Generates context-aware technical questions based on the role description.
  - **Green/Red Flag Probe Logic**: AI provides "look-for" indicators to help the expert evaluate the candidate.
  - **Interactive UX**: Added shimmer loading states and copy-to-clipboard functionality for questions.

### Phase I: Comprehensive Mobile Responsiveness

- [x] **Unified Breakpoints & Layouts**
  - Standardized the `768px` (Tablet) and `480px` (Phone) breakpoints across all major pages.
  - **Dashboard**: Refined 1-column stats and grid stacking for portrait devices.
  - **Explore**: Vertically stacked filters and full-width search input for better thumb-reach.
  - **Booking & Availability**: Optimized slot grids to prevent horizontal scrolling.

- [x] **Smart RoomPage Overlays**
  - Implemented full-screen overlays for Chat and AI panels on mobile viewports.
  - Added **Mutual Exclusion** logic: opening one panel automatically closes the other to preserve video visibility.
  - Minimized floating controls for efficient space usage on small screens.

### Bug Fixes & Refinements

- [x] **Google Login "Stuck Loading" Fix**
  - Resolved a critical bug where new Google sign-ups were stuck on a white "Loading..." screen.
  - Implemented automatic Firestore profile creation for first-time Google users.
  - Added navigation branching: new users are now correctly routed to `/onboarding`, while returning users go to `/dashboard`.
  - Added `auth/popup-closed-by-user` error handling for a smoother UX.

- [x] **Smart Auth Redirection**
  - Enhanced the `onAuthStateChanged` guard to verify profile existence.
  - If a user is authenticated but has no backend data, they are automatically forwarded to the Signup/Onboarding flow to maintain data integrity.

- [x] **Session UI & Interaction Refinement**
  - Upgraded the "Stay / Leave" confirmation popover in the Interview Room to match the new Claymorphism design system.
  - Added soft 3D shadows and high-contrast primary/secondary button states for better decision clarity.

### Phase J: Collaborative Coding & Live Evaluation

- [x] **J1: Collaborative Code Editor**
  - Integrated **Monaco Editor** (VS Code engine) into the `RoomPage` with a surgical "Mode Switch".
  - **Real-Time Sync**: Implemented sub-300ms code synchronization using **Firebase Realtime Database (RTDB)**.
  - **Language Support**: Dynamic switching for JavaScript, Python, Java, C++, TypeScript, Go, and Rust.
  - **Cursor Awareness**: Real-time multi-user cursor tracking with name labels and role-specific colors (Expert: Gold, Candidate: Purple).
  - **Tab Switching Prevention**:
    - Full-screen warning overlay for candidates attempting to switch tabs.
    - Automated Firestore logging of `tabSwitchCount` and `lastTabSwitch` for interviewer review.
    - Real-time toast notifications for experts when a candidate loses focus.
  - **Dynamic Layout**: Implemented a "Spring-Animated" layout shift where video tiles move to a slim vertical strip on the left to maximize coding space.

- [x] **J2: Expert Live Scorecard**
  - Added a **Dual-Tab Switcher** in the expert panel (AI Questions ↔ Live Score).
  - **6-Category Evaluation**: Real-time scoring for Communication, Problem Solving, Code Quality, Edge Cases, Approaches, and Concept Clarity.
  - **Interactive UX**: 5-star rating system with Framer Motion hover/tap scales and individual category notes.
  - **Debounced Auto-Save**: Scores and notes are synced to RTDB with an 800ms debounce to ensure data persistence during the session.
  - **Live Summary Bar**: Sticky footer with real-time overall score calculation (10-point scale) and category rating progress.
  - **Feedback Pipeline**: Automatically writes final scores to Firestore `expertFeedback` collection on session leave, ready for Gemini-powered transcript analysis.

### Bug Fixes & Refinements

- [x] **RoomPage Layout Stability**
  - Fixed a critical issue where the `editorRef` and `monaco` instances were not properly persisted, leading to cursor tracking failures.
  - Refactored RTDB listeners into `useEffect` hooks for proper cleanup and to prevent memory leaks/duplicate listeners.
  - Updated `MyVideoUI` to handle both "Full Speaker" and "Compact Strip" modes seamlessly based on editor state.

- [x] **RoomPage Collaborative Session Reliability Patch**
  - Corrected Monaco integration import usage to ensure stable editor rendering in production builds.
  - Added robust cleanup for editor cursor listeners and debounce timers to prevent duplicate subscriptions and stale writes.
  - Resolved booking linkage for anti-tab-switch logging and expert feedback finalization by mapping `streamCallId` to the true `bookings/{bookingId}` document.
  - Ensured expert final score submission is saved to `expertFeedback/{bookingId}` for Gemini pipeline compatibility.
  - Standardized Live Score summary display format to the required `Overall: X.X / 10` style.
  - Added a Phase F security reminder comment to keep `expertFeedback` access restricted from candidates.

### Phase K: Onboarding Refinement & Technical Operations

- [x] **K1: Role-Specific Onboarding Expansion**
  - Completely redesigned the `/onboarding` experience to provide tailored registration flows for both Candidates and Experts.
  - **Expert Flow**: Integrated fields for Professional Bio, Title, LinkedIn URL, and a multi-select Technical Stack selector.
  - **Candidate Flow**: Added fields for Personal Bio, Current Title/Target Role, LinkedIn URL, and Years of Experience.
  - Standardized the visual design of both flows to ensure consistency with the new claymorphism aesthetics.

- [x] **K2: Expert Code Execution Simulation**
  - Added a functional "Run" button to the collaborative editor in the `RoomPage` (Expert-only).
  - Implemented an interactive **Code Execution Panel** that provides simulated runtime feedback, complete with success/error status styling.
  - Enables experts to demonstrate "running" code during the interview to test candidate logic and edge-case handling.

- [x] **K3: Infrastructure & Reliability**
  - **Server-Side Chat Bootstrapping**: Refactored `api/getStreamToken.js` to use `client.upsertUsers`. This ensures all session participants exist in the Stream system before the client attempts to watch channels, resolving race conditions.
  - **Firebase Configuration Fix**: Corrected the initialization logic in `src/firebase.js` to properly use the `VITE_FIREBASE_DATABASE_URL` environment variable for RTDB features.

- [x] **K4: Session Logic Optimization**
  - Refactored `RoomPage` to fetch booking metadata *before* session initialization, enabling the system to pre-configure the interview environment based on the specific job role.
  - Eliminated redundant Firestore document fetches by reusing session-scoped snapshots for AI question generation and chat bootstrapping.

- [x] **K5: Role-Based System Integration & AI Migration**
  - **Elevated Permissions**: Updated `api/getStreamToken.js` and `RoomPage.jsx` to propagate application roles (`expert` vs `candidate`) into the Stream registry, automatically granting experts elevated moderation permissions.
  - **AI Model Migration**: Migrated core backend services (`generateQuestions`, `gradeSession`) to use **Gemini 1.5 Flash**, optimizing for lower latency and better technical evaluation precision.
  - **Explore UI Refinement**: Added role-specific badges and neon accent styling in `ExplorePage` to highlight senior experts and verified candidates.

- [x] **K6: Session UX & Recording Orchestration Hardening**
  - **Dual-Join Recording Gate**: Updated `RoomPage.jsx` so recording starts only after both participants are present in the call (`participantCount >= 2`), preventing one-sided captures.
  - **Pre-Recording Status Banner**: Added a live UI notice ("Waiting for both participants to join before recording starts...") for better session transparency.
  - **Room Controls Readability**: Increased contrast for the Stream participant options menu (3-dots popover) to improve visibility during interviews.
  - **AI Question Reliability**: Hardened `fetchAiQuestions()` and `api/generateQuestions.js` response parsing with safer fallback behavior when model output is malformed or empty.

---
*Status: RoundZero is now a high-performance, real-time interview environment. Feature set covers Video, Chat, AI Assistance, Collaborative Coding, Role-Specific Onboarding, and Live Expert Evaluation.*

