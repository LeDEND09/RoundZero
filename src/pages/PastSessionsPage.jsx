import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  doc, getDoc, collection, query, where, onSnapshot
} from 'firebase/firestore';
import { format, parseISO } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import PageLayout from '../components/PageLayout';
import PageTransition from '../components/PageTransition';
import LoadingScreen from '../components/LoadingScreen';

import './PastSessionsPage.css';

/* ── helpers ── */
function getScoreClass(score) {
  if (score >= 8) return 'score-green';
  if (score >= 6) return 'score-amber';
  return 'score-red';
}

function getAccentClass(booking) {
  if (booking.status === 'cancelled') return 'accent-red';
  if (booking.feedback) return 'accent-green';
  return 'accent-border';
}

function isFeedbackReady(feedback) {
  if (!feedback) return false;
  if (feedback.status === 'completed') return true;
  if (feedback.isHardcoded === true) return true;
  const hasScore =
    typeof feedback.technicalScore === 'number' ||
    typeof feedback.communicationScore === 'number' ||
    typeof feedback.overallScore === 'number';
  return hasScore;
}

/* ── Animated score bar ── */
function ScoreBar({ label, score, colorClass }) {
  const pct = Math.round((score / 10) * 100);
  return (
    <div className="ps-bar-group">
      <div className="ps-bar-label-row">
        <span className="ps-bar-label">{label}</span>
        <span className="ps-bar-score">{score}/10</span>
      </div>
      <div className="ps-bar-track">
        <motion.div
          className={`ps-bar-fill ${colorClass}`}
          initial={{ width: 0 }}
          animate={{ width: pct + '%' }}
          transition={{ duration: 0.8, delay: 0.15, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

/* ── Expanded scorecard ── */
function Scorecard({ bookingId, initialFeedback }) {
  const [feedback, setFeedback] = useState(initialFeedback);
  const [showTranscript, setShowTranscript] = useState(false);

  useEffect(() => {
    if (isFeedbackReady(feedback) || feedback?.status === 'error') return;

    const unsub = onSnapshot(doc(db, 'feedback', bookingId), (docSnap) => {
      if (docSnap.exists()) {
        setFeedback(docSnap.data());
      }
    });
    return () => unsub();
  }, [bookingId, feedback?.status, feedback?.isHardcoded]);

  if (!feedback || (feedback.status === 'processing' && !isFeedbackReady(feedback))) {
    return (
      <div className="ps-pending-box" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px 0' }}>
        <motion.div 
          animate={{ rotate: 360 }} 
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--border2)', borderTopColor: 'var(--accent)', marginBottom: 12 }}
        />
        <div style={{ fontSize: 13, color: 'var(--text2)', textAlign: 'center' }}>
          Preparing your session feedback...
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
          It should appear shortly after session completion
        </div>
      </div>
    );
  }

  if (feedback.status === 'error') {
    return (
      <div className="ps-pending-box" style={{ padding: '30px 0' }}>
        <div style={{ color: 'var(--red)', fontSize: 13, textAlign: 'center' }}>
          ⚠ Feedback generation failed
        </div>
        {feedback?.errorMessage && (
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text3)', textAlign: 'center', padding: '0 18px' }}>
            {feedback.errorMessage}
          </div>
        )}
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text3)', textAlign: 'center', padding: '0 18px' }}>
          Please contact support if this continues for the same session.
        </div>
      </div>
    );
  }

  const {
    technicalScore = 0,
    communicationScore = 0,
    summary = '',
    strengths = [],
    improvements = [],
    transcript = ''
  } = feedback;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} style={{ paddingTop: 16 }}>
      {/* Score bars */}
      <div className="ps-score-bars">
        <ScoreBar label="Technical Score" score={technicalScore} colorClass="bar-accent" />
        <ScoreBar label="Communication Score" score={communicationScore} colorClass="bar-green" />
      </div>

      {/* Summary */}
      {summary && (
        <>
          <div className="ps-summary-label">Session summary</div>
          <div className="ps-summary-text">{summary}</div>
        </>
      )}

      {/* Strengths */}
      {strengths.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div className="ps-chip-label" style={{ color: 'var(--green)' }}>Strengths</div>
          <div className="ps-chips-row">
            {strengths.map((s, i) => (
              <span key={i} className="chip-green">{s}</span>
            ))}
          </div>
        </div>
      )}

      {/* Areas to improve */}
      {improvements.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div className="ps-chip-label" style={{ color: 'var(--amber)' }}>Improve</div>
          <div className="ps-chips-row">
            {improvements.map((s, i) => (
              <span key={i} className="chip-amber">{s}</span>
            ))}
          </div>
        </div>
      )}

      {/* Transcript */}
      {transcript && (
        <div style={{ marginTop: 24, marginBottom: 16 }}>
          <div 
            onClick={() => setShowTranscript(!showTranscript)}
            style={{ fontSize: 12, color: 'var(--accent)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            View full transcript {showTranscript ? '↑' : '↓'}
          </div>
          <AnimatePresence>
            {showTranscript && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                style={{ overflow: 'hidden' }}
              >
                <div style={{ 
                  marginTop: 12,
                  maxHeight: 200, 
                  overflowY: 'auto', 
                  background: 'var(--bg2)', 
                  borderRadius: 10, 
                  padding: 14, 
                  fontSize: 12, 
                  fontFamily: 'monospace', 
                  color: 'var(--text2)', 
                  lineHeight: 1.7,
                  whiteSpace: 'pre-wrap'
                }}>
                  {transcript}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <button className="ps-download-btn">↓ Download full report</button>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════ */
export default function PastSessionsPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');       // "All" | "Completed" | "Cancelled"
  const [expanded, setExpanded] = useState(null);   // booking id

  const handleToggleExpanded = useCallback((bookingId) => {
    setExpanded((prev) => (prev === bookingId ? null : bookingId));
  }, []);

  useEffect(() => {
    let unsubDocs = () => {};

    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      if (!u) return navigate('/login');

      try {
        const pDoc = await getDoc(doc(db, 'users', u.uid));
        if (!pDoc.exists()) return;
        const pData = pDoc.data();
        setProfile(pData);

        const isCand = pData.role === 'candidate';
        const roleKey = isCand ? 'candidateUid' : 'expertUid';
        const now = new Date();

        // Single-field query — no composite index needed
        // Filter status (confirmed/cancelled) and time (past) client-side
        const bQuery = query(
          collection(db, 'bookings'),
          where(roleKey, '==', u.uid)
        );

        let merged = {};

        const processSnap = async (snap) => {
          for (const docSnap of snap.docs) {
            const bData = docSnap.data();
            const sTime = bData.startTime?.toDate
              ? bData.startTime.toDate()
              : new Date(bData.startTime);

            // Only past sessions
            if (sTime >= now) continue;
            // Only confirmed, completed, or cancelled
            if (bData.status !== 'confirmed' && bData.status !== 'completed' && bData.status !== 'cancelled') continue;

            const otherId = isCand ? bData.expertUid : bData.candidateUid;
            let otherUser = {};
            try {
              const otherDoc = await getDoc(doc(db, 'users', otherId));
              otherUser = otherDoc.data() || {};
            } catch (_) {}

            // Try fetch feedback doc
            let feedback = null;
            try {
              const fbDoc = await getDoc(doc(db, 'feedback', docSnap.id));
              if (fbDoc.exists()) feedback = fbDoc.data();
            } catch (_) {}

            merged[docSnap.id] = {
              id: docSnap.id,
              ...bData,
              parsedStartTime: sTime,
              otherUser,
              feedback,
            };
          }

          const list = Object.values(merged).sort(
            (a, b) => b.parsedStartTime - a.parsedStartTime
          );
          setBookings(list);
          setLoading(false);
        };

        unsubDocs = onSnapshot(bQuery, async (snap) => {
          merged = {}; // reset on each snapshot
          await processSnap(snap);
        });

      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    });

    return () => { unsubAuth(); unsubDocs(); };
  }, [navigate]);

  /* ── derived ── */
  const filtered = useMemo(() => bookings.filter((b) => {
    if (filter === 'All') return true;
    if (filter === 'Completed') return b.status === 'confirmed' || b.status === 'completed';
    if (filter === 'Cancelled') return b.status === 'cancelled';
    return true;
  }), [bookings, filter]);

  const completedCount = useMemo(
    () => bookings.filter((b) => b.status === 'confirmed').length,
    [bookings]
  );

  if (!profile) return <LoadingScreen text="Loading..." />;

  const isCand = profile.role === 'candidate';

  return (
    <PageLayout>
      <PageTransition>
        <div className="ps-container">

          {/* Header */}
          <div className="ps-header-row">
            <div className="ps-header-left">
              <h1 className="ps-title">Past Sessions</h1>
              <p className="ps-subtitle">
                {loading ? '—' : completedCount} session{completedCount !== 1 ? 's' : ''} completed
              </p>
            </div>

            {/* Filters */}
            <div className="ps-filters">
              {['All', 'Completed', 'Cancelled'].map((f) => (
                <div
                  key={f}
                  className={`ps-filter-pill ${filter === f ? 'active' : ''}`}
                  onClick={() => setFilter(f)}
                >
                  {f}
                </div>
              ))}
            </div>
          </div>

          {/* Body */}
          {loading ? (
            [1, 2, 3].map((n) => <div key={n} className="ps-skel" />)
          ) : filtered.length === 0 ? (
            <motion.div
              className="ps-empty"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"
                strokeLinejoin="round" style={{ opacity: 0.25, color: 'var(--text2)' }}>
                <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              <div className="ps-empty-title">No past sessions yet</div>
              <div className="ps-empty-sub">
                Complete your first mock interview to see your progress here.
              </div>
              {isCand ? (
                <Link to="/explore" className="ps-empty-btn">Book a session →</Link>
              ) : (
                <Link to="/availability" className="ps-empty-btn">Set availability →</Link>
              )}
            </motion.div>
          ) : (
            <AnimatePresence mode="popLayout">
              {filtered.map((b, index) => {
                const isExpanded = expanded === b.id;
                const other = b.otherUser;
                const initials = other.name
                  ? other.name.substring(0, 2).toUpperCase()
                  : 'US';
                const tags = isCand
                  ? (other.domains || []).slice(0, 3)
                  : (other.techStack || []).slice(0, 3);

                const isCancelled = b.status === 'cancelled';
                const overallScore = isFeedbackReady(b.feedback)
                  ? ((b.feedback.technicalScore || 0) + (b.feedback.communicationScore || 0)) / 2
                  : null;

                return (
                  <motion.div
                    key={b.id}
                    layout
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.22, delay: index * 0.05 }}
                    className="ps-card"
                    onClick={() => handleToggleExpanded(b.id)}
                  >
                    {/* Left accent stripe */}
                    <div className={`ps-card-accent ${getAccentClass(b)}`} />

                    {/* Collapsed row */}
                    <div className="ps-card-row">
                      {/* Date */}
                      <div className="ps-date-block">
                        <div className="ps-date-day">
                          {b.parsedStartTime.getDate()}
                        </div>
                        <div className="ps-date-month">
                          {b.parsedStartTime.toLocaleDateString('en-US', { month: 'short' })}
                        </div>
                      </div>

                      <div className="ps-divider" />

                      {/* Info */}
                      <div className="ps-info">
                        <div className="ps-user-row">
                          {isCand ? (
                            <div className="ps-avatar-hex">{initials}</div>
                          ) : (
                            <div className="ps-avatar-circ">{initials}</div>
                          )}
                          <div>
                            <div className="ps-other-name">{other.name || 'User'}</div>
                            <div className="ps-other-role">
                              {isCand
                                ? `${other.title || 'Expert'} @ ${other.company || 'Unknown'}`
                                : `Targeting ${b.roleDescription || other.targetRole || 'Software Engineer'}`}
                            </div>
                          </div>
                        </div>
                        {tags.length > 0 && (
                          <div className="ps-domain-tags">
                            {tags.map((t) => (
                              <span key={t} className="ps-domain-tag">{t}</span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Right */}
                      <div className="ps-right">
                        {/* Status / score pill */}
                        {isCancelled ? (
                          <div className="ps-score-pill score-cancelled">Cancelled</div>
                        ) : overallScore !== null ? (
                          <div className={`ps-score-pill ${getScoreClass(overallScore)}`}>
                            {overallScore.toFixed(1)}
                          </div>
                        ) : (
                          <div className="ps-score-pill score-pending">Feedback pending</div>
                        )}

                        {b.feedback && (
                          <div className="ps-view-report">View report →</div>
                        )}

                        {/* Chevron */}
                        <motion.div
                          className="ps-chevron"
                          animate={{ rotate: isExpanded ? 180 : 0 }}
                          transition={{ duration: 0.22 }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2"
                            strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </motion.div>
                      </div>
                    </div>

                    {/* Expanded scorecard */}
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          className="ps-scorecard"
                          key="scorecard"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.28, ease: 'easeInOut' }}
                        >
                          <div className="ps-scorecard-inner">
                            <Scorecard bookingId={b.id} initialFeedback={b.feedback} />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </PageTransition>
    </PageLayout>
  );
}
