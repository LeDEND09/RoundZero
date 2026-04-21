import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import PageLayout from '../components/PageLayout';
import LoadingScreen from '../components/LoadingScreen';

export default function ExpertProfilePage() {
  const { uid } = useParams();
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState(null);
  const [expert, setExpert] = useState(null);
  const [slots, setSlots] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

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

        // 2. Live Availability Slots (isBooked == false)
        const sQuery = query(collection(db, 'availability', uid, 'slots'), where('isBooked', '==', false));
        unsubSlots();
        unsubSlots = onSnapshot(sQuery, (sSnap) => {
          let sArr = [];
          sSnap.forEach(d => sArr.push({ id: d.id, ...d.data() }));
          sArr.sort((a,b) => {
            const dA = a.startTime?.toDate ? a.startTime.toDate() : new Date(a.startTime);
            const dB = b.startTime?.toDate ? b.startTime.toDate() : new Date(b.startTime);
            return dA - dB;
          });
          setSlots(sArr.slice(0, 5)); // Keep top 5 upcoming
        });
        
        // 3. Fetch Recent Reviews
        try {
          const rQuery = query(collection(db, 'users', uid, 'reviews'));
          const rSnap = await getDocs(rQuery);
          let rArr = [];
          rSnap.forEach(d => rArr.push({ id: d.id, ...d.data() }));
          rArr.sort((a,b) => {
            const dA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
            const dB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
            return dB - dA;
          });
          setReviews(rArr.slice(0, 2));
        } catch(err) {
          console.log("No reviews collection found or inaccessible.");
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
       <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', marginBottom: '8px' }}>Expert not found</h1>
       <p style={{ color: 'var(--text2)', marginBottom: '24px' }}>This profile does not exist or has been removed.</p>
       <button onClick={() => navigate('/explore')} style={{ padding: '10px 20px', background: 'var(--accent)', color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>Back to Explore</button>
    </div>
  );

  const initials = expert.name ? expert.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'EX';
  const isSelf = currentUser && currentUser.uid === expert.id;

  const diffColors = ['diff-junior', 'diff-mid', 'diff-senior', 'diff-staff'];

  // Clean years of experience
  const cleanYears = expert.yearsOfExperience 
    ? expert.yearsOfExperience.toString().replace(/ yrs/gi, '').replace(/\+/g, '').trim() 
    : '5';

  return (
    <PageLayout>
      <motion.div 
        initial={{ opacity: 0, y: 12 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.28, ease: "easeOut" }}
      >
        <style>{`
          .ep-hero-card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 18px;
            box-shadow: var(--clay-shadow);
            padding: 32px;
            margin-bottom: 24px;
            position: relative;
            overflow: hidden;
            display: flex;
            gap: 24px;
            align-items: stretch;
          }
          .ep-hero-top-accent {
            position: absolute;
            top: 0; left: 0; right: 0;
            height: 3px;
            background: linear-gradient(90deg, transparent, var(--accent), var(--accent2), var(--accent), transparent);
          }
          .ep-hero-left {
            flex: 0 0 auto;
          }
          .ep-hero-right {
            margin-left: auto;
            text-align: right;
            flex-shrink: 0;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            min-width: 140px;
          }
          
          .ep-hex-wrapper {
            width: 94px;
            height: 94px;
            padding: 3px;
            background: var(--accent-dim);
            clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
          }
          .ep-hex-inner {
            width: 88px;
            height: 88px;
            clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
            background: linear-gradient(135deg, var(--accent), var(--accent2));
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: var(--font-display);
            font-size: 28px;
            font-weight: 700;
            color: white;
          }

          .ep-name {
            font-family: var(--font-display);
            font-size: 32px;
            font-weight: 700;
            color: var(--text);
            letter-spacing: -0.03em;
            margin-top: 18px;
            line-height: 1.1;
          }
          .ep-title {
            font-size: 15px;
            font-weight: 500;
            color: var(--text2);
            margin-top: 6px;
          }
          .ep-verified {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            background: var(--green-dim);
            color: var(--green);
            border: 1px solid var(--green-dim);
            border-radius: 6px;
            padding: 4px 10px;
            font-size: 11px;
            font-weight: 600;
            font-family: var(--font-ui);
            margin-top: 12px;
            box-shadow: 0 0 10px rgba(74, 158, 110, 0.05);
          }
          .ep-bio {
            font-size: 13px;
            color: var(--text2);
            line-height: 1.65;
            max-width: 480px;
            margin-top: 10px;
          }
          .ep-domain-tags {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin-top: 12px;
          }
          .ep-tag {
            background: var(--accent-dim);
            color: var(--accent);
            border: 1px solid var(--accent-glow);
            border-radius: 20px;
            padding: 4px 12px;
            font-size: 11px;
            font-weight: 500;
            font-family: var(--font-ui);
          }

          .ep-star-row {
            display: flex;
            align-items: center;
            gap: 6px;
            justify-content: flex-end;
          }
          .ep-stars {
            color: #d4af76;
            font-size: 16px;
          }
          .ep-rating-num {
            font-family: var(--font-display);
            font-size: 38px;
            font-weight: 700;
            color: var(--text);
            line-height: 1;
          }
          .ep-rating-label {
            font-size: 12px;
            color: var(--text3);
            display: block;
            margin-top: 4px;
            text-align: right;
            font-weight: 500;
          }
          
          .ep-mini-stats {
            display: flex;
            flex-direction: row;
            gap: 24px;
            margin-top: 24px;
            justify-content: flex-end;
          }
          .ep-stat-val {
            font-family: var(--font-display);
            font-size: 16px;
            font-weight: 700;
            color: var(--text);
          }
          .ep-stat-lbl {
            font-size: 11px;
            color: var(--text3);
            font-family: var(--font-ui);
            display: block;
          }

          .ep-book-btn {
            margin-top: 20px;
            display: block;
            width: 100%;
            background: var(--accent);
            color: white;
            border: none;
            border-radius: 10px;
            padding: 11px 20px;
            font-family: var(--font-ui);
            font-size: 13px;
            font-weight: 600;
            box-shadow: var(--clay-shadow);
            cursor: pointer;
            transition: all 0.2s;
          }
          .ep-book-btn:hover {
            transform: translateY(-1px);
            box-shadow: var(--clay-hover);
          }

          .ep-grid {
            display: grid;
            grid-template-columns: 1fr 320px;
            gap: 20px;
          }

          .ep-card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 16px;
            box-shadow: var(--clay-shadow);
            overflow: hidden;
          }
          .ep-card-header {
            padding: 16px 22px;
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          .ep-card-title {
            font-family: var(--font-display);
            font-size: 15px;
            font-weight: 600;
            color: var(--text);
            margin: 0;
          }
          
          .ep-live-pill {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            background: var(--green-dim);
            color: var(--green);
            border-radius: 20px;
            padding: 3px 10px;
            font-size: 11px;
          }
          .ep-pulse {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: var(--green);
            animation: epPulse 1.5s infinite;
          }
          @keyframes epPulse {
            0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(74, 158, 110, 0.7); }
            70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(74, 158, 110, 0); }
            100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(74, 158, 110, 0); }
          }

          .ep-slot-row {
            padding: 14px 22px;
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            gap: 16px;
            transition: background 0.15s;
          }
          .ep-slot-row:hover {
            background: var(--bg2);
          }
          .ep-date-block {
            width: 44px;
            text-align: center;
            flex-shrink: 0;
          }
          .ep-day-num {
            font-family: var(--font-display);
            font-size: 20px;
            font-weight: 700;
            color: var(--text);
            display: block;
          }
          .ep-month {
            font-size: 10px;
            color: var(--text3);
            text-transform: uppercase;
            font-family: var(--font-ui);
            letter-spacing: 0.06em;
            display: block;
          }
          .ep-slot-div {
            width: 1px;
            height: 36px;
            background: var(--border2);
            flex-shrink: 0;
          }
          .ep-slot-info {
            flex: 1;
          }
          .ep-slot-time {
            font-size: 13px;
            font-weight: 500;
            color: var(--text);
            font-family: var(--font-body);
          }
          .ep-slot-meta {
            display: flex;
            flex-direction: row;
            gap: 6px;
            margin-top: 4px;
            align-items: center;
          }
          .ep-slot-book {
            margin-left: auto;
            background: transparent;
            border: 1px solid var(--border2);
            color: var(--text2);
            border-radius: 8px;
            padding: 6px 14px;
            font-size: 12px;
            font-family: var(--font-ui);
            cursor: pointer;
            transition: all 0.15s;
          }
          .ep-slot-book:hover {
            background: var(--accent);
            color: white;
            border-color: var(--accent);
          }
          
          .ep-empty {
            padding: 40px;
            text-align: center;
          }

          .ep-right-stack {
            display: flex;
            flex-direction: column;
            gap: 16px;
          }
          .ep-card-pad {
            padding: 22px;
          }
          .ep-bar-row {
            margin-bottom: 14px;
          }
          .ep-bar-label {
            font-size: 12px;
            color: var(--text2);
            font-family: var(--font-ui);
            margin-bottom: 6px;
            display: flex;
            justify-content: space-between;
          }
          .ep-bar-pct {
            font-size: 12px;
            color: var(--accent);
            font-weight: 600;
          }
          .ep-bar-track {
            height: 4px;
            background: var(--bg3);
            border-radius: 4px;
            overflow: hidden;
            position: relative;
          }
          .ep-bar-fill {
            height: 100%;
            border-radius: 4px;
            background: linear-gradient(90deg, var(--accent), var(--accent2));
            box-shadow: 0 0 10px var(--accent-glow);
          }
          .ep-footer-note {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 11px;
            color: var(--text3);
            margin-top: 8px;
          }

          .ep-rev-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
          }
          .ep-see-all {
            font-size: 12px;
            color: var(--accent);
            font-family: var(--font-ui);
            cursor: pointer;
          }
          .ep-rev-item {
            padding-bottom: 14px;
            border-bottom: 1px solid var(--border);
            margin-bottom: 14px;
          }
          .ep-rev-item:last-child {
            border-bottom: none;
            margin-bottom: 0;
            padding-bottom: 0;
          }
          .ep-rev-top {
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .ep-rev-ava {
            width: 28px;
            height: 28px;
            border-radius: 50%;
            background: var(--accent-dim);
            color: var(--accent);
            font-size: 11px;
            font-weight: 700;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .ep-rev-name {
            font-size: 13px;
            font-weight: 600;
            color: var(--text);
          }
          .ep-rev-stars {
            margin-left: auto;
            color: #d4af76;
            font-size: 11px;
          }
          .ep-rev-role {
            font-size: 11px;
            color: var(--text3);
            margin-top: 2px;
            margin-left: 38px;
          }
          .ep-rev-text {
            font-size: 12px;
            color: var(--text2);
            line-height: 1.6;
            margin-top: 8px;
            margin-bottom: 0;
          }

          /* MOBILE OPTIMIZATIONS */
          @media (max-width: 768px) {
            .ep-hero-card {
              flex-direction: column;
              padding: 24px;
              align-items: center;
              text-align: center;
              gap: 20px;
            }
            .ep-hero-left {
              display: flex;
              flex-direction: column;
              align-items: center;
              width: 100%;
            }
            .ep-hero-right {
              margin-left: 0;
              width: 100%;
              text-align: center;
              align-items: center;
              margin-top: 10px;
              gap: 12px;
              min-width: 0;
            }
            .ep-star-row, .ep-mini-stats {
              justify-content: center;
              width: 100%;
            }
            .ep-rating-label {
              text-align: center;
            }
            .ep-mini-stats {
              margin-top: 16px;
            }
            .ep-grid {
              grid-template-columns: 1fr;
            }
            .ep-name {
              font-size: 28px;
              margin-top: 14px;
            }
            .ep-bio {
              max-width: 100%;
              margin-top: 12px;
            }
            .ep-domain-tags {
              justify-content: center;
            }
            .ep-book-btn {
              margin-top: 16px;
              max-width: 280px;
            }
          }
        `}</style>

        <div style={{ paddingBottom: '40px' }}>
          <Link to="/explore" style={{ display: 'inline-block', marginBottom: '20px', color: 'var(--text2)', textDecoration: 'none', fontSize: '14px', fontFamily: 'var(--font-ui)' }}>
             <span style={{ fontSize: '18px', verticalAlign: 'middle', marginRight: '6px' }}>←</span> Back to experts
          </Link>

          {/* HERO CARD */}
          <div className="ep-hero-card">
            <div className="ep-hero-top-accent" />
            <div className="ep-hero-left">
              <div className="ep-hex-wrapper">
                <div className="ep-hex-inner">{initials}</div>
              </div>
              <div className="ep-name">{expert.name}</div>
              <div className="ep-title">{expert.title || 'Expert'} · {expert.company || 'Not Specified'}</div>
              <div className="ep-verified">
                <span style={{ color: 'var(--green)' }}>✓</span> Verified
              </div>
              <p className="ep-bio">{expert.bio || 'This expert has not provided a biography yet. They specialize in technical mock interviews.'}</p>
              
              <div className="ep-domain-tags">
                {(expert.domains || []).slice(0,5).map(d => (
                  <span key={`domain-${d}`} className="ep-tag">{d}</span>
                ))}
                {(expert.techStack || []).slice(0,5).map(t => (
                  <span key={`tech-${t}`} className="ep-tag" style={{ opacity: 0.85 }}>{t}</span>
                ))}
                {(!expert.domains || expert.domains.length === 0) && (!expert.techStack || expert.techStack.length === 0) && <span className="ep-tag">Mock Interview</span>}
              </div>
            </div>

            <div className="ep-hero-right">
              <div className="ep-star-row">
                <div className="ep-stars">★★★★★</div>
                <div className="ep-rating-num">5.0</div>
              </div>
              <div className="ep-rating-label">Based on 12 sessions</div>

              <div className="ep-mini-stats">
                <div>
                  <div className="ep-stat-val">{cleanYears}+ yrs</div>
                  <div className="ep-stat-lbl">Experience</div>
                </div>
                <div>
                  <div className="ep-stat-val">100%</div>
                  <div className="ep-stat-lbl">Response</div>
                </div>
              </div>

              {isSelf ? (
                 <button className="ep-book-btn" onClick={() => navigate('/profile')} style={{ background: 'transparent', color: 'var(--text2)', border: '1px solid var(--border)' }}>Edit profile</button>
              ) : (
                 <button className="ep-book-btn" onClick={() => navigate(`/book/${expert.id}`)}>Book a session</button>
              )}
            </div>
          </div>

          {/* TWO COLUMN CONTENT */}
          <div className="ep-grid">
            
            {/* LEFT: SESSIONS */}
            <div className="ep-card">
               <div className="ep-card-header">
                 <h3 className="ep-card-title">Available sessions</h3>
                 {slots.length > 0 && (
                   <div className="ep-live-pill">
                     <div className="ep-pulse"></div>
                     {slots.length} slots open
                   </div>
                 )}
               </div>

               {slots.length === 0 ? (
                 <div className="ep-empty">
                   <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.2, marginBottom: '12px' }}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                   <div style={{ fontSize: '14px', color: 'var(--text3)' }}>No availability set yet</div>
                 </div>
               ) : (
                 <div>
                   {slots.map((s, i) => {
                     const sTime = s.startTime?.toDate ? s.startTime.toDate() : new Date(s.startTime);
                     const eTime = s.endTime?.toDate ? s.endTime.toDate() : new Date(s.endTime);
                     const dayNum = sTime.getDate();
                     const monStr = sTime.toLocaleDateString('en-US', { month: 'short' });
                     const timeStr = `${sTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} – ${eTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
                     
                     const assignedRole = s.roleDescription && s.roleDescription.trim() !== '' ? s.roleDescription : 'Mock Interview';
                     const reqDiffClass = diffColors[assignedRole.length % 4];

                     return (
                       <div key={s.id} className="ep-slot-row">
                         <div className="ep-date-block">
                           <span className="ep-day-num">{dayNum}</span>
                           <span className="ep-month">{monStr}</span>
                         </div>
                         <div className="ep-slot-div"></div>
                         
                         <div className="ep-slot-info">
                           <div className="ep-slot-time">{timeStr}</div>
                           <div className="ep-slot-meta">
                             <span className={`diff-pill ${reqDiffClass}`} style={{ fontSize: '11px', padding: '2px 8px' }}>{assignedRole}</span>
                             <span style={{ fontSize: '11px', color: 'var(--text3)' }}>60 min</span>
                           </div>
                         </div>

                         <button className="ep-slot-book" onClick={() => navigate(`/book/${expert.id}`)}>Book</button>
                       </div>
                     )
                   })}
                 </div>
               )}
            </div>

            {/* RIGHT: STYLE & REVIEWS */}
            <div className="ep-right-stack">
               
               <div className="ep-card ep-card-pad" style={{ marginBottom: 0 }}>
                 <div style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 600, marginBottom: '18px' }}>Interview style</div>
                 
                 <div className="ep-bar-row">
                   <div className="ep-bar-label">
                     <span>Technical depth</span>
                     <span className="ep-bar-pct">{expert.technicalDepth || 85}%</span>
                   </div>
                   <div className="ep-bar-track">
                     <motion.div className="ep-bar-fill" initial={{ width: 0 }} animate={{ width: `${expert.technicalDepth || 85}%` }} transition={{ duration: 0.8, delay: 0.1, ease: 'easeOut' }} />
                   </div>
                 </div>

                 <div className="ep-bar-row">
                   <div className="ep-bar-label">
                     <span>Communication focus</span>
                     <span className="ep-bar-pct">{expert.communicationFocus || 70}%</span>
                   </div>
                   <div className="ep-bar-track">
                     <motion.div className="ep-bar-fill" initial={{ width: 0 }} animate={{ width: `${expert.communicationFocus || 70}%` }} transition={{ duration: 0.8, delay: 0.1, ease: 'easeOut' }} />
                   </div>
                 </div>

                 <div className="ep-bar-row" style={{ marginBottom: 0 }}>
                   <div className="ep-bar-label">
                     <span>Follow-up pressure</span>
                     <span className="ep-bar-pct">{expert.followUpPressure || 90}%</span>
                   </div>
                   <div className="ep-bar-track">
                     <motion.div className="ep-bar-fill" initial={{ width: 0 }} animate={{ width: `${expert.followUpPressure || 90}%` }} transition={{ duration: 0.8, delay: 0.1, ease: 'easeOut' }} />
                   </div>
                 </div>

                 <div className="ep-footer-note">
                   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                   Avg. feedback in 10 min post-session
                 </div>
               </div>

               <div className="ep-card ep-card-pad">
                 <div className="ep-rev-header">
                   <span style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 600 }}>Recent reviews</span>
                   <span className="ep-see-all">See all</span>
                 </div>
                 
                 {reviews.length === 0 ? (
                   <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: '13px', padding: '20px 0' }}>
                      No reviews yet
                   </div>
                 ) : (
                   <div>
                     {reviews.map(r => {
                       const authorInitials = r.candidateName ? r.candidateName.substring(0, 2).toUpperCase() : 'U';
                       return (
                         <div key={r.id} className="ep-rev-item">
                           <div className="ep-rev-top">
                             <div className="ep-rev-ava">{authorInitials}</div>
                             <div className="ep-rev-name">{r.candidateName || 'User'}</div>
                             <div className="ep-rev-stars">★★★★★</div>
                           </div>
                           <div className="ep-rev-role">Targeting {r.targetRole || 'Software Engineer'}</div>
                           <p className="ep-rev-text">{r.comment || 'Excellent interviewer, provided actionable feedback.'}</p>
                         </div>
                       )
                     })}
                   </div>
                 )}
               </div>

            </div>
          </div>

        </div>
      </motion.div>
    </PageLayout>
  );
}
