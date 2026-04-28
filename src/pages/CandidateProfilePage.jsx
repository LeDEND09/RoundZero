import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { auth, db } from '../firebase';
import { useTheme } from '../lib/ThemeContext';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import PageLayout from '../components/PageLayout';
import LoadingScreen from '../components/LoadingScreen';
import './ProfilePages.css';

const CAND_EXP_OPTIONS = ["Fresher", "1–3 yrs", "3–5 yrs", "5–8 yrs", "8+ yrs"];
const EXPERT_EXP_OPTIONS = ["5–8 yrs", "8–10 yrs", "10+ yrs"];
const TECH_OPTS = ["React", "Node.js", "Python", "Go", "Java", "TypeScript", "AWS", "System Design", "SQL", "Docker", "Kubernetes", "GraphQL"];
const FOCUS_OPTS = ["Data Structures & Algorithms", "System Design", "Behavioural", "Frontend specific", "Backend specific", "Full mock interview"];
const DOMAIN_OPTS = ["Frontend", "Backend", "System Design", "DSA", "Mobile", "DevOps", "ML / AI", "Behavioural", "Full Stack"];

export default function CandidateProfilePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState({ totalBookings: 0, avgTech: '-', avgComm: '-' });
  const [recentSessions, setRecentSessions] = useState([]);
  const [successMsg, setSuccessMsg] = useState('');
  const { dark } = useTheme();

  // Expert specific data
  const [slots, setSlots] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [activeTab, setActiveTab] = useState('Available Sessions');

  useEffect(() => {
    let unsubSlots = () => {};
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        navigate('/login');
        return;
      }
      setUser(u);
      
      try {
        // Fetch User Profile
        const docRef = doc(db, 'users', u.uid);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          setProfile(data);
          setFormData(data);

          const isExpert = data.role === 'expert';
          const roleKey = isExpert ? 'expertUid' : 'candidateUid';
          
          // 1. Total bookings completed
          const bQuery = query(collection(db, 'bookings'), where(roleKey, '==', u.uid), where('status', '==', 'completed'));
          const bSnap = await getDocs(bQuery);
          const totals = bSnap.size;

          // 2. Feedback averages
          const fQuery = query(collection(db, 'feedback'), where(roleKey, '==', u.uid));
          const fSnap = await getDocs(fQuery);
          let techSum = 0, commSum = 0, count = 0;
          fSnap.forEach(doc => {
            const fb = doc.data();
            if (fb.technicalScore && fb.communicationScore) {
              techSum += fb.technicalScore;
              commSum += fb.communicationScore;
              count++;
            }
          });
          
          setStats({
            totalBookings: totals,
            avgTech: count > 0 ? (techSum / count).toFixed(1) : '-',
            avgComm: count > 0 ? (commSum / count).toFixed(1) : '-'
          });

          // 3. Fetch Top 3 Recent Sessions
          const sQuery = query(collection(db, 'bookings'), where(roleKey, '==', u.uid));
          const sSnap = await getDocs(sQuery);
          let sessList = [];
          const now = new Date();
          
          for (const d of sSnap.docs) {
            const b = d.data();
            const sTime = b.startTime?.toDate ? b.startTime.toDate() : new Date(b.startTime);
            if (sTime < now && (b.status === 'completed' || b.status === 'confirmed')) {
              // Fetch other user info
              const otherId = isExpert ? b.candidateUid : b.expertUid;
              const otherRef = doc(db, 'users', otherId);
              const otherSnap = await getDoc(otherRef);
              const oData = otherSnap.exists() ? otherSnap.data() : {};
              sessList.push({ 
                id: d.id, 
                ...b, 
                otherName: oData.name || 'User', 
                otherTitle: isExpert ? (oData.targetRole || 'Candidate') : (oData.title || 'Expert') 
              });
            }
          }
          sessList.sort((a,b) => {
            const dA = a.startTime?.toDate ? a.startTime.toDate() : new Date(a.startTime);
            const dB = b.startTime?.toDate ? b.startTime.toDate() : new Date(b.startTime);
            return dB - dA;
          });
          setRecentSessions(sessList.slice(0, 3));

          // 4. Expert specific data fetches (if expert)
          if (isExpert) {
             // Slots
             const slotsQuery = query(collection(db, 'availability', u.uid, 'slots'), where('isBooked', '==', false));
             unsubSlots = onSnapshot(slotsQuery, (sn) => {
               let sArr = [];
               sn.forEach(d => sArr.push({ id: d.id, ...d.data() }));
               sArr.sort((a,b) => (a.startTime?.toDate ? a.startTime.toDate() : new Date(a.startTime)) - (b.startTime?.toDate ? b.startTime.toDate() : new Date(b.startTime)));
               setSlots(sArr.slice(0, 5));
             });

             // Reviews
             const rQuery = query(collection(db, 'users', u.uid, 'reviews'));
             const rSnap = await getDocs(rQuery);
             let rArr = [];
             rSnap.forEach(d => rArr.push({ id: d.id, ...d.data() }));
             setReviews(rArr);
          }
        }

      } catch (err) {
        console.error("Error fetching profile", err);
      }
    });
    return () => { unsub(); unsubSlots(); };
  }, [navigate]);

  if (!profile) return <LoadingScreen text="Loading..." />;

  const initials = profile.name ? profile.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'USER';
  const isExpert = profile.role === 'expert';

  const toggleArrayItem = (arr, item) => {
    if (arr.includes(item)) return arr.filter(i => i !== item);
    return [...arr, item];
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), formData);
      setProfile(formData);
      setIsEditing(false);
      setSuccessMsg("✓ Profile updated!");
      setTimeout(() => setSuccessMsg(''), 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleEditToggle = () => {
    if (isEditing) {
      setFormData(profile);
      setIsEditing(false);
    } else {
      setIsEditing(true);
    }
  };

  const getTagStyle = (tech) => {
    const t = tech.toLowerCase();
    if (['react', 'vue', 'angular', 'next.js', 'typescript'].includes(t))
      return { 
        background: 'rgba(78,168,247,0.12)',
        color: '#4ea8f7',
        border: '1px solid rgba(78,168,247,0.2)'
      };
    if (['python', 'django', 'flask', 'node.js', 'node'].includes(t))
      return {
        background: 'rgba(74,158,110,0.12)',
        color: '#4a9e6e', 
        border: '1px solid rgba(74,158,110,0.2)'
      };
    if (['java', 'spring', 'kotlin', 'go', 'rust'].includes(t))
      return {
        background: 'rgba(245,166,35,0.12)',
        color: '#c4882a',
        border: '1px solid rgba(245,166,35,0.2)'
      };
    if (['aws', 'docker', 'kubernetes', 'k8s', 'devops'].includes(t))
      return {
        background: 'rgba(90,184,214,0.12)',
        color: '#5ab8d6',
        border: '1px solid rgba(90,184,214,0.2)'
      };
    if (['sql', 'postgresql', 'mysql', 'mongodb'].includes(t))
      return {
        background: 'rgba(150,120,247,0.12)',
        color: '#9678f7',
        border: '1px solid rgba(150,120,247,0.2)'
      };
    // default gold
    return {
      background: 'rgba(184,150,90,0.1)',
      color: '#b8965a',
      border: '1px solid rgba(184,150,90,0.2)'
    };
  };

  // --------------------------------------------------------
  // EXPERT VIEW RENDERING (Own Profile)
  // --------------------------------------------------------
  if (isExpert) {
    return (
      <PageLayout>
        <div style={{ paddingBottom: '40px' }}>
          
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
              <div>
                <div className="ep-hex-outer">
                  <div className="ep-hex-initials">{initials}</div>
                </div>
                <div className="ep-verified-badge">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ marginRight: '4px' }}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                  Verified Expert
                </div>
              </div>

              <div className="ep-info-main">
                <h1 className="ep-info-name" style={{ color: dark ? '#f0ede4' : '#1a1610' }}>{profile.name}</h1>
                <div className="ep-info-sub" style={{ color: dark ? 'var(--text2)' : '#4a453e' }}>{profile.title || 'Expert'} · {profile.company || 'RoundZero'}</div>
                <div className="ep-domain-tags" style={{ marginTop: '12px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {(profile.domains || []).map(d => <span key={d} className="cp-target-role-pill" style={{ fontSize: '11px', padding: '4px 12px' }}>{d}</span>)}
                </div>
                <p className="ep-info-bio" style={{ color: dark ? 'var(--text2)' : '#6b655a' }}>{profile.bio || 'Professional expert dedicated to helping candidates ace their interviews.'}</p>
              </div>

              <div className="ep-rating-block">
                <div className="ep-rating-num">5.0</div>
                <div className="ep-stars-row">★★★★★</div>
                <div className="ep-rating-lbl">avg rating</div>
                <div className="ep-hero-divider" />
                <div className="ep-stats-grid-small">
                  <div className="ep-stat-item-small">
                    <span className="ep-stat-val-small">{stats.totalBookings}</span>
                    <span className="ep-stat-lbl-small">Sessions</span>
                  </div>
                  <div className="ep-stat-item-small">
                    <span className="ep-stat-val-small">100%</span>
                    <span className="ep-stat-lbl-small">Response</span>
                  </div>
                </div>
                <button className="ep-edit-btn-hero" onClick={handleEditToggle}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                  Edit Profile
                </button>
              </div>
            </div>
          </motion.div>

          {/* SECTION 2: EXPERT METRIC CARDS */}
          <div className="ep-metric-strip">
            <motion.div className="ep-metric-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.0 }} style={{ borderLeft: '4px solid var(--accent)' }}>
              <div className="cp-stat-label">Sessions Conducted</div>
              <div className="cp-stat-value">{stats.totalBookings}</div>
              <div className="cp-stat-sub">Lifetime sessions</div>
            </motion.div>
            <motion.div className="ep-metric-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 }}>
              <div className="cp-stat-label">Tech Depth</div>
              <div className="cp-stat-value">{profile.technicalDepth || 50}%</div>
              <div className="ep-metric-bar-track">
                <div className="ep-metric-bar-fill" style={{ width: `${profile.technicalDepth || 50}%` }} />
              </div>
            </motion.div>
            <motion.div className="ep-metric-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
              <div className="cp-stat-label">Comm Focus</div>
              <div className="cp-stat-value">{profile.communicationFocus || 50}%</div>
              <div className="ep-metric-bar-track">
                <div className="ep-metric-bar-fill" style={{ width: `${profile.communicationFocus || 50}%` }} />
              </div>
            </motion.div>
            <motion.div className="ep-metric-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.21 }}>
              <div className="cp-stat-label">Pressure</div>
              <div className="cp-stat-value">{profile.followUpPressure || 50}%</div>
              <div className="ep-metric-bar-track">
                <div className="ep-metric-bar-fill" style={{ width: `${profile.followUpPressure || 50}%` }} />
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
                        <div style={{ color: 'var(--text3)' }}>No available slots found. Add slots in Availability page.</div>
                      </div>
                    ) : (
                      slots.map(slot => {
                        const sTime = slot.startTime?.toDate ? slot.startTime.toDate() : new Date(slot.startTime);
                        return (
                          <div key={slot.id} className="ep-slot-row">
                            <div className="ep-slot-date-block">
                              <div className="ep-slot-day">{sTime.getDate()}</div>
                              <div className="ep-slot-month">{sTime.toLocaleDateString('en-US', { month: 'short' })}</div>
                            </div>
                            <div className="ep-slot-v-line" />
                            <div className="ep-slot-info-main">
                              <div className="ep-slot-time-text">{sTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} (60 mins)</div>
                              <div className="ep-slot-row-meta">
                                <span className="cp-tag" style={{ padding: '2px 8px', fontSize: '10px', background: 'var(--accent-dim)', color: 'var(--accent)', borderColor: 'transparent' }}>Live</span>
                              </div>
                            </div>
                            <button className="ep-btn-book-ghost" onClick={() => navigate('/availability')}>Manage</button>
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
                      { label: 'Technical Depth', val: profile.technicalDepth, desc: 'How deep we go into systems and code' },
                      { label: 'Communication Focus', val: profile.communicationFocus, desc: 'Weight given to soft skills and clarity' },
                      { label: 'Follow-up Pressure', val: profile.followUpPressure, desc: 'Frequency and intensity of cross-questioning' }
                    ].map(style => (
                      <div key={style.label} className="ep-style-bar-group">
                        <div className="ep-style-bar-header">
                          <span className="ep-style-bar-label">{style.label}</span>
                          <span className="ep-style-bar-pct">{style.val || 50}%</span>
                        </div>
                        <div className="ep-style-bar-desc">{style.desc}</div>
                        <div className="cp-stat-progress-track">
                          <div className="ep-style-bar-fill" style={{ width: `${style.val || 50}%` }} />
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

          {/* SECTION 4: RECENT SESSIONS */}
          <div className="cp-sessions-card">
             <div className="cp-sessions-header">
                <h3 className="cp-sessions-title">Recent Sessions</h3>
                <span onClick={() => navigate('/past-sessions')} className="cp-view-all">View all →</span>
             </div>
             {recentSessions.length === 0 ? (
                <div className="cp-empty-state">
                  <div className="cp-empty-emoji">🚀</div>
                  <div className="cp-empty-title">Your journey starts here</div>
                  <div className="cp-empty-sub">Interview candidates to build your history</div>
                </div>
             ) : (
                <div className="cp-sessions-timeline">
                  {recentSessions.map(sess => (
                    <div key={sess.id} className="cp-session-cell">
                       <div className="cp-sess-expert">
                         <div className="cp-sess-avatar">{sess.otherName?.[0]}</div>
                         <div>
                           <div className="cp-sess-name">{sess.otherName}</div>
                           <div className="cp-sess-role">{sess.otherTitle}</div>
                         </div>
                       </div>
                       <div className="cp-sess-date">{new Date(sess.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                       <div className="cp-sess-bottom">
                         <span className="cp-status-pill">Completed</span>
                         <span className="cp-sess-score" style={{ color: 'var(--green)' }}>9.0</span>
                       </div>
                    </div>
                  ))}
                </div>
             )}
          </div>

          {/* EDIT OVERLAY */}
          <AnimatePresence>
            {isEditing && (
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
              >
                <motion.div 
                  initial={{ scale: 0.9, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.9, y: 20 }}
                  style={{ background: 'var(--surface)', width: '100%', maxWidth: '600px', borderRadius: '18px', padding: '32px', position: 'relative', border: '1px solid var(--border)' }}
                >
                   <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: '24px' }}>Edit Expert Profile</h2>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '70vh', overflowY: 'auto', paddingRight: '10px' }}>
                      <div>
                        <label className="cp-section-label">Name</label>
                        <input className="cp-input" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
                      </div>
                      <div>
                        <label className="cp-section-label">Professional Title</label>
                        <input className="cp-input" value={formData.title || ''} onChange={e => setFormData({...formData, title: e.target.value})} />
                      </div>
                      <div>
                        <label className="cp-section-label">Expertise Domains</label>
                        <div className="cp-chips-row">
                          {DOMAIN_OPTS.map(d => (
                            <span key={d} onClick={() => setFormData({...formData, domains: toggleArrayItem(formData.domains || [], d)})} className={`cp-chip ${formData.domains?.includes(d) ? '' : 'cp-tag-inactive'}`} style={{ cursor: 'pointer' }}>{d}</span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="cp-section-label">Bio</label>
                        <textarea className="cp-input" value={formData.bio || ''} onChange={e => setFormData({...formData, bio: e.target.value})} style={{ minHeight: '100px' }} />
                      </div>
                      <div>
                         <label className="cp-section-label">Interview Style</label>
                         <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {['technicalDepth', 'communicationFocus', 'followUpPressure'].map(key => (
                              <div key={key}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                                  <span>{key === 'technicalDepth' ? 'Tech Depth' : key === 'communicationFocus' ? 'Comm Focus' : 'Pressure'}</span>
                                  <span>{formData[key] || 50}%</span>
                                </div>
                                <input type="range" style={{ width: '100%' }} value={formData[key] || 50} onChange={e => setFormData({...formData, [key]: parseInt(e.target.value)})} />
                              </div>
                            ))}
                         </div>
                      </div>
                   </div>
                   <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
                     <button className="cp-save-btn" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
                     <button className="cp-ghost-btn" style={{ flex: 1 }} onClick={handleEditToggle}>Cancel</button>
                   </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </PageLayout>
    );
  }

  // --------------------------------------------------------
  // CANDIDATE VIEW RENDERING
  // --------------------------------------------------------
  const avgScore = ((stats.avgTech !== '-' ? parseFloat(stats.avgTech) : 0) + (stats.avgComm !== '-' ? parseFloat(stats.avgComm) : 0)) / 2;
  const readinessPercent = Math.round(avgScore * 10);

  return (
    <PageLayout>
      <div style={{ paddingBottom: '40px' }}>
        
        {/* SECTION 1: HERO BANNER */}
        <motion.div 
          className={`cp-hero-banner ${dark ? 'dark' : 'light'}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="cp-hero-watermark">R0</div>
          <div className="cp-hero-line" />
          
          <div className="cp-hero-content">
            <div className="cp-hero-avatar">{initials}</div>
            <div className="cp-hero-info">
              <h1 className="cp-hero-name" style={{ color: dark ? '#f0ede4' : '#1a1610' }}>{profile.name}</h1>
              <div className="cp-hero-role">{profile.targetRole || 'Software Engineering Candidate'}</div>
              <div className="cp-hero-email">{profile.email}</div>
            </div>
            
            <div className="cp-hero-right">
              <div className="cp-readiness-wrapper">
                <div className="cp-readiness-circle">
                  <svg width="72" height="72" viewBox="0 0 72 72">
                    <circle
                      cx="36" cy="36" r="30"
                      fill="none"
                      stroke="rgba(255,255,255,0.08)"
                      strokeWidth="5"
                    />
                    <motion.circle 
                      cx="36" cy="36" r="30"
                      fill="none"
                      stroke={readinessPercent > 70 ? '#4a9e6e' : readinessPercent > 40 ? '#c4882a' : '#c0473a'}
                      strokeWidth="5"
                      strokeLinecap="round"
                      strokeDasharray="188.5"
                      initial={{ strokeDashoffset: "188.5" }}
                      animate={{ strokeDashoffset: 188.5 - (readinessPercent / 100 * 188.5) }}
                      transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
                      transform="rotate(-90 36 36)"
                    />
                    <text
                      x="36" y="36"
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill={dark ? '#f0ede4' : '#1a1610'}
                      fontSize="14"
                      fontFamily="Playfair Display, serif"
                      fontWeight="700"
                    >
                      {readinessPercent}%
                    </text>
                  </svg>
                </div>
                <div className="cp-readiness-label">Ready</div>
              </div>
              <button className="cp-btn-edit-ghost" onClick={handleEditToggle}>Edit profile</button>
            </div>
          </div>
        </motion.div>

        {/* SECTION 2: STATS STRIP */}
        <div className="cp-stats-strip">
           <motion.div className="cp-stat-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.0 }} style={{ borderLeft: '4px solid var(--accent)' }}>
             <div className="cp-stat-label">Sessions</div>
             <div className="cp-stat-value">{stats.totalBookings}</div>
             <div className="cp-stat-sub">Total completed</div>
           </motion.div>
           <motion.div className="cp-stat-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 }} style={{ borderLeft: '4px solid #4a90d9' }}>
             <div className="cp-stat-label">Tech Score</div>
             <div className="cp-stat-value">{stats.avgTech === '-' ? '0.0' : stats.avgTech}</div>
             <div className="cp-stat-sub">Average rating</div>
           </motion.div>
           <motion.div className="cp-stat-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }} style={{ borderLeft: '4px solid var(--green)' }}>
             <div className="cp-stat-label">Comm Score</div>
             <div className="cp-stat-value">{stats.avgComm === '-' ? '0.0' : stats.avgComm}</div>
             <div className="cp-stat-sub">Average rating</div>
           </motion.div>
           <motion.div className="cp-stat-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.21 }} style={{ borderLeft: '4px solid var(--amber)' }}>
             <div className="cp-stat-label">Sessions to Goal</div>
             <div className="cp-stat-value">{stats.totalBookings}/10</div>
             <div className="cp-stat-progress-track">
                <div className="cp-stat-progress-fill" style={{ width: `${Math.min((stats.totalBookings / 10) * 100, 100)}%` }} />
             </div>
           </motion.div>
        </div>

        {/* SECTION 3: THREE COLUMN GRID */}
        <div className="cp-main-grid">
           
           {/* COLUMN 1: TARGETS */}
           <div className="cp-grid-card">
              <div className="cp-grid-header">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
                <h3 className="cp-grid-title">My Targets</h3>
              </div>
              <div className="cp-grid-body">
                 <div>
                   <div className="cp-section-label">Targeting</div>
                   <div className="cp-target-role-pill">{profile.targetRole || 'Software Engineer'}</div>
                 </div>
                 <div>
                   <div className="cp-section-label">Target Companies</div>
                   <div className="cp-chips-row">
                     {(profile.targetCompanies || '').split(',').map(c => c.trim()).filter(c => c).map(company => (
                       <span key={company} className="cp-chip">
                         <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="9" y1="22" x2="9" y2="18"></line><line x1="15" y1="22" x2="15" y2="18"></line><line x1="12" y1="22" x2="12" y2="18"></line></svg>
                         {company}
                       </span>
                     ))}
                     {(!profile.targetCompanies) && <span className="cp-chip" style={{ opacity: 0.5 }}>No companies added</span>}
                   </div>
                 </div>
                 <div>
                    <div className="cp-section-label">Interview Focus</div>
                    <div className="cp-focus-list">
                       {(profile.interviewFocus || []).map(f => (
                         <div key={f} className="cp-focus-item">
                           <span style={{ color: 'var(--accent)', fontWeight: 700 }}>✓</span>
                           {f}
                         </div>
                       ))}
                       {(!profile.interviewFocus || profile.interviewFocus.length === 0) && <span style={{ fontSize: '12px', color: 'var(--text3)' }}>No focus areas set</span>}
                    </div>
                 </div>
              </div>
           </div>

           {/* COLUMN 2: TECH STACK */}
           <div className="cp-grid-card">
              <div className="cp-grid-header">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
                <h3 className="cp-grid-title">My Stack</h3>
              </div>
              <div className="cp-grid-body">
                 <div className="cp-chips-row">
                    {(profile.techStack || []).map(t => (
                      <span key={t} style={{
                        ...getTagStyle(t),
                        borderRadius: '20px',
                        padding: '5px 12px',
                        fontSize: '12px',
                        fontWeight: '500',
                        fontFamily: 'DM Sans, sans-serif'
                      }}>
                        {t}
                      </span>
                    ))}
                    {(!profile.techStack || profile.techStack.length === 0) && <span style={{ fontSize: '12px', color: 'var(--text3)' }}>Add your stack for better matching</span>}
                 </div>
                 <div className="cp-exp-section">
                    <div className="cp-section-label">Experience Level</div>
                    <div className="cp-target-role-pill" style={{ marginTop: '6px', fontSize: '13px', padding: '6px 14px' }}>{profile.yearsOfExperience || 'Fresher'}</div>
                 </div>
              </div>
           </div>

           {/* COLUMN 3: EDIT PANEL */}
           <div className="cp-grid-card">
              <div className="cp-grid-header">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                <h3 className="cp-grid-title">Edit Profile</h3>
                {isEditing && (
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                    <button className="cp-save-btn" onClick={handleSave} style={{ fontSize: '11px', padding: '4px 12px' }}>Save</button>
                    <button className="cp-ghost-btn" onClick={handleEditToggle} style={{ fontSize: '11px', padding: '4px 12px' }}>Cancel</button>
                  </div>
                )}
              </div>
              <div className="cp-grid-body">
                 {!isEditing ? (
                   <div className="cp-edit-panel-empty">
                      <svg className="cp-edit-illustration" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                      <div className="cp-edit-title">Update your profile</div>
                      <div className="cp-edit-desc">Keep your targets and stack current for better expert matching</div>
                      <button className="cp-btn-edit-ghost" style={{ marginTop: '20px' }} onClick={handleEditToggle}>Modify Details</button>
                   </div>
                 ) : (
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div>
                        <label className="cp-section-label">Target Role</label>
                        <input className="cp-input" value={formData.targetRole || ''} onChange={e => setFormData({...formData, targetRole: e.target.value})} />
                      </div>
                      <div>
                        <label className="cp-section-label">Tech Stack</label>
                        <div className="cp-chips-row">
                           {TECH_OPTS.map(opt => (
                             <span key={opt} onClick={() => setFormData({...formData, techStack: toggleArrayItem(formData.techStack || [], opt)})} className={`cp-chip ${formData.techStack?.includes(opt) ? '' : 'cp-tag-inactive'}`} style={{ cursor: 'pointer' }}>{opt}</span>
                           ))}
                        </div>
                      </div>
                      <div>
                        <label className="cp-section-label">Interview Focus</label>
                        <div className="cp-chips-row">
                           {FOCUS_OPTS.map(opt => (
                             <span key={opt} onClick={() => setFormData({...formData, interviewFocus: toggleArrayItem(formData.interviewFocus || [], opt)})} className={`cp-chip ${formData.interviewFocus?.includes(opt) ? '' : 'cp-tag-inactive'}`} style={{ cursor: 'pointer' }}>{opt}</span>
                           ))}
                        </div>
                      </div>
                      <div>
                        <label className="cp-section-label">Target Companies</label>
                        <input className="cp-input" value={formData.targetCompanies || ''} onChange={e => setFormData({...formData, targetCompanies: e.target.value})} placeholder="Apple, Google, etc." />
                      </div>
                   </div>
                 )}
              </div>
           </div>
        </div>

        {/* SECTION 4: RECENT SESSIONS */}
        <div className="cp-sessions-card">
           <div className="cp-sessions-header">
              <h3 className="cp-sessions-title">Recent Sessions</h3>
              <span onClick={() => navigate('/past-sessions')} className="cp-view-all">View all →</span>
           </div>
           {recentSessions.length === 0 ? (
              <div className="cp-empty-state">
                <div className="cp-empty-emoji">🚀</div>
                <div className="cp-empty-title">Your journey starts here</div>
                <div className="cp-empty-sub">Book your first mock interview</div>
                <button className="cp-empty-btn" onClick={() => navigate('/explore')}>Find an Expert →</button>
              </div>
           ) : (
              <div className="cp-sessions-timeline">
                {recentSessions.map(sess => (
                  <div key={sess.id} className="cp-session-cell">
                     <div className="cp-sess-expert">
                       <div className="cp-sess-avatar">{sess.otherName?.[0]}</div>
                       <div>
                         <div className="cp-sess-name">{sess.otherName}</div>
                         <div className="cp-sess-role">{sess.otherTitle}</div>
                       </div>
                     </div>
                     <div className="cp-sess-date">{new Date(sess.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                     <div className="cp-sess-bottom">
                       <span className="cp-status-pill">Completed</span>
                       <span className="cp-sess-score" style={{ color: 'var(--green)' }}>{sess.technicalScore ? ((sess.technicalScore + sess.communicationScore)/2).toFixed(1) : '9.0'}</span>
                     </div>
                  </div>
                ))}
              </div>
           )}
        </div>

      </div>
    </PageLayout>
  );
}
