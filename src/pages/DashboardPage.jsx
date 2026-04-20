import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import PageLayout from '../components/PageLayout';
import PageTransition from '../components/PageTransition';
import LoadingScreen from '../components/LoadingScreen';

import './DashboardPage.css';

function formatDate(dateInput) {
  if (!dateInput) return '';
  const d = dateInput.toDate ? dateInput.toDate() : new Date(dateInput);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [pageError, setPageError] = useState(null);

  useEffect(() => {
    let unsubDocs = () => {};
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { navigate('/login'); return; }
      setUser(u);
      try {
        const pDoc = await getDoc(doc(db, 'users', u.uid));
        if (pDoc.exists()) {
          const pData = pDoc.data();
          setProfile(pData);
          const isCand = pData.role === 'candidate';
          // Listen to Bookings
          const bQuery = query(collection(db, 'bookings'), where(isCand ? 'candidateUid' : 'expertUid', '==', u.uid));
          const unsubB = onSnapshot(bQuery, (snap) => {
            const bList = [];
            snap.forEach(d => bList.push({ id: d.id, ...d.data() }));
            // Note: Since no composite indices exist yet, we fetch all for this user and sort/filter locally. For MVP scales this is perfectly fine.
            bList.sort((a,b) => {
              const dA = a.startTime?.toDate ? a.startTime.toDate() : new Date(a.startTime);
              const dB = b.startTime?.toDate ? b.startTime.toDate() : new Date(b.startTime);
              return dB - dA;
            });
            setBookings(bList);
          });
          // Listen to feedback only for candidates.
          // Experts do not need candidate feedback docs on dashboard.
          if (isCand) {
            const fQuery = query(collection(db, 'feedback'), where('candidateUid', '==', u.uid));
            const unsubF = onSnapshot(fQuery, (snap) => {
              const fList = [];
              snap.forEach(d => fList.push({ id: d.id, ...d.data() }));
              fList.sort((a,b) => {
                const dA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
                const dB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
                return dB - dA;
              });
              setFeedbacks(fList);
            });
            unsubDocs = () => { unsubB(); unsubF(); };
          } else {
            setFeedbacks([]);
            unsubDocs = () => { unsubB(); };
          }
        } else {
          navigate('/onboarding');
        }
      } catch (err) {
        console.error('Dashboard fetch error:', err);
        setPageError(err.message);
      }
    });
    return () => { unsub(); unsubDocs(); };
  }, [navigate]);

  if (pageError) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ color: 'var(--text2)', fontSize: 14 }}>
          Something went wrong loading the dashboard.
        </p>
        <button onClick={() => window.location.reload()} className="primary-btn" style={{ marginTop: 16 }}>
          Refresh page
        </button>
      </div>
    );
  }

  if (!profile) return <LoadingScreen text="Loading dashboard…" />;


  const isCandidate = profile.role === 'candidate';
  const now = new Date();
  const completedBookings = bookings.filter(b => b.status === 'completed');
  const upcomingBookings = bookings.filter(b => {
    const d = b.startTime?.toDate ? b.startTime.toDate() : new Date(b.startTime);
    return d > now && b.status === 'confirmed';
  }).sort((a, b) => {
    const dA = a.startTime?.toDate ? a.startTime.toDate() : new Date(a.startTime);
    const dB = b.startTime?.toDate ? b.startTime.toDate() : new Date(b.startTime);
    return dA - dB;
  });
  const nextSession = upcomingBookings[0];
  const recentSessions = completedBookings.slice(0, 4);
  const latestFeedback = feedbacks[0] || null;
  const completedFeedbacks = feedbacks.filter(f => f.status === 'completed');
  const avgTech = completedFeedbacks.length > 0
    ? (completedFeedbacks.reduce((acc, c) => acc + (c.technicalScore || 0), 0) / completedFeedbacks.length).toFixed(1) : '-';
  const avgComm = completedFeedbacks.length > 0
    ? (completedFeedbacks.reduce((acc, c) => acc + (c.communicationScore || 0), 0) / completedFeedbacks.length).toFixed(1) : '-';
  const uniqueCandidates = new Set(completedBookings.map(b => b.candidateUid)).size;

  const statVariants = {
    hidden: { opacity: 0, y: 16 },
    show: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.4, ease: 'easeOut' } })
  };

  return (
    <PageLayout>
      <PageTransition>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 4 }}>
            Welcome back, {(profile.name || 'User').split(' ')[0]} 👋
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text2)', fontFamily: 'var(--font-body)' }}>
            {isCandidate ? "Here's your interview preparation overview." : "Here's your mentoring activity at a glance."}
          </p>
        </div>

        {isCandidate ? (
          <>
            {/* CANDIDATE STATS */}
            <div className="dashboard-stats-row">
              {[
                { value: completedBookings.length, label: 'Sessions Completed' },
                { value: avgTech, label: 'Avg Tech Score' },
                { value: avgComm, label: 'Avg Comm Score' },
                { value: upcomingBookings.length, label: 'Upcoming Sessions' },
              ].map((s, i) => (
                <motion.div key={i} className="dash-stat-card" custom={i} variants={statVariants} initial="hidden" animate="show">
                  <span className="dash-stat-value">{s.value}</span>
                  <span className="dash-stat-label">{s.label}</span>
                </motion.div>
              ))}
            </div>

            <div className="dashboard-grid">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Next Session Banner */}
                <div className="next-session-banner">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600 }}>
                    <div className="pulse-dot" />
                    Next Session
                  </div>
                  {nextSession ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600 }}>{nextSession.expertName || 'Expert'}</div>
                        <div style={{ color: 'var(--text2)', fontSize: 13, marginTop: 4 }}>
                          {nextSession.domain || 'Mock Interview'} · {formatDate(nextSession.startTime)}
                        </div>
                      </div>
                      <Link to={`/room/${nextSession.streamCallId}`} className="primary-btn">Join Room →</Link>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ color: 'var(--text2)', fontSize: 14 }}>No upcoming sessions yet.</div>
                      <Link to="/explore" className="primary-btn">Book one now →</Link>
                    </div>
                  )}
                </div>

                {/* Recent Sessions */}
                <div className="dash-panel">
                  <div className="dash-panel-header">Recent Sessions</div>
                  <div className="dash-panel-body" style={{ padding: '0 22px' }}>
                    {recentSessions.length > 0 ? recentSessions.map(sess => (
                      <div key={sess.id} className="list-row">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div className="list-avatar">{(sess.expertName || 'EX').substring(0, 2).toUpperCase()}</div>
                          <div>
                            <div style={{ fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14 }}>{sess.expertName || 'Expert'}</div>
                            <div style={{ color: 'var(--text3)', fontSize: 12, fontFamily: 'var(--font-ui)' }}>{formatDate(sess.startTime)}</div>
                          </div>
                        </div>
                        <span className="completed-pill">Completed</span>
                      </div>
                    )) : (
                      <div className="empty-text" style={{ padding: '22px 0' }}>No past sessions found.</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Latest Scorecard */}
              <div className="dash-panel">
                <div className="dash-panel-header">
                  Latest Scorecard
                  {latestFeedback && <Link to="/reports" className="link-text">Full report →</Link>}
                </div>
                <div className="dash-panel-body">
                  {latestFeedback ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                      {[
                        { label: 'Technical', score: latestFeedback.technicalScore || 0 },
                        { label: 'Communication', score: latestFeedback.communicationScore || 0 },
                      ].map(({ label, score }) => (
                        <div key={label}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontFamily: 'var(--font-ui)', fontWeight: 500 }}>
                            <span>{label}</span>
                            <span style={{ color: 'var(--accent)' }}>{score}/10</span>
                          </div>
                          <div className="score-bar-track">
                            <motion.div
                              className="score-bar-fill"
                              initial={{ width: 0 }}
                              animate={{ width: `${(score / 10) * 100}%` }}
                              transition={{ duration: 1, ease: 'easeOut' }}
                            />
                          </div>
                        </div>
                      ))}
                      <div>
                        <div style={{ fontSize: 12, fontFamily: 'var(--font-ui)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)', marginBottom: 8 }}>Strengths</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {(latestFeedback.strengths || ['Problem Solving']).map((s, i) => <span key={i} className="tag-green">{s}</span>)}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontFamily: 'var(--font-ui)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)', marginBottom: 8 }}>To Improve</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {(latestFeedback.improvements || ['System Design Basics']).map((s, i) => <span key={i} className="tag-amber">{s}</span>)}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="empty-text">Complete a session to receive your first AI scorecard.</div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* EXPERT STATS */}
            <div className="dashboard-stats-row">
              {[
                { value: completedBookings.length, label: 'Sessions Conducted' },
                { value: uniqueCandidates, label: 'Candidates Interviewed' },
                { value: upcomingBookings.length, label: 'Upcoming Sessions' },
              ].map((s, i) => (
                <motion.div key={i} className="dash-stat-card" custom={i} variants={statVariants} initial="hidden" animate="show">
                  <span className="dash-stat-value">{s.value}</span>
                  <span className="dash-stat-label">{s.label}</span>
                </motion.div>
              ))}
            </div>

            <div className="dashboard-grid">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="dash-panel">
                  <div className="dash-panel-header">Upcoming Sessions</div>
                  <div className="dash-panel-body" style={{ padding: '0 22px' }}>
                    {upcomingBookings.length > 0 ? upcomingBookings.map(sess => (
                      <div key={sess.id} className="list-row">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div className="list-avatar">{(sess.candidateName || 'CA').substring(0, 2).toUpperCase()}</div>
                          <div>
                            <div style={{ fontWeight: 500, fontSize: 14 }}>{sess.candidateName || 'Candidate'}</div>
                            <div style={{ color: 'var(--text2)', fontSize: 12, fontFamily: 'var(--font-ui)' }}>{formatDate(sess.startTime)}</div>
                          </div>
                        </div>
                        <Link to={`/room/${sess.streamCallId}`} className="primary-btn">Join →</Link>
                      </div>
                    )) : <div className="empty-text" style={{ padding: '22px 0' }}>No upcoming sessions booked.</div>}
                  </div>
                </div>
                <div className="dash-panel">
                  <div className="dash-panel-header">Recent Sessions</div>
                  <div className="dash-panel-body" style={{ padding: '0 22px' }}>
                    {recentSessions.length > 0 ? recentSessions.map(sess => (
                      <div key={sess.id} className="list-row">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div className="list-avatar">{(sess.candidateName || 'CA').substring(0, 2).toUpperCase()}</div>
                          <div>
                            <div style={{ fontWeight: 500, fontSize: 14 }}>{sess.candidateName || 'Candidate'}</div>
                            <div style={{ color: 'var(--text3)', fontSize: 12, fontFamily: 'var(--font-ui)' }}>{formatDate(sess.startTime)}</div>
                          </div>
                        </div>
                      </div>
                    )) : <div className="empty-text" style={{ padding: '22px 0' }}>No past sessions found.</div>}
                  </div>
                </div>
              </div>

              <div className="dash-panel">
                <div className="dash-panel-header">Quick Actions</div>
                <div className="dash-panel-body" style={{ padding: '0 22px' }}>
                  {[
                    { label: 'Manage Availability', to: '/availability' },
                    { label: 'View My Profile', to: user ? `/expert/${user.uid}` : '/profile' },
                  ].map(({ label, to }, i) => (
                    <Link key={i} to={to} style={{ textDecoration: 'none' }}>
                      <div className="list-row" style={{ cursor: 'pointer', borderBottom: i === 0 ? undefined : 'none' }}>
                        <span style={{ fontSize: 14, fontFamily: 'var(--font-body)', fontWeight: 500 }}>{label}</span>
                        <span style={{ color: 'var(--accent)', fontSize: 16 }}>→</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </PageTransition>
    </PageLayout>
  );
}
