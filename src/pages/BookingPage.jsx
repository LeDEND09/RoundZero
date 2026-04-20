import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs, writeBatch, serverTimestamp } from 'firebase/firestore';
import PageLayout from '../components/PageLayout';
import LoadingScreen from '../components/LoadingScreen';

export default function BookingPage() {
  const { expertUid } = useParams();
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState(null);
  const [expert, setExpert] = useState(null);
  const [slots, setSlots] = useState([]);
  const [groupedSlots, setGroupedSlots] = useState({});
  const [loading, setLoading] = useState(true);

  const [selectedSlot, setSelectedSlot] = useState(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        navigate('/login');
        return;
      }
      
      try {
        const uDoc = await getDoc(doc(db, 'users', u.uid));
        if (uDoc.exists() && uDoc.data().role !== 'candidate') {
          navigate('/dashboard');
          return;
        }
        setCurrentUser(u);

        // Fetch Expert Data
        const eDoc = await getDoc(doc(db, 'users', expertUid));
        if (!eDoc.exists() || eDoc.data().role !== 'expert') {
          navigate('/explore');
          return;
        }
        setExpert(eDoc.data());

        // Fetch available slots
        const slotsRef = collection(db, 'availability', expertUid, 'slots');
        const q = query(slotsRef, where('isBooked', '==', false));
        const sSnap = await getDocs(q);

        const fetchedSlots = [];
        sSnap.forEach((d) => {
          fetchedSlots.push({ id: d.id, ...d.data() });
        });

        fetchedSlots.sort((a,b) => {
           const da = a.startTime?.toDate ? a.startTime.toDate() : new Date(a.startTime);
           const db = b.startTime?.toDate ? b.startTime.toDate() : new Date(b.startTime);
           return da - db;
        });

        setSlots(fetchedSlots);

        const grouped = fetchedSlots.reduce((acc, slot) => {
          const d = slot.startTime?.toDate ? slot.startTime.toDate() : new Date(slot.startTime);
          const key = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
          if (!acc[key]) acc[key] = [];
          acc[key].push(slot);
          return acc;
        }, {});
        
        setGroupedSlots(grouped);

      } catch (err) {
        console.error("Booking load error:", err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, [navigate, expertUid]);

  const handleConfirm = async () => {
    if (!selectedSlot || !currentUser || !expert) return;

    setIsConfirming(true);
    setErrorMsg('');

    try {
      const batch = writeBatch(db);

      // 1. Create booking doc
      const bookingRef = doc(collection(db, 'bookings'));
      batch.set(bookingRef, {
        candidateUid: currentUser.uid,
        candidateName: (await getDoc(doc(db, 'users', currentUser.uid))).data()?.name || "Candidate",
        expertUid: expertUid,
        expertName: expert.name,
        domain: (expert.domains && expert.domains.length > 0) ? expert.domains[0] : 'Mock Interview',
        roleDescription: selectedSlot.roleDescription || 'Target Role Not Specified',
        slotId: selectedSlot.id,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        status: 'confirmed',
        streamCallId: crypto.randomUUID(),
        createdAt: serverTimestamp()
      });

      // 2. Mark slot as booked
      const slotRef = doc(db, 'availability', expertUid, 'slots', selectedSlot.id);
      batch.update(slotRef, { isBooked: true });

      await batch.commit();
      setSuccess(true);
    } catch (err) {
      console.error(err);
      setErrorMsg(`Failed to book: ${err.message}`);
    } finally {
      setIsConfirming(false);
    }
  };

  if (loading) {
    return <LoadingScreen text="Loading slots..." />;
  }

  if (!expert) return null;

  const initials = expert.name ? expert.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'EX';

  return (
    <PageLayout>
      <motion.div 
        initial={{ opacity: 0, y: 12 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.28, ease: "easeOut" }}
      >
        <style>{`
          .bp-container {
            max-width: 720px;
            margin: 0 auto;
            padding-bottom: 60px;
          }
          
          .bp-card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 18px;
            box-shadow: var(--clay-shadow);
            position: relative;
            overflow: hidden;
            margin-bottom: 24px;
          }
          .bp-card-pad {
            padding: 32px;
          }
          
          .bp-top-accent {
            position: absolute;
            top: 0; left: 0; right: 0;
            height: 3px;
            background: linear-gradient(90deg, transparent, var(--accent), var(--accent2), var(--accent), transparent);
          }

          /* SUCCESS CARD */
          .bp-success-card {
            text-align: center;
            padding: 60px 32px;
          }
          .bp-success-icon {
            width: 64px;
            height: 64px;
            border-radius: 50%;
            background: var(--green-dim);
            color: var(--green);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 32px;
            margin: 0 auto 20px auto;
            box-shadow: 0 0 0 8px rgba(74, 158, 110, 0.05);
          }

          /* HERO CARD */
          .bp-hero-flex {
            display: flex;
            align-items: center;
            gap: 24px;
          }
          .bp-hex-wrapper {
            width: 76px;
            height: 76px;
            padding: 3px;
            background: var(--accent-dim);
            clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
            flex-shrink: 0;
          }
          .bp-hex-inner {
            width: 70px;
            height: 70px;
            clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
            background: linear-gradient(135deg, var(--accent), var(--accent2));
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: var(--font-display);
            font-size: 22px;
            font-weight: 700;
            color: white;
          }
          .bp-expert-name {
            font-family: var(--font-display);
            font-size: 22px;
            font-weight: 700;
            color: var(--text);
            margin: 0 0 4px 0;
            letter-spacing: -0.02em;
          }
          .bp-expert-sub {
            font-size: 13px;
            color: var(--text2);
            margin-bottom: 8px;
          }
          .bp-tags-row {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
          }
          .bp-tag {
            background: var(--bg2);
            color: var(--text2);
            border: 1px solid var(--border2);
            border-radius: 20px;
            padding: 3px 10px;
            font-size: 11px;
            font-family: var(--font-ui);
          }

          /* CALENDAR SECTION */
          .bp-section-title {
            font-family: var(--font-display);
            font-size: 20px;
            font-weight: 600;
            color: var(--text);
            margin-bottom: 24px;
            letter-spacing: -0.02em;
          }
          
          .bp-date-group {
            margin-bottom: 28px;
          }
          .bp-date-header {
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: var(--text3);
            font-family: var(--font-ui);
            margin-bottom: 12px;
          }
          
          .bp-slots-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
            gap: 12px;
          }
          .bp-slot-btn {
            background: var(--surface2);
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 12px;
            text-align: center;
            color: var(--text);
            font-family: var(--font-body);
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            box-shadow: var(--clay-inset);
          }
          .bp-slot-btn:hover {
            border-color: var(--accent);
          }
          .bp-slot-btn.selected {
            background: var(--accent-dim);
            border-color: var(--accent);
            color: var(--accent);
            box-shadow: 0 0 0 2px var(--accent-glow);
          }

          /* CONFIRM CARD */
          .bp-confirm-box {
            background: var(--bg2);
            border-radius: 12px;
            padding: 20px;
            text-align: center;
            margin-top: 32px;
            border: 1px solid var(--border2);
          }
          .bp-btn {
            width: 100%;
            background: var(--accent);
            color: white;
            border: none;
            border-radius: 10px;
            padding: 14px 20px;
            font-size: 14px;
            font-family: var(--font-ui);
            font-weight: 600;
            box-shadow: var(--clay-shadow);
            cursor: pointer;
            transition: all 0.2s;
            margin-top: 16px;
          }
          .bp-btn:hover:not(:disabled) {
            transform: translateY(-1px);
            box-shadow: var(--clay-hover);
            opacity: 0.95;
          }
          .bp-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }
          .bp-ghost-btn {
            background: transparent;
            color: var(--text2);
            border: 1px solid var(--border2);
            border-radius: 8px;
            padding: 8px 16px;
            font-size: 13px;
            cursor: pointer;
          }
        `}</style>

        <div className="bp-container">
          
          <div style={{ marginBottom: '24px' }}>
            <button className="bp-ghost-btn" onClick={() => navigate(-1)}>
              ← Back
            </button>
          </div>

          <AnimatePresence mode="wait">
            {success ? (
              <motion.div 
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bp-card bp-success-card"
              >
                <div className="bp-top-accent" />
                <div className="bp-success-icon">✓</div>
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', margin: '0 0 8px 0' }}>Session Booked!</h1>
                <p style={{ color: 'var(--text2)', fontSize: '14px', marginBottom: '32px' }}>
                  Your interview with <strong>{expert.name}</strong> is confirmed and added to your dashboard.
                </p>
                <button className="bp-btn" onClick={() => navigate('/dashboard')} style={{ maxWidth: '300px' }}>
                  Go to Dashboard
                </button>
              </motion.div>
            ) : (
              <motion.div 
                key="booking"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {/* EXPERT HERO */}
                <div className="bp-card bp-card-pad">
                  <div className="bp-top-accent" />
                  <div className="bp-hero-flex">
                    <div className="bp-hex-wrapper">
                      <div className="bp-hex-inner">{initials}</div>
                    </div>
                    <div>
                      <h2 className="bp-expert-name">{expert.name}</h2>
                      <div className="bp-expert-sub">{expert.title || 'Expert'} · {expert.company || 'Not Specified'}</div>
                      <div className="bp-tags-row">
                        {(expert.domains || []).slice(0, 3).map(tag => (
                          <span key={tag} className="bp-tag">{tag}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* SLOTS CARD */}
                <div className="bp-card bp-card-pad">
                  <h3 className="bp-section-title">Choose a time slot</h3>
                  
                  {slots.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text3)' }}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3, margin: '0 auto 12px auto', display: 'block' }}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                      This expert has no available slots right now.
                    </div>
                  ) : (
                    <div>
                      {Object.keys(groupedSlots).map(dateKey => (
                        <div key={dateKey} className="bp-date-group">
                          <div className="bp-date-header">{dateKey}</div>
                          <div className="bp-slots-grid">
                            {groupedSlots[dateKey].map(slot => {
                              const sTime = slot.startTime?.toDate ? slot.startTime.toDate() : new Date(slot.startTime);
                              const eTime = slot.endTime?.toDate ? slot.endTime.toDate() : new Date(slot.endTime);
                              const timeStr = `${sTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - ${eTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
                              const isSelected = selectedSlot?.id === slot.id;
                              
                              return (
                                <button 
                                  key={slot.id} 
                                  onClick={() => setSelectedSlot(slot)}
                                  className={`bp-slot-btn ${isSelected ? 'selected' : ''}`}
                                >
                                  {timeStr}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <AnimatePresence>
                    {selectedSlot && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0, marginTop: 0 }}
                        animate={{ opacity: 1, height: 'auto', marginTop: 32 }}
                        exit={{ opacity: 0, height: 0, marginTop: 0 }}
                        style={{ overflow: 'hidden' }}
                      >
                        <div className="bp-confirm-box">
                          {(() => {
                            const sTime = selectedSlot.startTime?.toDate ? selectedSlot.startTime.toDate() : new Date(selectedSlot.startTime);
                            const dateKey = sTime.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
                            const timeStr = sTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                            
                            return (
                              <>
                                <div style={{ fontSize: '14px', color: 'var(--text2)', lineHeight: '1.6' }}>
                                  Booking a session with <strong>{expert.name}</strong> on <br/>
                                  <strong style={{ color: 'var(--text)' }}>{dateKey} at {timeStr}</strong>
                                </div>
                                <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text3)' }}>
                                  Target Role: <strong>{selectedSlot.roleDescription || 'Not Specified'}</strong>
                                </div>
                              </>
                            );
                          })()}
                          
                          <button 
                            className="bp-btn" 
                            onClick={handleConfirm}
                            disabled={isConfirming}
                          >
                            {isConfirming ? 'Booking...' : 'Confirm booking'}
                          </button>
                          
                          {errorMsg && <div style={{ color: 'var(--red)', fontSize: '13px', marginTop: '12px', fontWeight: 600 }}>{errorMsg}</div>}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </motion.div>
    </PageLayout>
  );
}
