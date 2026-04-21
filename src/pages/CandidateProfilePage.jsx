import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import PageLayout from '../components/PageLayout';
import LoadingScreen from '../components/LoadingScreen';

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

  useEffect(() => {
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

          // Fetch Stats dynamically depending on role
          const roleKey = data.role === 'expert' ? 'expertUid' : 'candidateUid';
          
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
              // Fetch expert info
              const eRef = doc(db, 'users', b.expertUid);
              const eSnap = await getDoc(eRef);
              sessList.push({ id: d.id, ...b, expertName: eSnap.exists() ? eSnap.data().name : 'Expert', expertTitle: eSnap.exists() ? eSnap.data().title : 'Expert' });
            }
          }
          sessList.sort((a,b) => {
            const dA = a.startTime?.toDate ? a.startTime.toDate() : new Date(a.startTime);
            const dB = b.startTime?.toDate ? b.startTime.toDate() : new Date(b.startTime);
            return dB - dA;
          });
          setRecentSessions(sessList.slice(0, 3));
        }

      } catch (err) {
        console.error("Error fetching profile", err);
      }
    });
    return () => unsub();
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

  return (
    <PageLayout>
      <motion.div 
        initial={{ opacity: 0, y: 12 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.28, ease: "easeOut" }}
      >
        <style>{`
          .cp-header-card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 18px;
            box-shadow: var(--clay-shadow);
            padding: 32px;
            margin-bottom: 24px;
            position: relative;
            overflow: hidden;
            width: 100%;
          }
          .cp-header-top-accent {
            position: absolute;
            top: 0; left: 0; right: 0;
            height: 3px;
            background: linear-gradient(90deg, transparent, var(--accent), var(--accent2), var(--accent), transparent);
          }
          .cp-header-inner {
            display: flex;
            flex-direction: row;
            align-items: flex-start;
            gap: 28px;
          }
          
          .cp-avatar {
            width: 72px;
            height: 72px;
            border-radius: 50%;
            flex-shrink: 0;
            background: linear-gradient(135deg, var(--accent), var(--accent2));
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: var(--font-display);
            font-size: 24px;
            font-weight: 700;
            color: white;
            box-shadow: var(--clay-shadow);
            border: 3px solid rgba(184,150,90,0.2);
          }

          .cp-info-block {
            flex: 1;
          }
          .cp-name {
            font-family: var(--font-display);
            font-size: 24px;
            font-weight: 700;
            color: var(--text);
            letter-spacing: -0.02em;
            margin: 0;
          }
          .cp-role-pill {
            display: inline-flex;
            margin-top: 6px;
            background: var(--accent-dim);
            color: var(--accent);
            border: 1px solid var(--accent-glow);
            border-radius: 20px;
            padding: 4px 12px;
            font-size: 12px;
            font-weight: 600;
            font-family: var(--font-ui);
          }
          .cp-email {
            font-size: 13px;
            color: var(--text3);
            font-family: var(--font-body);
            margin-top: 6px;
          }

          .cp-edit-btn {
            margin-left: auto;
            align-self: flex-start;
            background: transparent;
            border: 1px solid var(--border2);
            color: var(--text2);
            border-radius: 8px;
            padding: 7px 16px;
            font-size: 12px;
            font-family: var(--font-ui);
            cursor: pointer;
            transition: all 0.2s;
          }
          .cp-edit-btn:hover {
            border-color: var(--accent);
            color: var(--accent);
          }

          .cp-stats-row {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
            margin-bottom: 24px;
          }
          .cp-stat-card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 14px;
            box-shadow: var(--clay-shadow);
            padding: 20px 22px;
            position: relative;
            overflow: hidden;
          }
          .cp-stat-accent {
            position: absolute;
            top: 0; left: 0; right: 0;
            height: 3px;
          }
          .cp-stat-label {
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: var(--text3);
            font-family: var(--font-ui);
            margin-bottom: 8px;
          }
          .cp-stat-val {
            font-family: var(--font-display);
            font-size: 32px;
            font-weight: 700;
            color: var(--text);
          }
          .cp-stat-val.empty {
            font-size: 24px;
            color: var(--text3);
          }
          .cp-stat-sub {
            font-size: 11px;
            color: var(--text3);
            font-family: var(--font-ui);
            margin-top: 4px;
          }

          .cp-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
          }
          .cp-card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 16px;
            box-shadow: var(--clay-shadow);
            overflow: hidden;
          }
          .cp-card-header {
            padding: 16px 22px;
            border-bottom: 1px solid var(--border);
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .cp-card-title {
            font-family: var(--font-display);
            font-size: 15px;
            font-weight: 600;
            color: var(--text);
            margin: 0;
          }
          .cp-card-body {
            padding: 22px;
            display: flex;
            flex-direction: column;
            gap: 20px;
          }

          .cp-sec-label {
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: var(--text3);
            font-family: var(--font-ui);
            margin-bottom: 8px;
          }

          .cp-exp-pill {
            background: var(--accent-dim);
            color: var(--accent);
            border: 1px solid var(--accent-glow);
            border-radius: 20px;
            padding: 5px 14px;
            font-size: 13px;
            font-weight: 500;
            display: inline-block;
          }
          
          .cp-tag-row {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
          }
          .cp-tech-tag {
            background: var(--bg2);
            color: var(--text2);
            border: 1px solid var(--border2);
            border-radius: 20px;
            padding: 4px 12px;
            font-size: 12px;
            font-family: var(--font-ui);
          }
          .cp-focus-tag {
            background: var(--accent-dim);
            color: var(--accent);
            border: 1px solid var(--accent-glow);
            border-radius: 20px;
            padding: 4px 12px;
            font-size: 12px;
            font-family: var(--font-ui);
          }
          .cp-tag-edit {
            cursor: pointer;
            transition: all 0.2s;
          }
          .cp-tag-edit:hover {
            opacity: 0.8;
          }
          .cp-tag-inactive {
            background: transparent;
            border: 1px solid var(--border2);
            color: var(--text3);
          }

          .cp-target-txt {
            font-size: 13px;
            color: var(--text);
            font-family: var(--font-body);
          }
          .cp-empty-txt {
            font-size: 13px;
            color: var(--text3);
            font-style: italic;
          }

          .cp-edit-prompt {
            padding: 40px 22px;
            text-align: center;
          }

          .cp-input {
            width: 100%;
            background: var(--surface2);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 10px 14px;
            font-size: 13px;
            color: var(--text);
            font-family: var(--font-body);
            box-shadow: var(--clay-inset);
            outline: none;
            transition: all 0.2s;
          }
          .cp-input:focus {
            border-color: var(--accent);
            box-shadow: 0 0 0 2px var(--accent-glow);
          }
          textarea.cp-input {
            resize: vertical;
            min-height: 80px;
          }

          .cp-save-btn {
            background: var(--accent);
            color: white;
            border: none;
            border-radius: 8px;
            padding: 8px 18px;
            font-size: 13px;
            font-family: var(--font-ui);
            cursor: pointer;
            transition: all 0.2s;
          }
          .cp-save-btn:hover {
            opacity: 0.9;
          }
          .cp-ghost-btn {
            background: transparent;
            color: var(--text2);
            border: none;
            padding: 8px 18px;
            font-size: 13px;
            font-family: var(--font-ui);
            cursor: pointer;
            transition: all 0.2s;
          }
          .cp-ghost-btn:hover {
            color: var(--text);
          }

          .cp-session-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 16px;
            background: var(--bg2);
            border-radius: 10px;
            border: 1px solid var(--border);
          }
          .cp-sess-info {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .cp-sess-ava {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: var(--accent-dim);
            color: var(--accent);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: 700;
          }
          .cp-sess-name {
             font-size: 14px;
             font-weight: 600;
             color: var(--text);
          }
          .cp-sess-meta {
             font-size: 12px;
             color: var(--text3);
          }
        `}</style>

        <div style={{ paddingBottom: '40px' }}>
          
          {/* PROFILE HEADER CARD */}
          <div className="cp-header-card">
            <div className="cp-header-top-accent" />
            <div className="cp-header-inner">
              <div className="cp-avatar">{initials}</div>
              
              <div className="cp-info-block">
                <h1 className="cp-name">{profile.name}</h1>
                <div className="cp-role-pill">
                  {isExpert ? (profile.title || 'Expert') : (profile.targetRole || 'Candidate')}
                </div>
                <div className="cp-email">{profile.email}</div>
              </div>

              {!isEditing && (
                <button className="cp-edit-btn" onClick={handleEditToggle}>Edit profile</button>
              )}
            </div>
          </div>

          {/* STATS ROW */}
          <div className="cp-stats-row">
            <motion.div className="cp-stat-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.0 }}>
              <div className="cp-stat-accent" style={{ background: 'var(--accent)' }} />
              <div className="cp-stat-label">Sessions</div>
              <div className="cp-stat-val">{stats.totalBookings}</div>
              <div className="cp-stat-sub">Total completed</div>
            </motion.div>

            <motion.div className="cp-stat-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
              <div className="cp-stat-accent" style={{ background: 'var(--green)' }} />
              <div className="cp-stat-label">Tech score</div>
              <div className={`cp-stat-val ${stats.avgTech === '-' ? 'empty' : ''}`}>{stats.avgTech === '-' ? '—' : stats.avgTech}</div>
              <div className="cp-stat-sub">Average rating</div>
            </motion.div>

            <motion.div className="cp-stat-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
              <div className="cp-stat-accent" style={{ background: '#4a90d9' }} />
              <div className="cp-stat-label">Comm score</div>
              <div className={`cp-stat-val ${stats.avgComm === '-' ? 'empty' : ''}`}>{stats.avgComm === '-' ? '—' : stats.avgComm}</div>
              <div className="cp-stat-sub">Average rating</div>
            </motion.div>
          </div>

          {/* TWO COLUMN LAYOUT */}
          <div className="cp-grid">
            
            {/* LEFT CARD - Profile Details */}
            <div className="cp-card">
              <div className="cp-card-header">
                <h3 className="cp-card-title">Profile details</h3>
              </div>
              <div className="cp-card-body">
                
                <div>
                  <div className="cp-sec-label">Years of Experience</div>
                  {profile.yearsOfExperience ? (
                    <div className="cp-exp-pill">{profile.yearsOfExperience}</div>
                  ) : (
                    <span className="cp-empty-txt">Not specified</span>
                  )}
                </div>

                <div>
                  <div className="cp-sec-label">Tech Stack</div>
                  <div className="cp-tag-row">
                    {(profile.techStack || []).length > 0 ? (
                      profile.techStack.map(t => <span key={t} className="cp-tech-tag">{t}</span>)
                    ) : (
                      <span className="cp-empty-txt">Not specified</span>
                    )}
                  </div>
                </div>

                {isExpert ? (
                  <>
                    <div>
                      <div className="cp-sec-label">Current Company</div>
                      {profile.company ? (
                        <div className="cp-target-txt">{profile.company}</div>
                      ) : (
                        <span className="cp-empty-txt">Not specified</span>
                      )}
                    </div>
                    <div>
                      <div className="cp-sec-label">Bio</div>
                      {profile.bio ? (
                        <div className="cp-target-txt" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{profile.bio}</div>
                      ) : (
                        <span className="cp-empty-txt">Not specified</span>
                      )}
                    </div>
                    <div>
                      <div className="cp-sec-label">Expertise Domains</div>
                      <div className="cp-tag-row">
                        {(profile.domains || []).length > 0 ? (
                          profile.domains.map(d => <span key={d} className="cp-focus-tag">{d}</span>)
                        ) : (
                          <span className="cp-empty-txt">Not specified</span>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <div className="cp-sec-label">Interview Focus</div>
                      <div className="cp-tag-row">
                        {(profile.interviewFocus || []).length > 0 ? (
                          profile.interviewFocus.map(f => <span key={f} className="cp-focus-tag">{f}</span>)
                        ) : (
                          <span className="cp-empty-txt">Not specified</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="cp-sec-label">Target Companies</div>
                      {profile.targetCompanies ? (
                        <div className="cp-target-txt">{profile.targetCompanies}</div>
                      ) : (
                        <span className="cp-empty-txt">Not specified</span>
                      )}
                    </div>
                  </>
                )}

              </div>
            </div>

            {/* RIGHT CARD - Edit Mode */}
            <div className="cp-card">
              <div className="cp-card-header">
                <h3 className="cp-card-title">Edit profile</h3>
                {isEditing && (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <AnimatePresence>
                      {successMsg && (
                        <motion.span initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} style={{ color: 'var(--green)', fontSize: '13px', fontFamily: 'var(--font-ui)' }}>
                          {successMsg}
                        </motion.span>
                      )}
                    </AnimatePresence>
                    <button className="cp-ghost-btn" onClick={handleEditToggle} disabled={saving}>Cancel</button>
                    <button className="cp-save-btn" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                  </div>
                )}
              </div>
              
              {!isEditing ? (
                <div className="cp-edit-prompt">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3, margin: '0 auto 10px auto', display: 'block' }}>
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                  <div style={{ fontSize: '13px', color: 'var(--text3)' }}>Click Edit profile to update your details</div>
                </div>
              ) : (
                <div className="cp-card-body">
                  
                  <div>
                    <div className="cp-sec-label">Name</div>
                    <input className="cp-input" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
                  </div>

                  {isExpert && (
                    <div>
                      <div className="cp-sec-label">Title</div>
                      <input className="cp-input" value={formData.title || ''} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="e.g. Senior Software Engineer" />
                    </div>
                  )}

                  <div>
                    <div className="cp-sec-label">Years of Experience</div>
                    <div className="cp-tag-row">
                      {(isExpert ? EXPERT_EXP_OPTIONS : CAND_EXP_OPTIONS).map(exp => (
                        <span key={exp} onClick={() => setFormData({...formData, yearsOfExperience: exp})} className={`cp-exp-pill cp-tag-edit ${formData.yearsOfExperience === exp ? '' : 'cp-tag-inactive'}`}>{exp}</span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="cp-sec-label">Tech Stack</div>
                    <div className="cp-tag-row">
                      {TECH_OPTS.map(opt => (
                        <span key={opt} onClick={() => setFormData({...formData, techStack: toggleArrayItem(formData.techStack || [], opt)})} className={`cp-tech-tag cp-tag-edit ${(formData.techStack || []).includes(opt) ? '' : 'cp-tag-inactive'}`}>{opt}</span>
                      ))}
                    </div>
                  </div>

                  {isExpert ? (
                    <>
                      <div>
                        <div className="cp-sec-label">Current Company</div>
                        <input className="cp-input" value={formData.company || ''} onChange={e => setFormData({...formData, company: e.target.value})} placeholder="e.g. Stripe, AWS" />
                      </div>
                      <div>
                        <div className="cp-sec-label">Expertise Domains</div>
                        <div className="cp-tag-row">
                          {DOMAIN_OPTS.map(opt => (
                            <span key={opt} onClick={() => setFormData({...formData, domains: toggleArrayItem(formData.domains || [], opt)})} className={`cp-focus-tag cp-tag-edit ${(formData.domains || []).includes(opt) ? '' : 'cp-tag-inactive'}`}>{opt}</span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="cp-sec-label">Bio</div>
                        <textarea className="cp-input" value={formData.bio || ''} onChange={e => setFormData({...formData, bio: e.target.value})} placeholder="Short bio about yourself..." />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <div className="cp-sec-label">Interview Focus</div>
                        <div className="cp-tag-row">
                          {FOCUS_OPTS.map(focus => (
                            <span key={focus} onClick={() => setFormData({...formData, interviewFocus: toggleArrayItem(formData.interviewFocus || [], focus)})} className={`cp-focus-tag cp-tag-edit ${(formData.interviewFocus || []).includes(focus) ? '' : 'cp-tag-inactive'}`}>{focus}</span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="cp-sec-label">Target Companies</div>
                        <input className="cp-input" value={formData.targetCompanies || ''} onChange={e => setFormData({...formData, targetCompanies: e.target.value})} placeholder="e.g. Google, Stripe, Atlassian" />
                      </div>
                    </>
                  )}

                </div>
              )}
            </div>

          </div>

          {/* RECENT SESSIONS SECTION */}
          <div className="cp-card" style={{ marginTop: '24px' }}>
            <div className="cp-card-header">
              <h3 className="cp-card-title">Recent Past Sessions</h3>
              <button onClick={() => navigate('/past-sessions')} className="cp-edit-btn" style={{ margin: 0 }}>View all</button>
            </div>
            <div className="cp-card-body" style={{ gap: '12px' }}>
              {recentSessions.length === 0 ? (
                <div className="cp-empty-txt" style={{ textAlign: 'center', padding: '20px 0' }}>No past sessions found yet.</div>
              ) : (
                recentSessions.map(sess => {
                  const sInitials = sess.expertName.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();
                  const sDate = sess.startTime?.toDate ? sess.startTime.toDate() : new Date(sess.startTime);
                  return (
                    <div key={sess.id} className="cp-session-item">
                       <div className="cp-sess-info">
                         <div className="cp-sess-ava">{sInitials}</div>
                         <div>
                           <div className="cp-sess-name">{sess.expertName}</div>
                           <div className="cp-sess-meta">{sess.expertTitle} · {sDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                         </div>
                       </div>
                       <div style={{ color: 'var(--green)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Completed</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
      </motion.div>
    </PageLayout>
  );
}
