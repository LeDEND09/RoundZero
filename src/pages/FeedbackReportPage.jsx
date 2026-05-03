import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { motion } from 'framer-motion';
import PageLayout from '../components/PageLayout';
import PageTransition from '../components/PageTransition';

import './FeedbackReportPage.css';

/* ── Helpers ── */

function isFeedbackReady(fb) {
  if (!fb) return false;
  if (fb.status === 'processing' || fb.status === 'error') return false;
  return !!(fb.summary || fb.technicalScore || fb.overallScore);
}

function ratingClass(rating) {
  const r = (rating || '').toLowerCase();
  if (r === 'excellent') return 'excellent';
  if (r === 'good') return 'good';
  if (r === 'needs work') return 'needs-work';
  if (r === 'poor') return 'poor';
  return 'good';
}

function recClass(rec) {
  const r = (rec || '').toUpperCase();
  if (r === 'STRONG HIRE') return 'strong-hire';
  if (r === 'HIRE') return 'hire';
  if (r === 'BORDERLINE') return 'borderline';
  if (r === 'NO HIRE') return 'no-hire';
  return 'borderline';
}

function recEmoji(rec) {
  const r = (rec || '').toUpperCase();
  if (r === 'STRONG HIRE' || r === 'HIRE') return '👍';
  if (r === 'BORDERLINE') return '🤔';
  if (r === 'NO HIRE') return '👎';
  return '🤔';
}

/* ── Stagger animation config ── */
const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, delay: i * 0.1, ease: 'easeOut' }
  })
};

/* ══════════════════════════════════════════════
   FEEDBACK REPORT PAGE
══════════════════════════════════════════════ */
export default function FeedbackReportPage() {
  const { bookingId } = useParams();
  const navigate = useNavigate();

  const [feedback, setFeedback] = useState(null);
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) return navigate('/login');

      try {
        const [fbDoc, bDoc] = await Promise.all([
          getDoc(doc(db, 'feedback', bookingId)),
          getDoc(doc(db, 'bookings', bookingId))
        ]);

        if (fbDoc.exists()) setFeedback(fbDoc.data());
        if (bDoc.exists()) setBooking(bDoc.data());
      } catch (err) {
        console.warn('FeedbackReport fetch error:', err.message);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, [bookingId, navigate]);

  /* ── Loading ── */
  if (loading) {
    return (
      <PageLayout>
        <PageTransition>
          <div className="fr-loading">
            <motion.div
              className="fr-loading-spinner"
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
            />
          </div>
        </PageTransition>
      </PageLayout>
    );
  }

  /* ── Pending / Not Ready ── */
  if (!isFeedbackReady(feedback)) {
    return (
      <PageLayout>
        <PageTransition>
          <div className="fr-container">
            <button className="fr-back" onClick={() => navigate('/past-sessions')}>
              ← Back to Sessions
            </button>
            <div className="fr-pending-wrapper">
              <motion.div
                className="fr-pending"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
              >
                <motion.div
                  className="fr-pending-icon"
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                />
                <div className="fr-pending-title">Feedback is being processed…</div>
                <div className="fr-pending-sub">
                  Your AI feedback report will be ready within 5 minutes of your session ending.
                  Check back shortly!
                </div>
              </motion.div>
            </div>
          </div>
        </PageTransition>
      </PageLayout>
    );
  }

  /* ── Destructure feedback ── */
  const {
    overallRating = 'Good',
    recommendation = 'BORDERLINE',
    overallScore = 0,
    technicalScore = 0,
    communicationScore = 0,
    problemSolvingScore = 0,
    summary = '',
    technical = '',
    communication = '',
    problemSolving = '',
    codeQuality = '',
    strengths = [],
    improvements = [],
    flaws = [],
    roadmap = [],
    expertCorroboration = '',
    gradedBy = ''
  } = feedback;

  const roleDescription = booking?.roleDescription || 'Software Engineer';

  let ci = 0; // card index for stagger

  return (
    <PageLayout>
      <PageTransition>
        <div className="fr-container">

          {/* ── Back ── */}
          <button className="fr-back" onClick={() => navigate('/past-sessions')}>
            ← Back to Sessions
          </button>

          {/* ── 1. HEADER ── */}
          <motion.div
            className="fr-header"
            custom={ci++}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
          >
            <h1 className="fr-title">AI Feedback Report</h1>
            <div className="fr-badges">
              <span className="fr-role-badge">{roleDescription}</span>
              {gradedBy === 'gemini' && (
                <span className="fr-ai-badge">AI Graded ✦</span>
              )}
            </div>
          </motion.div>

          {/* ── 2. OVERALL RATING HERO ── */}
          <motion.div
            className="fr-hero"
            custom={ci++}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
          >
            <div className="fr-hero-label">Overall Rating</div>
            <div className={`fr-hero-rating ${ratingClass(overallRating)}`}>
              {overallRating}
            </div>
            <div className={`fr-rec-pill ${recClass(recommendation)}`}>
              <span>{recEmoji(recommendation)}</span>
              {recommendation}
            </div>
            <div className="fr-hero-score">
              Score: <strong>{overallScore}</strong>/10
            </div>
          </motion.div>

          {/* ── 3. SCORE ROW ── */}
          <motion.div
            className="fr-scores-row"
            custom={ci++}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
          >
            <div className="fr-score-chip">
              <div className="fr-score-chip-label">Technical</div>
              <div className="fr-score-chip-value">
                {technicalScore}<span>/10</span>
              </div>
            </div>
            <div className="fr-score-chip">
              <div className="fr-score-chip-label">Communication</div>
              <div className="fr-score-chip-value">
                {communicationScore}<span>/10</span>
              </div>
            </div>
            <div className="fr-score-chip">
              <div className="fr-score-chip-label">Problem Solving</div>
              <div className="fr-score-chip-value">
                {problemSolvingScore}<span>/10</span>
              </div>
            </div>
          </motion.div>

          {/* ── 4. SUMMARY ── */}
          {summary && (
            <motion.div
              className="fr-card"
              custom={ci++}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
            >
              <div className="fr-section-label">
                <div className="fr-section-icon">📋</div>
                Summary
              </div>
              <div className="fr-section-text">{summary}</div>
            </motion.div>
          )}

          {/* ── 5. SECTION CARDS ── */}
          {technical && (
            <motion.div
              className="fr-card"
              custom={ci++}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
            >
              <div className="fr-section-label">
                <div className="fr-section-icon">⚙</div>
                Technical
              </div>
              <div className="fr-section-text">{technical}</div>
            </motion.div>
          )}

          {communication && (
            <motion.div
              className="fr-card"
              custom={ci++}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
            >
              <div className="fr-section-label">
                <div className="fr-section-icon">💬</div>
                Communication
              </div>
              <div className="fr-section-text">{communication}</div>
            </motion.div>
          )}

          {problemSolving && (
            <motion.div
              className="fr-card"
              custom={ci++}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
            >
              <div className="fr-section-label">
                <div className="fr-section-icon">🧩</div>
                Problem Solving
              </div>
              <div className="fr-section-text">{problemSolving}</div>
            </motion.div>
          )}

          {codeQuality && codeQuality !== 'N/A' && (
            <motion.div
              className="fr-card"
              custom={ci++}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
            >
              <div className="fr-section-label">
                <div className="fr-section-icon">✨</div>
                Code Quality
              </div>
              <div className="fr-section-text">{codeQuality}</div>
            </motion.div>
          )}

          {/* ── 6. THREE COLUMN INSIGHTS ── */}
          {(strengths.length > 0 || improvements.length > 0 || flaws.length > 0) && (
            <motion.div
              className="fr-insights-grid"
              custom={ci++}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
            >
              {strengths.length > 0 && (
                <div className="fr-insight-card green">
                  <div className="fr-insight-title">Strengths</div>
                  <ul className="fr-insight-list">
                    {strengths.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}
              {improvements.length > 0 && (
                <div className="fr-insight-card amber">
                  <div className="fr-insight-title">Improvements</div>
                  <ul className="fr-insight-list">
                    {improvements.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}
              {flaws.length > 0 && (
                <div className="fr-insight-card red">
                  <div className="fr-insight-title">Critical Flags</div>
                  <ul className="fr-insight-list">
                    {flaws.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}
            </motion.div>
          )}

          {/* ── 7. ROADMAP ── */}
          {roadmap.length > 0 && (
            <motion.div
              className="fr-roadmap"
              custom={ci++}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
            >
              <div className="fr-roadmap-title">
                <span className="roadmap-icon">🗺</span>
                Your Study Roadmap
              </div>
              <ol className="fr-roadmap-list">
                {roadmap.map((item, i) => <li key={i}>{item}</li>)}
              </ol>
            </motion.div>
          )}

          {/* ── 8. EXPERT CORROBORATION ── */}
          {expertCorroboration && (
            <motion.div
              className="fr-corroboration"
              custom={ci++}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
            >
              <div className="fr-corroboration-label">
                <span>≈</span>
                Expert vs AI Corroboration
              </div>
              <div className="fr-corroboration-text">{expertCorroboration}</div>
            </motion.div>
          )}

        </div>
      </PageTransition>
    </PageLayout>
  );
}
