# Product Requirements Document (PRD)

**Project Name:** RoundZero
**Tagline:** The AI-Assisted Mock Interview Marketplace
**Document Status:** Draft (MVP Phase)

## 1. Executive Summary
**The Problem:** High-quality mock technical interviews with real industry experts are prohibitively expensive because experts must spend unpaid time preparing questions and writing detailed feedback reports.

**The Solution:** A two-sided marketplace that pairs job candidates with industry experts for live video interviews. The platform uses Google Gemini AI as an "interviewer co-pilot" to generate real-time, scenario-based questions and automatically analyzes the call transcript to produce a comprehensive feedback report, eliminating prep and administrative work for the expert.

## 2. Target Audience (User Personas)
**The Candidate (Interviewee):** Software engineers actively applying for jobs who need realistic, high-pressure practice and objective, actionable feedback.

**The Expert (Interviewer):** Senior engineers or tech leads who want to mentor and monetize their free time, but only want to commit to the actual time spent on the call (zero prep, zero paperwork).

## 3. Core User Stories
**As a Candidate, I want to...**
- Securely log in and create a profile detailing my target role.
- Browse a list of available experts filtered by technical domain.
- Book an available time slot on an expert's calendar.
- Join a secure video call room at the scheduled time.
- Receive an automated, AI-generated performance scorecard after the call ends.

**As an Expert, I want to...**
- Create a profile highlighting my company, title, and specialized tech stack.
- Set recurring or specific blocks of availability.
- Join a scheduled video call and see AI-generated, scenario-based questions tailored to the candidate's target role.
- Have the platform automatically generate and send the feedback report to the candidate so I can leave the platform immediately after hanging up.

## 4. MVP Functional Scope
### A. Authentication & Onboarding
**Tech:** Firebase Authentication.
**Features:** Email/Password or Google OAuth login. A split onboarding flow determining if the user is a Candidate or an Expert.

### B. Scheduling Engine
**Tech:** Firestore (Collections: users, availability, bookings).
**Features:** Experts can define time blocks. Candidates can select an open block, generating a booking document that locks the slot and generates a unique stream_call_id.

### C. The Interview Room (Live Call)
**Tech:** Stream Video & Chat SDKs, Animate.ui (Hexagon background).
**Features:**
- High-fidelity video/audio grid.
- Persistent side-chat for sharing links/text.
- *Expert-Only View:* A side panel displaying Gemini-generated scenarios and "Red Flag / Green Flag" probing questions.

### D. Automated AI Feedback Pipeline
**Tech:** Stream Webhooks + Firebase Cloud Functions + Gemini API.
**Features:**
- Automated cloud recording and background transcription triggered on call start.
- A webhook triggers a Firebase Cloud Function when the transcript is ready.
- The Function sends the transcript to Gemini with a strict grading prompt.
- The resulting JSON scorecard (Technical Score, Communication, Strengths, Improvements) is saved to Firestore and displayed on the Candidate's dashboard.

## 5. Non-Functional Requirements
**Security:** API keys (Stream Secret, Gemini Key) must not be exposed in the Vite frontend. All token generation and AI prompting must occur securely within Firebase Cloud Functions.
**Performance:** The UI must be a fast, client-side routed Single Page Application (SPA).
**Scalability:** Firestore rules must be strictly configured so Candidates can only read their own feedback, and Experts can only edit their own availability.

## 6. Out of Scope for MVP (V2 Features)
- Integrated payment gateways (e.g., Stripe) for charging candidates and paying experts.
- In-browser collaborative code editor (monaco-editor).
- Algorithmic auto-matching between candidates and experts.
