import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { auth, db } from '../firebase';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword 
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import Logo from '../components/Logo';
import { HexagonBackground } from '../components/animate-ui/components/backgrounds/hexagon';
import { useTheme } from '../lib/ThemeContext';

const GOOGLE_ICON = (
  <svg width="16" height="16" viewBox="0 0 48 48">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
);

export default function LoginPage() {
  const navigate = useNavigate();
  const { dark, setDark } = useTheme();
  
  const [activeTab, setActiveTab] = useState('login'); // 'login' | 'signup'
  const [role, setRole] = useState('candidate'); // 'candidate' | 'expert'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorVisible, setErrorVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successFlash, setSuccessFlash] = useState(false);

  useEffect(() => {
    // Auth state guard - more robust check for onboarding status
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const pDoc = await getDoc(doc(db, 'users', u.uid));
        if (pDoc.exists()) {
          const pData = pDoc.data();
          if (pData.onboarded) {
             navigate('/dashboard');
          } else {
             navigate('/onboarding');
          }
        } else {
          // Logged in but no firestore data found? 
          // Treat as a new signup needing info.
          setActiveTab('signup');
        }
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const mapFirebaseError = (code) => {
    switch (code) {
      case 'auth/wrong-password': return 'Incorrect password. Please try again.';
      case 'auth/user-not-found': return 'No account found with this email.';
      case 'auth/email-already-in-use': return 'An account with this email already exists.';
      case 'auth/weak-password': return 'Password must be at least 6 characters.';
      case 'auth/invalid-email': return 'Please enter a valid email address.';
      case 'auth/invalid-credential': return 'Invalid credentials. Please try again.';
      default: return 'Something went wrong. Please try again.';
    }
  };

  const triggerSuccessSequence = (route) => {
    setSuccessFlash(true);
    setTimeout(() => {
      navigate(route);
    }, 1200);
  };

  const handleGoogleSignIn = async () => {
    setErrorVisible(false);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if profile exists
      const userDocRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userDocRef);

      if (!userSnap.exists()) {
        // Create basic profile for new Google user with selected role
        await setDoc(userDocRef, {
          name: user.displayName || 'Anonymous User',
          email: user.email,
          role,
          createdAt: serverTimestamp(),
          onboarded: false
        });
        triggerSuccessSequence('/onboarding');
      } else {
        // Profile already exists - branch based on onboarding status
        const pData = userSnap.data();
        // Backfill role for older docs if missing (respect current selection)
        if (!pData.role) {
          await updateDoc(userDocRef, { role });
        }
        if (pData.onboarded) {
          triggerSuccessSequence('/dashboard');
        } else {
          triggerSuccessSequence('/onboarding');
        }
      }
    } catch (error) {
      console.error(error);
      // Some errors like popup-closed-by-user shouldn't be scary
      if (error.code === 'auth/popup-closed-by-user') return;
      
      setErrorMessage(mapFirebaseError(error.code));
      setErrorVisible(true);
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorVisible(false);

    try {
      if (activeTab === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
        triggerSuccessSequence('/dashboard');
      } else {
        // Sign up
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const { uid } = userCredential.user;
        
        // Write profile to firestore
        await setDoc(doc(db, 'users', uid), {
          name: fullName,
          email,
          role,
          createdAt: serverTimestamp(),
          onboarded: false
        });

        triggerSuccessSequence('/onboarding');
      }
    } catch (error) {
      console.error(error);
      // Auto-forward to signup if user is not found
      // Note: Newer Firebase projects group 'user-not-found' and 'wrong-password' into 'invalid-credential' 
      // for security (Email Enumeration Protection).
      if (activeTab === 'login' && (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential')) {
        setActiveTab('signup');
        setErrorMessage('Account not found (or invalid password). Please create an account or try again.');
        setErrorVisible(true);
        setIsLoading(false);
        return;
      }

      setErrorMessage(mapFirebaseError(error.code));
      setErrorVisible(true);
      setIsLoading(false);
    }
  };

  return (
    <motion.div 
      className="login-page"
      data-mode={dark ? "dark" : "light"}
      key={dark ? 'dark' : 'light'}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <style>{`
        .login-page {
          --lp-bg: #080604;
          --lp-surface: rgba(255,255,255,0.02);
          --lp-border: rgba(255,255,255,0.07);
          --lp-border2: rgba(255,255,255,0.12);
          --lp-gold: #d4af76;
          --lp-gold2: #b8965a;
          --lp-gold-dim: rgba(184,150,90,0.12);
          --lp-gold-glow: rgba(184,150,90,0.22);
          --lp-gold-border: rgba(184,150,90,0.4);
          --lp-text: #f0ede4;
          --lp-text2: #9c9888;
          --lp-text3: #5c5a52;
          --lp-text4: #3c3a34;
          --lp-red: #e07070;

          /* Default Dark Mode Values */
          --lp-card-radius: 18px;
          --lp-card-padding: 28px;
          --lp-card-backdrop: blur(20px);
          --lp-card-shadow: 0 8px 40px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05);
          --lp-card-top-accent: none;
          --lp-corner-border: rgba(184,150,90,0.3);
          
          --lp-google-bg: rgba(255,255,255,0.03);
          --lp-google-border: rgba(255,255,255,0.08);
          --lp-google-hover-bg: rgba(255,255,255,0.05);
          --lp-google-hover-border: rgba(255,255,255,0.13);

          --lp-tab-bg: rgba(255,255,255,0.03);
          --lp-tab-border: rgba(255,255,255,0.06);
          --lp-tab-default-color: var(--lp-text3);
          --lp-tab-active-bg: var(--lp-gold-dim);
          --lp-tab-active-color: var(--lp-gold);
          --lp-tab-active-border: rgba(184,150,90,0.25);
          --lp-tab-active-shadow: none;

          --lp-or-lines: rgba(255,255,255,0.06);

          --lp-input-bg: rgba(255,255,255,0.03);
          --lp-input-border: rgba(255,255,255,0.08);
          --lp-input-shadow: none;
          --lp-input-focus-border: rgba(184,150,90,0.45);
          --lp-input-focus-shadow: 0 0 0 3px rgba(184,150,90,0.08);

          --lp-submit-bg: var(--lp-gold-dim);
          --lp-submit-border: 1px solid var(--lp-gold-border);
          --lp-submit-color: var(--lp-gold);
          --lp-submit-shadow: none;
          --lp-submit-hover-bg: rgba(184,150,90,0.18);
          --lp-submit-hover-border: rgba(184,150,90,0.6);
          --lp-submit-hover-shadow: none;
          --lp-submit-hover-transform: none;

          --lp-role-bg: rgba(255,255,255,0.02);
          --lp-role-border: rgba(255,255,255,0.07);
          --lp-role-sel-bg: rgba(184,150,90,0.1);
          --lp-role-sel-border: rgba(184,150,90,0.35);
          --lp-role-sel-shadow: 0 0 0 3px rgba(184,150,90,0.08);

          --lp-forgot-color: var(--lp-text3);
          --lp-forgot-hover: var(--lp-gold);
          --lp-footer-color: #3c3a34;

          --lp-proof-avatars-border: rgba(184,150,90,0.3);
          --lp-proof-text: #9c9888;
        }

        .login-page[data-mode="light"] {
          --lp-bg: #f2ead8;
          --lp-surface: rgba(255,255,255,0.65);
          --lp-border: rgba(184,150,90,0.22);
          --lp-border2: rgba(184,150,90,0.30);
          --lp-gold: #9a7a42;
          --lp-gold2: #b8965a;
          --lp-gold-dim: rgba(184,150,90,0.10);
          --lp-gold-glow: rgba(184,150,90,0.20);
          --lp-gold-border: rgba(184,150,90,0.35);
          --lp-text: #1a1610;
          --lp-text2: #6b6248;
          --lp-text3: #9c9070;
          --lp-text4: #b8ae98;
          --lp-red: #c0473a;

          --lp-card-radius: 20px;
          --lp-card-padding: 32px;
          --lp-card-backdrop: blur(24px) saturate(1.4);
          --lp-card-shadow: 0 1px 0 rgba(255,255,255,1) inset, 0 -1px 0 rgba(184,150,90,0.1) inset, 0 20px 60px rgba(184,150,90,0.18), 0 4px 16px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04);
          --lp-card-top-accent: linear-gradient(90deg, transparent, #b8965a, #d4af76, #b8965a, transparent);
          --lp-corner-border: rgba(184,150,90,0.25);
          
          --lp-google-bg: rgba(255,255,255,0.7);
          --lp-google-border: rgba(0,0,0,0.08);
          --lp-google-hover-bg: rgba(255,255,255,0.95);
          --lp-google-hover-border: rgba(184,150,90,0.3);

          --lp-tab-bg: rgba(184,150,90,0.07);
          --lp-tab-border: rgba(184,150,90,0.15);
          --lp-tab-default-color: #9c9070;
          --lp-tab-active-bg: rgba(255,255,255,0.9);
          --lp-tab-active-color: #9a7a42;
          --lp-tab-active-border: rgba(184,150,90,0.25);
          --lp-tab-active-shadow: 0 1px 4px rgba(0,0,0,0.08);

          --lp-or-lines: rgba(0,0,0,0.08);

          --lp-input-bg: rgba(255,255,255,0.7);
          --lp-input-border: rgba(184,150,90,0.18);
          --lp-input-shadow: inset 0 2px 4px rgba(0,0,0,0.04), inset 0 0 0 1px rgba(255,255,255,0.8);
          --lp-input-focus-border: rgba(184,150,90,0.5);
          --lp-input-focus-shadow: 0 0 0 3px rgba(184,150,90,0.10), inset 0 2px 4px rgba(0,0,0,0.04);
          
          --lp-submit-bg: linear-gradient(135deg, #b8965a, #d4af76);
          --lp-submit-border: none;
          --lp-submit-color: #ffffff;
          --lp-submit-shadow: 0 4px 16px rgba(184,150,90,0.35), 0 1px 0 rgba(255,255,255,0.2) inset;
          --lp-submit-hover-bg: linear-gradient(135deg, #c4a264, #deba80);
          --lp-submit-hover-border: none;
          --lp-submit-hover-shadow: 0 6px 24px rgba(184,150,90,0.45);
          --lp-submit-hover-transform: translateY(-1px);

          --lp-role-bg: rgba(255,255,255,0.6);
          --lp-role-border: rgba(184,150,90,0.15);
          --lp-role-sel-bg: rgba(184,150,90,0.08);
          --lp-role-sel-border: rgba(184,150,90,0.4);
          --lp-role-sel-shadow: 0 0 0 3px rgba(184,150,90,0.10);

          --lp-forgot-color: #9c9070;
          --lp-forgot-hover: #9a7a42;
          --lp-footer-color: #b8ae98;

          --lp-proof-avatars-border: rgba(184,150,90,0.4);
          --lp-proof-text: #6b6248;
        }

        .login-page {
          position: relative;
          min-height: 100vh;
          background: var(--lp-bg);
          font-family: 'DM Sans', sans-serif;
          overflow: hidden;
        }

        .lp-bg-layer {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 0;
        }

        .login-page[data-mode="dark"] .lp-blobs {
          background: 
            radial-gradient(ellipse at 15% 85%, rgba(184,150,90,0.18) 0%, transparent 45%),
            radial-gradient(ellipse at 85% 15%, rgba(184,150,90,0.13) 0%, transparent 40%),
            radial-gradient(ellipse at 50% 50%, rgba(184,150,90,0.06) 0%, transparent 55%);
        }
        .login-page[data-mode="light"] .lp-blobs {
          background: 
            radial-gradient(ellipse at 10% 90%, rgba(184,150,90,0.28) 0%, rgba(184,150,90,0.08) 35%, transparent 60%),
            radial-gradient(ellipse at 90% 10%, rgba(212,175,118,0.22) 0%, rgba(184,150,90,0.06) 35%, transparent 55%),
            radial-gradient(ellipse at 50% 50%, rgba(184,150,90,0.08) 0%, transparent 60%),
            radial-gradient(ellipse at 50% 110%, rgba(196,136,42,0.18) 0%, transparent 50%);
        }

        .lp-texture {
          background: repeating-linear-gradient(45deg,
            rgba(184,150,90,0.06) 0, rgba(184,150,90,0.06) 1px,
            transparent 1px, transparent 30px);
        }
        
        .login-page[data-mode="light"] .lp-texture {
          background: repeating-linear-gradient(45deg,
            rgba(184,150,90,0.09) 0, rgba(184,150,90,0.09) 1px,
            transparent 1px, transparent 30px);
        }

        .login-page[data-mode="light"] .lp-hex::before {
          background-color: rgba(184,150,90,0.25) !important;
        }
        .login-page[data-mode="light"] .lp-hex::after {
          background-color: var(--lp-bg) !important;
        }

        .lp-foreground {
          position: relative;
          z-index: 10;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
        }

        .lp-theme-toggle {
          position: absolute;
          top: 20px;
          right: 24px;
          width: 52px;
          height: 28px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          cursor: pointer;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          z-index: 50;
        }
        .login-page[data-mode="light"] .lp-theme-toggle {
          background: rgba(184,150,90,0.12);
          border: 1px solid rgba(184,150,90,0.25);
        }

        .lp-tagline {
          font-family: 'DM Sans', sans-serif;
          font-size: 11px;
          color: var(--lp-text3);
          letter-spacing: 0.05em;
          text-align: center;
          margin-top: 6px;
        }

        .lp-divider-gold {
          width: 48px;
          height: 1px;
          background: linear-gradient(90deg, transparent, var(--lp-gold2), transparent);
          margin: 18px auto;
        }

        .lp-form-card {
          width: 100%;
          max-width: 380px;
          background: var(--lp-surface);
          border: 1px solid var(--lp-border);
          border-radius: var(--lp-card-radius);
          padding: var(--lp-card-padding);
          backdrop-filter: var(--lp-card-backdrop);
          box-shadow: var(--lp-card-shadow);
          position: relative;
        }
        .lp-card-top-accent {
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 3px;
          border-radius: var(--lp-card-radius) var(--lp-card-radius) 0 0;
          background: var(--lp-card-top-accent);
        }

        .lp-tab-switcher {
          display: flex;
          background: var(--lp-tab-bg);
          border: var(--lp-tab-border);
          border-radius: 10px;
          padding: 3px;
          margin-bottom: 18px;
          width: 100%;
        }

        .lp-tab {
          flex: 1;
          text-align: center;
          font-size: 13px;
          padding: 7px;
          border-radius: 8px;
          color: var(--lp-tab-default-color);
          font-family: 'DM Sans', sans-serif;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.18s;
        }

        .lp-tab.active {
          background: var(--lp-tab-active-bg);
          color: var(--lp-tab-active-color);
          border: var(--lp-tab-active-border);
          box-shadow: var(--lp-tab-active-shadow);
        }

        .lp-google-btn {
          width: 100%;
          background: var(--lp-google-bg);
          border: 1px solid var(--lp-google-border);
          border-radius: 10px;
          padding: 10px;
          font-size: 13px;
          font-family: 'DM Sans', sans-serif;
          color: var(--lp-text2);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          margin-bottom: 14px;
          transition: all 0.18s;
        }
        
        .lp-google-btn:hover {
          background: var(--lp-google-hover-bg);
          border-color: var(--lp-google-hover-border);
        }

        .lp-google-role-hint {
          font-size: 11px;
          color: var(--lp-text3);
          text-align: center;
          margin-top: -6px;
          margin-bottom: 10px;
          font-family: 'DM Sans', sans-serif;
        }

        .lp-google-role-hint strong {
          color: var(--lp-gold);
          font-weight: 700;
        }

        .lp-or-divider {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 4px 0 14px;
        }
        .lp-or-line {
          flex: 1;
          height: 1px;
          background: var(--lp-or-lines);
        }
        .lp-or-text {
          font-size: 11px;
          color: var(--lp-text4);
          font-family: 'DM Sans', sans-serif;
          text-transform: uppercase;
        }

        .lp-input {
          width: 100%;
          background: var(--lp-input-bg);
          border: 1px solid var(--lp-input-border);
          border-radius: 10px;
          padding: 10px 14px;
          font-size: 13px;
          color: var(--lp-text);
          font-family: 'DM Sans', sans-serif;
          margin-bottom: 10px;
          outline: none;
          transition: all 0.18s;
          box-shadow: var(--lp-input-shadow);
        }
        .lp-input::placeholder {
          color: var(--lp-text4);
        }
        .lp-input:focus {
          border-color: var(--lp-input-focus-border);
          box-shadow: var(--lp-input-focus-shadow);
        }

        .lp-submit-btn {
          width: 100%;
          background: var(--lp-submit-bg);
          border: var(--lp-submit-border);
          border-radius: 10px;
          padding: 11px;
          font-size: 13px;
          font-weight: 700;
          color: var(--lp-submit-color);
          font-family: 'DM Sans', sans-serif;
          letter-spacing: 0.02em;
          cursor: pointer;
          margin-top: 4px;
          transition: all 0.2s;
          box-shadow: var(--lp-submit-shadow);
        }
        .lp-submit-btn:hover:not(:disabled) {
          background: var(--lp-submit-hover-bg);
          border: var(--lp-submit-hover-border);
          box-shadow: var(--lp-submit-hover-shadow);
          transform: var(--lp-submit-hover-transform);
        }
        .lp-submit-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .lp-role-card {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          padding: 12px 8px;
          border-radius: 10px;
          border: 1px solid var(--lp-role-border);
          background: var(--lp-role-bg);
          cursor: pointer;
          transition: all 0.18s;
        }
        .lp-role-card.selected {
          background: var(--lp-role-sel-bg);
          border-color: var(--lp-role-sel-border);
          box-shadow: var(--lp-role-sel-shadow);
        }
        .lp-role-emoji { font-size: 22px; }
        .lp-role-label {
          font-size: 12px;
          font-weight: 600;
          color: var(--lp-text2);
          font-family: 'DM Sans', sans-serif;
        }
        .lp-role-card.selected .lp-role-label { color: var(--lp-gold); }

        .lp-eye-btn {
          position: absolute;
          right: 14px;
          top: 10px;
          background: transparent;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
        }
        .lp-eye-btn svg {
          stroke: var(--lp-text3);
          transition: stroke 0.18s;
        }
        .lp-eye-btn.active svg {
          stroke: var(--lp-gold);
        }

        .lp-forgot {
          font-size: 11px;
          color: var(--lp-forgot-color);
          cursor: pointer;
          text-align: right;
          margin-top: -4px;
          margin-bottom: 10px;
          display: block;
          transition: color 0.18s;
        }
        .lp-forgot:hover { color: var(--lp-forgot-hover); }

        .lp-error {
          font-size: 12px;
          color: var(--lp-red);
          margin-top: 8px;
          text-align: center;
          font-family: 'DM Sans', sans-serif;
        }
      `}</style>

      {/* THEME TOGGLE */}
      <div className="lp-theme-toggle" onClick={() => setDark(!dark)}>
        <motion.div
          animate={{ x: dark ? 26 : 2 }}
          transition={{ type: "spring", stiffness: 400, damping: 28 }}
          style={{
            width: '20px', height: '20px', borderRadius: '50%',
            background: 'var(--lp-gold)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: '12px'
          }}
        >
          {dark ? '🌙' : '☀️'}
        </motion.div>
      </div>

      {/* BACKGROUND LAYERS */}
      <div className="lp-bg-layer lp-blobs" />
      <div className="lp-bg-layer lp-texture" />
      <div className="lp-bg-layer" style={{ opacity: dark ? 0.04 : 0.18 }}>
        <HexagonBackground 
          hexagonSize={dark ? 90 : 65} 
          hexagonMargin={dark ? 4 : 3} 
          className="bg-transparent dark:bg-transparent"
          hexagonProps={{
            className: "lp-hex"
          }}
        />
      </div>

      {successFlash && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(184,150,90,0.06)', 
          opacity: 1, pointerEvents: 'none', animation: 'flash 1.2s ease-in-out forwards'
        }}>
          <style>{`
            @keyframes flash {
              0% { opacity: 0; }
              20% { opacity: 1; }
              100% { opacity: 0; }
            }
          `}</style>
        </div>
      )}

      {/* FOREGROUND CONTENT */}
      <div className="lp-foreground">
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0, duration: 0.5, ease: 'easeOut' }}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
        >
          <div style={{ '--text': dark ? '#f0ede4' : '#1a1610', '--accent': dark ? '#d4af76' : '#9a7a42' }}>
            <Logo size={48} showWordmark={true} />
          </div>
          <div className="lp-tagline">THE AI-ASSISTED MOCK INTERVIEW MARKETPLACE</div>
        </motion.div>

        <motion.div 
          className="lp-divider-gold"
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ delay: 0.12, duration: 0.4, ease: 'easeOut' }}
          style={{ originX: 0.5 }}
        />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4, ease: 'easeOut' }}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {[
              { in: 'PS', bg: dark ? '#2a1f0e' : '#e6dfd1', color: dark ? '#f0ede4' : '#4a3d28' },
              { in: 'AK', bg: dark ? '#1a2a1e' : '#d2dfd2', color: dark ? '#f0ede4' : '#2a4a28' },
              { in: 'MR', bg: dark ? '#1a1a2e' : '#d2d4df', color: dark ? '#f0ede4' : '#282d4a' },
              { in: 'TL', bg: dark ? '#2a1a1e' : '#dfd2d0', color: dark ? '#f0ede4' : '#4a2828' }
            ].map((avatar, i) => (
              <div key={i} style={{
                width: '28px', height: '28px', borderRadius: '50%', background: avatar.bg,
                border: '1.5px solid var(--lp-proof-avatars-border)', marginLeft: i > 0 ? '-8px' : '0',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '10px', fontWeight: 'bold', color: avatar.color,
                fontFamily: 'DM Sans, sans-serif'
              }}>
                {avatar.in}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ color: dark ? '#d4af76' : '#b8965a', fontSize: '11px', letterSpacing: '1px' }}>★★★★★</div>
            <div style={{ color: 'var(--lp-proof-text)', fontSize: '12px', fontFamily: 'DM Sans, sans-serif' }}>2,400+ sessions completed</div>
          </div>
        </motion.div>

        <motion.div
          className="lp-form-card"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.45, ease: 'easeOut' }}
        >
          <div className="lp-card-top-accent" />
          <div style={{ position: 'absolute', top: '-1px', left: '-1px', width: '16px', height: '16px', borderTop: '1px solid var(--lp-corner-border)', borderLeft: '1px solid var(--lp-corner-border)', borderTopLeftRadius: 'var(--lp-card-radius)' }} />
          <div style={{ position: 'absolute', top: '-1px', right: '-1px', width: '16px', height: '16px', borderTop: '1px solid var(--lp-corner-border)', borderRight: '1px solid var(--lp-corner-border)', borderTopRightRadius: 'var(--lp-card-radius)' }} />

          <div className="lp-tab-switcher">
            <div 
              className={`lp-tab ${activeTab === 'login' ? 'active' : ''}`}
              onClick={() => { setActiveTab('login'); setErrorVisible(false); }}
            >
              Log in
            </div>
            <div 
              className={`lp-tab ${activeTab === 'signup' ? 'active' : ''}`}
              onClick={() => { setActiveTab('signup'); setErrorVisible(false); }}
            >
              Sign up
            </div>
          </div>

          {activeTab === 'signup' && (
            <div style={{ display: 'flex', gap: '14px', marginBottom: '14px' }}>
              {[
                { id: 'candidate', label: 'Candidate', emoji: '🎯' },
                { id: 'expert', label: 'Expert', emoji: '🧠' }
              ].map(r => (
                <motion.div
                  key={`google-${r.id}`}
                  className={`lp-role-card ${role === r.id ? 'selected' : ''}`}
                  onClick={() => setRole(r.id)}
                  whileTap={{ scale: 0.97 }}
                  layout
                >
                  <div className="lp-role-emoji">{r.emoji}</div>
                  <div className="lp-role-label">{r.label}</div>
                </motion.div>
              ))}
            </div>
          )}

          <motion.button 
            type="button"
            className="lp-google-btn" 
            onClick={handleGoogleSignIn}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
          >
            {GOOGLE_ICON}
            Continue with Google
          </motion.button>

          {activeTab === 'signup' && (
            <div className="lp-google-role-hint">
              Signing up as: <strong>{role === 'expert' ? 'Expert' : 'Candidate'}</strong>
            </div>
          )}

          <div className="lp-or-divider">
            <div className="lp-or-line" />
            <div className="lp-or-text">or</div>
            <div className="lp-or-line" />
          </div>

          <form onSubmit={handleEmailAuth} style={{ display: 'flex', flexDirection: 'column' }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
              >
                {activeTab === 'signup' && (
                  <input
                    type="text"
                    required
                    placeholder="Full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="lp-input"
                  />
                )}

                <input
                  type="email"
                  required
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="lp-input"
                />

                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="lp-input"
                    style={{ paddingRight: '40px' }}
                  />
                  <button 
                    type="button"
                    className={`lp-eye-btn ${showPassword ? 'active' : ''}`}
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label="Toggle password visibility"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      {showPassword ? (
                        <>
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </>
                      ) : (
                        <>
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </>
                      )}
                    </svg>
                  </button>
                </div>

                {activeTab === 'login' && (
                  <span className="lp-forgot">Forgot password?</span>
                )}

                {errorVisible && (
                  <div className="lp-error">
                    {errorMessage}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            <motion.button 
              type="submit" 
              disabled={isLoading} 
              className="lp-submit-btn"
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.97 }}
            >
              {isLoading 
                ? "Please wait..." 
                : (activeTab === 'login' ? "Log in to RoundZero" : "Create my account →")}
            </motion.button>
          </form>

        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          style={{ fontSize: '11px', color: 'var(--lp-footer-color)', textAlign: 'center', marginTop: '16px', fontFamily: 'DM Sans, sans-serif' }}
        >
          By continuing you agree to our Terms & Privacy Policy
        </motion.div>
      </div>
    </motion.div>
  );
}
