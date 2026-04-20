import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, updateDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import PageLayout from '../components/PageLayout';
import PageTransition from '../components/PageTransition';
import LoadingScreen from '../components/LoadingScreen';

import './UpcomingSessionsPage.css';

export default function UpcomingSessionsPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [cancelModal, setCancelModal] = useState({ isOpen: false, booking: null });
  const [isCancelling, setIsCancelling] = useState(false);

  // Trigger re-render for countdown every 60s
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const int = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(int);
  }, []);

  useEffect(() => {
    let unsubDocs = () => {};
    
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      if (!u) return navigate('/login');
      setUser(u);
      
      try {
        const pDoc = await getDoc(doc(db, 'users', u.uid));
        if (!pDoc.exists()) return;
        const pData = pDoc.data();
        setProfile(pData);
        
        const isCand = pData.role === 'candidate';
        const roleKey = isCand ? 'candidateUid' : 'expertUid';
        const now = new Date();

        const bQuery = query(
          collection(db, 'bookings'),
          where(roleKey, '==', u.uid)
        );

        unsubDocs = onSnapshot(bQuery, async (snap) => {
          const list = [];
          
          for (let docSnap of snap.docs) {
            const bData = docSnap.data();
            const sTime = bData.startTime?.toDate ? bData.startTime.toDate() : new Date(bData.startTime);
            
            // Client-side filter: upcoming + confirmed only
            if (sTime <= now) continue;
            if (bData.status !== 'confirmed') continue;

            const otherId = isCand ? bData.expertUid : bData.candidateUid;
            let otherUser = {};
            try {
              const otherDoc = await getDoc(doc(db, 'users', otherId));
              otherUser = otherDoc.data() || {};
            } catch(_) {}
            
            list.push({
              id: docSnap.id,
              ...bData,
              parsedStartTime: sTime,
              otherUser
            });
          }
          
          list.sort((a,b) => a.parsedStartTime - b.parsedStartTime);
          setBookings(list);
          setLoading(false);
        });

      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    });

    return () => {
      unsubAuth();
      unsubDocs();
    };
  }, [navigate]);

  const handleCancelClick = (booking) => {
    setCancelModal({ isOpen: true, booking });
  };

  const confirmCancel = async () => {
    if (!cancelModal.booking) return;
    setIsCancelling(true);
    
    try {
      const bRef = doc(db, 'bookings', cancelModal.booking.id);
      await updateDoc(bRef, { status: 'cancelled' });
      
      // Also free up slot
      const sRef = doc(db, 'availability', cancelModal.booking.expertUid, 'slots', cancelModal.booking.slotId);
      await updateDoc(sRef, { isBooked: false });
      
    } catch (err) {
      console.error(err);
    } finally {
      setIsCancelling(false);
      setCancelModal({ isOpen: false, booking: null });
    }
  };

  if (!profile) return <LoadingScreen text="Loading..." />;

  const isCand = profile.role === 'candidate';

  // Group by date
  const groups = {};
  const today = new Date();
  today.setHours(0,0,0,0);
  
  bookings.forEach(b => {
     const tDate = new Date(b.parsedStartTime);
     tDate.setHours(0,0,0,0);
     const diffDays = Math.round((tDate - today) / (1000 * 60 * 60 * 24));
     
     let dateStr = tDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
     if (diffDays === 0) dateStr = 'Today';
     if (diffDays === 1) dateStr = 'Tomorrow';
     
     if(!groups[dateStr]) groups[dateStr] = [];
     groups[dateStr].push(b);
  });

  return (
    <>
      <PageLayout>
        <PageTransition>
         <div className="upcoming-container">
            
            <div className="upcoming-header-row">
               <div>
                 <h1 className="uh-title">Upcoming Sessions</h1>
                 <p className="uh-subtitle">{loading ? '...' : bookings.length} sessions scheduled</p>
               </div>
               {isCand ? (
                 <Link to="/explore" className="uh-action-btn">Book a session</Link>
               ) : (
                 <Link to="/availability" className="uh-action-btn">Set availability</Link>
               )}
            </div>

            {loading ? (
               // LOADING STATE
               <div>
                  {[1,2,3].map(n => <div key={n} className="skel-card"></div>)}
               </div>
            ) : bookings.length === 0 ? (
               // EMPTY STATE
               <motion.div className="empty-wrapper" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
                 <svg className="empty-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{opacity: 0.2}}>
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>
                 </svg>
                 <div className="empty-title">No upcoming sessions</div>
                 <div className="empty-sub">You don't have any sessions scheduled right now.</div>
                 {/* CTA buttons removed as per request - now accessible via header */}
               </motion.div>
            ) : (
               // LIST
               Object.keys(groups).map((dateKey) => (
                 <div key={dateKey} className="date-group">
                    <motion.div className="date-header" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
                      <span className="date-label">{dateKey}</span>
                      <div className="date-line"></div>
                    </motion.div>
                    
                    <AnimatePresence mode="popLayout">
                       {groups[dateKey].map((b, index) => {
                          const msDiff = b.parsedStartTime - new Date();
                          const minsDiff = Math.floor(msDiff / 60000);
                          const hrsDiff = Math.floor(minsDiff / 60);
                          const daysDiff = Math.floor(hrsDiff / 24);
                          
                          let cdStr = '';
                          let cdClass = 'cd-gray';
                          let isUrgent = false;

                          if (msDiff <= 0) {
                             cdStr = 'Join now';
                             cdClass = 'cd-green';
                             isUrgent = true;
                          } else if (minsDiff < 30) {
                             cdStr = 'Starting soon';
                             cdClass = 'cd-green';
                             isUrgent = true;
                          } else if (hrsDiff < 24) {
                             cdStr = `in ${hrsDiff}hr ${minsDiff % 60}min`;
                             cdClass = 'cd-amber';
                          } else {
                             cdStr = `in ${daysDiff} day${daysDiff !== 1 ? 's' : ''}`;
                          }

                          // UI helpers
                          const diffMap = ['Junior', 'Mid-level', 'Senior', 'Staff'];
                          const classMap = ['diff-junior', 'diff-mid', 'diff-senior', 'diff-staff'];
                          // Just hashing an index visually since real slots don't strictly bind difficulty yet
                          const cIndex = b.expertUid.length % 4;

                          const otherUsr = b.otherUser;
                          const otherInitials = otherUsr.name ? otherUsr.name.substring(0,2).toUpperCase() : 'US';

                          return (
                             <motion.div 
                               key={b.id}
                               layout
                               initial={{ opacity: 0, y: 20 }}
                               animate={{ opacity: 1, y: 0 }}
                               exit={{ opacity: 0, x: -20, scale: 0.98 }}
                               transition={{ duration: 0.25, delay: index * 0.06 }}
                               className="us-card"
                             >
                               <div className="card-left-accent"></div>
                               
                               <div className="time-block">
                                 <div className="tb-time">{b.parsedStartTime.toLocaleTimeString([], {hour: 'numeric', minute:'2-digit'})}</div>
                                 <div className="tb-date">{b.parsedStartTime.toLocaleDateString('en-GB', {weekday:'short', day:'numeric', month:'short'})}</div>
                                 <div className="dur-pill">60 min</div>
                               </div>

                               <div className="info-block">
                                  <div className="ib-user-row">
                                     {isCand ? (
                                        <div className="ib-avatar-hex">{otherInitials}</div>
                                     ) : (
                                        <div className="ib-avatar-circ">{otherInitials}</div>
                                     )}
                                     <div>
                                        <div className="ib-name">{otherUsr.name || 'User'}</div>
                                        <div className="ib-role">
                                          {isCand ? `${otherUsr.title || 'Expert'} @ ${otherUsr.company || 'Unknown'}` : `Targeting ${b.roleDescription || otherUsr.targetRole || 'Software Engineer'}`}
                                        </div>
                                     </div>
                                  </div>
                                  <div className="ib-tags">
                                     {isCand ? (
                                        (otherUsr.domains || []).slice(0, 3).map(tag => <span key={tag} className="ib-tag">{tag}</span>)
                                     ) : (
                                        (otherUsr.techStack || []).slice(0, 3).map(tag => <span key={tag} className="ib-tag">{tag}</span>)
                                     )}
                                     {isCand && <span className={`ib-tag ${classMap[cIndex]}`} style={{ borderWidth: '1px' }}>{diffMap[cIndex]}</span>}
                                  </div>
                               </div>

                               <div className="action-block">
                                  <div className={`countdown-txt ${cdClass}`}>
                                    {cdStr === 'Starting soon' && (
                                       <motion.div className="pulse-dot-c" animate={{ scale: [1, 1.2, 1], opacity: [1, 0.5, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
                                    )}
                                    {cdStr}
                                  </div>
                                  
                                  <motion.button 
                                     whileHover={{ scale: 1.03 }} 
                                     whileTap={{ scale: 0.97 }}
                                     className={`btn-join ${isUrgent ? 'active' : ''}`}
                                     onClick={() => navigate(`/room/${b.streamCallId}`)}
                                  >
                                     Join Room →
                                  </motion.button>
                                  
                                  <button className="cancel-link" onClick={() => handleCancelClick(b)}>Cancel</button>
                               </div>

                             </motion.div>
                          )
                       })}
                    </AnimatePresence>
                 </div>
               ))
            )}
         </div>
        </PageTransition>
      </PageLayout>

       {/* CANCEL MODAL overlay */}
       <AnimatePresence>
         {cancelModal.isOpen && (
            <motion.div 
              className="modal-overlay" 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
            >
               <motion.div 
                 className="modal-card"
                 initial={{ opacity: 0, scale: 0.95, y: 10 }}
                 animate={{ opacity: 1, scale: 1, y: 0 }}
                 exit={{ opacity: 0, scale: 0.95, y: 10 }}
                 transition={{ duration: 0.2, ease: "easeOut" }}
               >
                 <h3 className="modal-title">Cancel this session?</h3>
                 <div className="modal-warn">
                   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                   This action cannot be undone. The opposing party will be notified that the session was cancelled and the slot will be reopened.
                 </div>
                 <div className="modal-actions">
                   <button className="btn-ghost" disabled={isCancelling} onClick={() => setCancelModal({ isOpen: false, booking: null })}>Keep session</button>
                   <button className="btn-red" disabled={isCancelling} onClick={confirmCancel}>{isCancelling ? 'Cancelling...' : 'Cancel session'}</button>
                 </div>
               </motion.div>
            </motion.div>
         )}
       </AnimatePresence>
    </>
  );
}
