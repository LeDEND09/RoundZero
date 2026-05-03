import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useTheme } from '../lib/ThemeContext';
import { doc, getDoc, collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import PageLayout from '../components/PageLayout';
import LoadingScreen from '../components/LoadingScreen';
import './ProfilePages.css';

export default function ExpertProfilePage() {
  const { uid } = useParams();
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState(null);
  const { dark } = useTheme();
  const [expert, setExpert] = useState(null);
  const [slots, setSlots] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState('Available Sessions');

  useEffect(() => {
    let unsubSlots = () => {};
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        navigate('/login');
        return;
      }
      setCurrentUser(u);

      try {
        // 1. Fetch Expert Document
        const eDoc = await getDoc(doc(db, 'users', uid));
        if (!eDoc.exists() || eDoc.data().role !== 'expert') {
          setNotFound(true);
          setLoading(false);
          return;
        }
        setExpert({ id: eDoc.id, ...eDoc.data() });

        // 2. Live Availability Slots
        const sQuery = query(collection(db, 'availability', uid, 'slots'), where('isBooked', '==', false));
        unsubSlots();
        unsubSlots = onSnapshot(sQuery, (sSnap) => {
          let sArr = [];
          sSnap.forEach(d => {
            const data = d.data();
            const sTime = data.startTime?.toDate ? data.startTime.toDate() : new Date(data.startTime);
            if (sTime < new Date()) {
              // Auto-delete expired unbooked slots from the interviewer side
              if (u && u.uid === uid) {
                import('firebase/firestore').then(({ deleteDoc, doc }) => {
                  deleteDoc(doc(db, 'availability', uid, 'slots', d.id)).catch(() => {});
                });
              }
            } else {
              sArr.push({ id: d.id, ...data });
            }
          });
          sArr.sort((a,b) => {
            const dA = a.startTime?.toDate ? a.startTime.toDate() : new Date(a.startTime);
            const dB = b.startTime?.toDate ? b.startTime.toDate() : new Date(b.startTime);
            return dA - dB;
          });
          setSlots(sArr);
        });
        
        // 3. Fetch Recent Reviews
        try {
          const rQuery = query(collection(db, 'users', uid, 'reviews'));
          const rSnap = await getDocs(rQuery);
          let rArr = [];
          rSnap.forEach(d => rArr.push({ id: d.id, ...d.data() }));
          setReviews(rArr);
        } catch(err) {
          console.log("No reviews collection found");
        }

      } catch (err) {
        console.error("Failed to load expert profile:", err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    });

    return () => { unsub(); unsubSlots(); };
  }, [uid, navigate]);

  if (loading) return <LoadingScreen text="Loading profile..." />;
  
  if (notFound || !expert) return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--text)', textAlign: 'center' }}>
       <h1 style={{ fontFamily: 'Playfair Display', fontSize: '24px', marginBottom: '8px' }}>Expert not found</h1>
       <p style={{ color: 'var(--text2)', marginBottom: '24px' }}>This profile does not exist or has been removed.</p>
       <button onClick={() => navigate('/explore')} style={{ padding: '10px 20px', background: 'var(--accent)', color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>Back to Explore</button>
    </div>
  );

  const initials = expert.name ? expert.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'EX';
  const isSelf = currentUser && currentUser.uid === expert.id;

  const isSlotLive = (startTime) => {
    const slotDate = new Date(startTime);
    const now = new Date();
    const diffMs = slotDate - now;
    return diffMs > -1800000 && diffMs < 1800000;
  };

  const isSlotPast = (startTime) => {
    return new Date(startTime) < new Date();
  };

  return (
    <PageLayout>
      <div style={{ paddingBottom: '40px' }}>
        
        <Link to="/explore" style={{ display: 'inline-block', marginBottom: '20px', color: 'var(--text2)', textDecoration: 'none', fontSize: '13px', fontFamily: 'DM Sans' }}>
           <span style={{ fontSize: '18px', verticalAlign: 'middle', marginRight: '6px' }}>←</span> Back to experts
        </Link>

        {/* SECTION 1: EXPERT HERO */}
        <motion.div 
          className={`ep-hero-card ${dark ? 'dark' : 'light'}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="ep-hero-texture" />
          <div className="ep-hero-accent-bar" />
          
          <div className="ep-hero-content">
            <div className="ep-hero-left-col">
              <div className="ep-hex-outer">
                <div className="ep-hex-initials">{initials}</div>
              </div>
              <div className="ep-verified-badge">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ marginRight: '4px' }}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                Verified Expert
              </div>
            </div>

            <div className="ep-info-main">
              <h1 className="ep-info-name" style={{ 
                color: dark ? '#f0ede4' : '#1a1610', 
                fontFamily: 'Playfair Display, serif', 
                fontSize: '30px', 
                fontWeight: '700', 
                letterSpacing: '-0.025em',
                margin: 0
              }}>{expert.name}</h1>
              <div className="ep-info-sub" style={{ color: dark ? 'var(--text2)' : '#4a453e' }}>{expert.title || 'Expert'} · {expert.company || 'RoundZero'}</div>
              <div className="cp-chips-row" style={{ marginTop: '12px' }}>
                {(expert.domains || []).map(d => <span key={d} className="cp-target-role-pill" style={{ fontSize: '11px', padding: '4px 12px' }}>{d}</span>)}
              </div>
              <p className="ep-info-bio" style={{ color: dark ? 'var(--text2)' : '#6b655a' }}>{expert.bio || 'Professional expert dedicated to helping candidates ace their interviews.'}</p>
            </div>

            <div className="ep-rating-block">
              <div className="ep-rating-num">5.0</div>
              <div className="ep-stars-row">★★★★★</div>
              <div className="ep-rating-lbl">avg rating</div>
              <div className="ep-hero-divider" />
              <div className="ep-stats-grid-small">
                <div className="ep-stat-item-small">
                  <span className="ep-stat-val-small">12</span>
                  <span className="ep-stat-lbl-small" style={{ fontSize: '11px', color: 'rgba(240,237,228,0.5)', fontFamily: 'DM Sans, sans-serif', display: 'block', marginBottom: '10px' }}>sessions conducted</span>
                </div>
                <div className="ep-stat-item-small">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', justifyContent: 'flex-end', fontSize: '12px', color: '#5ab87e' }}>
                    <span style={{ fontSize: '8px' }}>●</span> 100% response rate
                  </div>
                </div>
              </div>
              {isSelf ? (
                 <button className="ep-edit-btn-hero" onClick={() => navigate('/profile')}>
                   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                   Edit Profile
                 </button>
              ) : (
                 <button className="ep-edit-btn-hero" style={{ background: 'var(--accent)', color: 'white', border: 'none' }} onClick={() => navigate(`/book/${expert.id}`)}>
                   Book Now
                 </button>
              )}
            </div>
          </div>
        </motion.div>

        {/* SECTION 2: METRIC CARDS */}
        <div className="ep-metric-strip">
          <motion.div className="ep-metric-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.0 }} style={{ borderLeft: '4px solid var(--accent)' }}>
            <div className="cp-stat-label">Sessions Conducted</div>
            <div className="cp-stat-value">12</div>
            <div className="cp-stat-sub">Lifetime sessions</div>
          </motion.div>
          <motion.div className="ep-metric-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 }}>
            <div className="cp-stat-label">Tech Depth</div>
            <div className="cp-stat-value">{expert.technicalDepth || 0}%</div>
            <div className="ep-metric-bar-track">
              <div className="ep-metric-bar-fill" style={{ width: `${expert.technicalDepth || 0}%` }} />
            </div>
          </motion.div>
          <motion.div className="ep-metric-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
            <div className="cp-stat-label">Comm Focus</div>
            <div className="cp-stat-value">{expert.communicationFocus || 0}%</div>
            <div className="ep-metric-bar-track">
              <div className="ep-metric-bar-fill" style={{ width: `${expert.communicationFocus || 0}%` }} />
            </div>
          </motion.div>
          <motion.div className="ep-metric-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.21 }}>
            <div className="cp-stat-label">Pressure</div>
            <div className="cp-stat-value">{expert.followUpPressure || 0}%</div>
            <div className="ep-metric-bar-track">
              <div className="ep-metric-bar-fill" style={{ width: `${expert.followUpPressure || 0}%` }} />
            </div>
          </motion.div>
        </div>

        {/* SECTION 3: TABBED CONTENT AREA */}
        <div className="ep-tabs-card">
          <div className="ep-tab-bar">
            {['Available Sessions', 'Interview Style', 'Reviews'].map(tab => (
              <button key={tab} className={`ep-tab-btn ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
                {tab}
              </button>
            ))}
          </div>
          
          <AnimatePresence mode="wait">
            <motion.div 
              key={activeTab}
              className="ep-tab-content"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'Available Sessions' && (
                <div>
                  {slots.length === 0 ? (
                    <div className="ep-empty" style={{ padding: '40px', textAlign: 'center' }}>
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.2, marginBottom: '12px' }}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                      <div style={{ color: 'var(--text3)' }}>No available slots found. Check back later!</div>
                    </div>
                  ) : (
                    slots.map(slot => {
                      const sTime = slot.startTime?.toDate ? slot.startTime.toDate() : new Date(slot.startTime);
                      const past = isSlotPast(sTime);
                      const live = isSlotLive(sTime);
                      
                      return (
                        <div key={slot.id} className={`ep-slot-row ${past ? 'past' : ''}`}>
                          <div className="ep-slot-date-block">
                            <div className="ep-slot-day">{sTime.getDate()}</div>
                            <div className="ep-slot-month">{sTime.toLocaleDateString('en-US', { month: 'short' })}</div>
                          </div>
                          <div className="ep-slot-v-line" />
                          <div className="ep-slot-info-main">
                            <div className="ep-slot-time-text">{sTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} ({slot.durationMinutes || 60} mins)</div>
                            <div className="ep-slot-row-meta">
                              {past ? (
                                <span style={{ background: 'rgba(192,71,58,0.1)', color: '#d4594a', border: '1px solid rgba(192,71,58,0.2)', borderRadius: '4px', padding: '2px 8px', fontSize: '10px', fontWeight: 600 }}>Expired</span>
                              ) : live ? (
                                <span className="cp-tag" style={{ padding: '2px 8px', fontSize: '10px', background: 'var(--accent-dim)', color: 'var(--accent)', borderColor: 'transparent' }}>Live</span>
                              ) : (
                                <span className="cp-tag" style={{ padding: '2px 8px', fontSize: '10px', background: 'var(--surface2)', color: 'var(--text3)', borderColor: 'var(--border2)' }}>Upcoming</span>
                              )}
                            </div>
                          </div>
                          {!past && <button className="ep-btn-book-ghost" onClick={() => navigate(`/book/${expert.id}`)}>Book session</button>}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {activeTab === 'Interview Style' && (
                <div className="ep-style-section">
                  <div className="ep-section-lbl-muted">How I conduct interviews</div>
                  
                  {[
                    { label: 'Technical Depth', val: expert.technicalDepth || 0, desc: 'How deep we go into systems and code' },
                    { label: 'Communication Focus', val: expert.communicationFocus || 0, desc: 'Weight given to soft skills and clarity' },
                    { label: 'Follow-up Pressure', val: expert.followUpPressure || 0, desc: 'Frequency and intensity of cross-questioning' }
                  ].map(style => (
                    <div key={style.label} className="ep-style-bar-group">
                      <div className="ep-style-bar-header">
                        <span className="ep-style-bar-label">{style.label}</span>
                        <span className="ep-style-bar-pct">{style.val}%</span>
                      </div>
                      <div className="ep-style-bar-desc">{style.desc}</div>
                      <div className="cp-stat-progress-track">
                        <div className="ep-style-bar-fill" style={{ width: `${style.val}%` }} />
                      </div>
                    </div>
                  ))}

                  <div className="ep-section-lbl-muted" style={{ marginTop: '24px' }}>In my sessions</div>
                  <div className="cp-chips-row">
                    {['Real-world problems', 'Detailed feedback', 'System Design focus', 'High pressure', 'Collaborative'].map(tag => (
                      <span key={tag} className="ep-expectation-chip">{tag}</span>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'Reviews' && (
                <div className="ep-reviews-section">
                  {reviews.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '40px' }}>No reviews yet — complete sessions to receive candidate reviews</div>
                  ) : (
                    reviews.map(rev => (
                      <div key={rev.id} className="ep-review-card">
                        <div className="ep-quote-mark">“</div>
                        <div className="ep-review-content">
                           <div className="ep-review-top-row">
                             <div className="ep-review-ava">{rev.candidateName?.[0] || 'C'}</div>
                             <div>
                               <div className="ep-review-name">{rev.candidateName || 'Candidate'}</div>
                               <div className="ep-review-role">Targeting {rev.targetRole || 'Engineer'}</div>
                             </div>
                             <div className="ep-review-stars-row">★★★★★</div>
                           </div>
                           <p className="ep-review-body-text">{rev.comment || rev.feedbackText || 'Excellent interviewer, provided actionable feedback.'}</p>
                           <div className="ep-review-date">{rev.createdAt?.toDate ? rev.createdAt.toDate().toLocaleDateString() : 'Recent'}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

      </div>
    </PageLayout>
  );
}
