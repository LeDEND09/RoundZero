# 🚀 RoundZero: The AI-Assisted Mock Interview Marketplace

[![Deployment Status](https://img.shields.io/badge/Deployment-Live-success)](https://roundzero.vercel.app)
[![React](https://img.shields.io/badge/React-19-blue)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-6-purple)](https://vitejs.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-v12-orange)](https://firebase.google.com/)

## 🎯 Project Overview
**RoundZero** is a comprehensive, production-grade platform designed to revolutionize technical interview preparation. It bridges the gap between static study materials and expensive human coaching by providing a marketplace where candidates can book mock interviews with industry experts, supported by real-time AI assistance and high-performance collaborative tools.

---

## 🧠 1. Problem Statement
**The Problem:**
Technical interview preparation is often fragmented. Candidates struggle with:
*   **Static Learning:** Books and LeetCode don't simulate the pressure of a live interview.
*   **High Costs:** One-on-one coaching from industry veterans is often prohibitively expensive.
*   **Lack of Feedback:** Candidates rarely get granular, actionable feedback after a failed interview.

**The Solution:**
RoundZero creates an immersive, real-time environment that:
1.  Connects candidates with experts for realistic mock sessions.
2.  Uses **Google Gemini AI** to provide real-time "Green/Red Flag" probing for the interviewer.
3.  Integrates a **Collaborative Code Editor** (Monaco) with sub-300ms synchronization.
4.  Provides an **Automated AI Scorecard** and transcript analysis to ensure continuous improvement.

---

## ✨ 2. Key Features

### 🔐 Authentication & Onboarding
*   **Secure Auth**: Google OAuth and Email/Password integration via Firebase.
*   **Dual-Role Onboarding**: Tailored registration flows for **Candidates** (Experience, Target Role, Bio) and **Experts** (Tech Stack, Professional Title, LinkedIn).

### 🤝 The Marketplace
*   **Expert Explore**: Real-time searchable grid of industry experts with domain-based filtering.
*   **Smart Scheduling**: Experts manage availability slots; candidates can book sessions with atomic transaction safety.

### 🎥 The Interview Room (Core)
*   **Video & Chat**: High-fidelity video calls and persistent chat powered by **Stream SDK**.
*   **Collaborative Monaco Editor**: Full VS Code-like experience with multi-language support (JS, Python, Java, C++, etc.).
*   **Real-time Sync**: Code and cursor positions synced via **Firebase Realtime Database**.
*   **Anti-Cheat System**: Real-time "Tab Switching" detection with automated logging and expert notifications.

### 🤖 AI-Assisted Evaluation
*   **AI Interviewer (Gemini 1.5 Flash)**: Generates context-aware technical questions and "Look-for" indicators.
*   **Live Scorecard**: A 6-category rating system for experts to grade candidates in real-time.
*   **Automated Grading**: Post-session AI analysis that combines expert notes with transcript data to generate a final report.

---

## 🛠️ 3. Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 19, Vite, Tailwind CSS, Framer Motion |
| **Backend/BaaS** | Firebase (Auth, Firestore, Realtime DB, Storage, Functions) |
| **Real-time Communication** | Stream Video SDK, Stream Chat SDK |
| **AI/LLM** | Google Gemini 1.5 Flash API |
| **Editor** | Monaco Editor (@monaco-editor/react) |
| **Styling** | Modern Fintech Light Theme (Custom CSS) |

---

## 🏗️ 4. Project Structure
```text
/src
  /api          # Serverless functions (Vercel/Firebase)
  /components   # Reusable UI components (Sidebar, Layout, UI blocks)
  /context      # React Context for Global State (Auth, Theme)
  /hooks        # Custom hooks for Firebase and Stream logic
  /pages        # Page-level components (Room, Dashboard, Explore, etc.)
  /styles       # Global CSS and theme tokens
/public         # Static assets
```

---

## 🚀 5. Setup & Installation

### Prerequisites
*   Node.js (v18+)
*   npm or yarn
*   A Firebase Project

### Installation Steps

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/LeDEND09/RoundZero.git
    cd roundzero
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Environment Configuration**
    Create a `.env.local` file in the root directory and populate it with your credentials:
    ```env
    VITE_FIREBASE_API_KEY=your_key
    VITE_FIREBASE_AUTH_DOMAIN=your_domain
    VITE_FIREBASE_PROJECT_ID=your_id
    VITE_FIREBASE_STORAGE_BUCKET=your_bucket
    VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
    VITE_FIREBASE_APP_ID=your_app_id
    VITE_FIREBASE_DATABASE_URL=your_rtdb_url

    VITE_STREAM_API_KEY=your_stream_key
    GEMINI_API_KEY=your_gemini_key
    ```

4.  **Run Development Server**
    ```bash
    npm run dev
    ```

5.  **Build for Production**
    ```bash
    npm run build
    ```

---

## ✅ 6. Evaluation Checklist (Rubric Alignment)

*   [x] **Functional Components & Hooks**: 100% Functional components using `useState`, `useEffect`, `useMemo`, and `useRef`.
*   [x] **State Management**: Uses Context API for global auth and session state.
*   [x] **Backend Integration**: Full Firebase Auth, Firestore (CRUD), and Realtime Database integration.
*   [x] **Routing**: Protected routes implemented with `react-router-dom`.
*   [x] **UI/UX**: Responsive design with "Modern Fintech Light" aesthetic and Framer Motion animations.
*   [x] **Complexity**: Beyond a simple CRUD app; integrates real-time video, collaborative editing, and AI.

---

## 📄 7. License
Distributed under the MIT License. See `LICENSE` for more information.

---

## 🧑‍💻 Author
**Student Name** - Batch 2029
*Project submitted for "Building Web Applications with React" End-Term Evaluation.*
