import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, addDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp, where } from 'firebase/firestore';
import PageLayout from '../components/PageLayout';
import LoadingScreen from '../components/LoadingScreen';

export default function AvailabilityPage() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);

  // Date Selector State
  const [dateType, setDateType] = useState('today'); // today, tomorrow, custom
  const [customDate, setCustomDate] = useState('');

  // Time Setter State
  const [hour, setHour] = useState('10');
  const [minute, setMinute] = useState('00');
  const [period, setPeriod] = useState('AM');

  // Duration State
  const [duration, setDuration] = useState('45'); // 30, 45, 60, custom
  const [customHr, setCustomHr] = useState('1');
  const [customMin, setCustomMin] = useState('00');

  // Role State
  const [role, setRole] = useState('');

  // Logic State
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState('');
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);

  // Auth Guard
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        navigate('/login');
        return;
      }
      const uDoc = await getDoc(doc(db, 'users', u.uid));
      if (uDoc.exists() && uDoc.data().role !== 'expert') {
        navigate('/dashboard');
        return;
      }
      setCurrentUser(u);
    });
    return () => unsub();
  }, [navigate]);

  // Real-time listener
  useEffect(() => {
    if (!currentUser) return;
    const slotsRef = collection(db, 'availability', currentUser.uid, 'slots');

    const unsubscribe = onSnapshot(slotsRef, (snap) => {
      const fetched = [];
      snap.forEach(d => {
        const data = d.data();
        // Client-side filter
        if (data.isBooked === false) {
          const sTime = data.startTime ? new Date(data.startTime) : new Date();
          if (sTime < new Date()) {
            deleteDoc(doc(db, 'availability', currentUser.uid, 'slots', d.id)).catch(() => {});
          } else {
            fetched.push({ id: d.id, ...data });
          }
        }
      });
      // Client-side sort
      fetched.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
      setSlots(fetched);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching slots:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const handleAddSlot = async (e) => {
    e.preventDefault();
    setError('');
    setIsAdding(true);

    try {
      // 1. Calculate Date
      let targetDate = new Date();
      if (dateType === 'tomorrow') {
        targetDate.setDate(targetDate.getDate() + 1);
      } else if (dateType === 'custom') {
        if (!customDate) throw new Error("Please select a date.");
        targetDate = new Date(customDate);
      }

      // 2. Calculate Start Time
      let h = parseInt(hour);
      if (period === 'PM' && h !== 12) h += 12;
      if (period === 'AM' && h === 12) h = 0;

      const startTime = new Date(targetDate);
      startTime.setHours(h, parseInt(minute), 0, 0);

      if (startTime < new Date()) {
        throw new Error("You cannot set availability in the past.");
      }

      // 3. Calculate Duration
      let durMinutes = parseInt(duration);
      if (duration === 'custom') {
        durMinutes = (parseInt(customHr) * 60) + parseInt(customMin);
      }
      if (durMinutes <= 0) throw new Error("Duration must be greater than zero.");

      // 4. Calculate End Time & expiresAt
      const endTime = new Date(startTime.getTime() + durMinutes * 60000);

      // Note: expiresAt includes a 5-min buffer so the candidate's 'Join Room' button remains active briefly after the meeting ends.
      const expiresAt = new Date(endTime.getTime() + 5 * 60000);

      // 5. Submit to Firestore
      await addDoc(collection(db, 'availability', currentUser.uid, 'slots'), {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        durationMinutes: durMinutes,
        role: role || 'Mock Interview',
        isBooked: false,
        expiresAt: expiresAt.toISOString(),
        gracePeriod: 5,
        createdAt: serverTimestamp()
      });

      // Reset
      setRole('');
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteSlot = async (id) => {
    if (!currentUser) return;
    try {
      await deleteDoc(doc(db, 'availability', currentUser.uid, 'slots', id));
    } catch (err) {
      console.error(err);
    }
  };

  // Grouping Logic
  const grouped = slots.reduce((acc, s) => {
    const d = new Date(s.startTime);
    const key = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  if (!currentUser) return <LoadingScreen text="Loading..." />;

  return (
    <PageLayout>
      <motion.div 
        initial={{ opacity: 0, y: 12 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.28, ease: "easeOut" }}
      >
        <style>{`
          .av-header {
            font-family: var(--font-display);
            font-size: 28px;
            font-weight: 700;
            color: var(--text);
            margin-bottom: 24px;
            letter-spacing: -0.02em;
          }
          
          .av-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 24px;
          }
          @media (max-width: 900px) {
            .av-grid {
              grid-template-columns: 1fr;
            }
          }

          .av-card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 18px;
            box-shadow: var(--clay-shadow);
            position: relative;
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }
          .av-card-pad {
            padding: 32px;
          }
          .av-top-accent {
            position: absolute;
            top: 0; left: 0; right: 0;
            height: 3px;
            background: linear-gradient(90deg, transparent, var(--accent), var(--accent2), var(--accent), transparent);
          }

          .av-card-header {
            padding: 20px 24px;
            border-bottom: 1px solid var(--border);
            font-family: var(--font-display);
            font-size: 16px;
            font-weight: 600;
            color: var(--text);
          }

          .av-label {
            display: block;
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: var(--text3);
            font-family: var(--font-ui);
            margin-bottom: 8px;
          }

          .av-pill-row {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-bottom: 16px;
          }

          .av-pill {
            background: transparent;
            color: var(--text3);
            border: 1px solid var(--border2);
            border-radius: 20px;
            padding: 6px 14px;
            font-size: 13px;
            font-family: var(--font-ui);
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
          }
          .av-pill:hover {
            border-color: var(--text2);
            color: var(--text2);
          }
          .av-pill.active {
            background: var(--accent-dim);
            color: var(--accent);
            border-color: var(--accent-glow);
          }

          .av-input {
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
            margin-bottom: 16px;
          }
          .av-input:focus {
            border-color: var(--accent);
            box-shadow: 0 0 0 2px var(--accent-glow);
          }

          .av-time-row {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 16px;
          }
          .av-select {
            background: var(--surface2);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 10px 32px 10px 14px;
            font-size: 13px;
            color: var(--text);
            font-family: var(--font-body);
            box-shadow: var(--clay-inset);
            outline: none;
            transition: all 0.2s;
            appearance: none;
            background-image: url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239c9070%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E");
            background-repeat: no-repeat;
            background-position: right 8px center;
            background-size: 16px;
          }
          .av-select:focus {
            border-color: var(--accent);
            box-shadow: 0 0 0 2px var(--accent-glow);
          }

          .av-btn {
            width: 100%;
            background: var(--accent);
            color: white;
            border: none;
            border-radius: 8px;
            padding: 11px 20px;
            font-size: 13px;
            font-family: var(--font-ui);
            font-weight: 600;
            box-shadow: var(--clay-shadow);
            cursor: pointer;
            transition: all 0.2s;
            margin-top: 8px;
          }
          .av-btn:hover:not(:disabled) {
            opacity: 0.9;
            transform: translateY(-1px);
          }
          .av-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .av-date-group {
            margin-bottom: 8px;
          }
          .av-date-label {
            padding: 20px 24px 10px 24px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: var(--text3);
            font-family: var(--font-ui);
            display: block;
          }

          .av-slot-row {
            display: flex;
            align-items: center;
            padding: 14px 24px;
            border-bottom: 1px solid var(--border);
            transition: background 0.15s;
          }
          .av-slot-row:hover {
            background: var(--bg2);
          }
          .av-slot-row:last-child {
            border-bottom: none;
          }

          .av-slot-info {
            flex: 1;
          }
          .av-slot-time {
            font-size: 14px;
            font-weight: 600;
            color: var(--text);
            font-family: var(--font-display);
          }
          .av-slot-meta {
            font-size: 12px;
            color: var(--text3);
            margin-top: 4px;
            display: flex;
            gap: 8px;
            align-items: center;
            font-family: var(--font-ui);
          }
          .av-meta-dot {
            width: 4px; height: 4px; border-radius: 50%; background: var(--border2);
          }

          .av-del-btn {
            background: transparent;
            border: 1px solid var(--border2);
            color: var(--text3);
            border-radius: 8px;
            padding: 8px;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .av-del-btn:hover {
            color: var(--red);
            border-color: rgba(192,71,58,0.3);
            background: rgba(192,71,58,0.05);
          }
        `}</style>

        <div style={{ paddingBottom: '40px' }}>
          <h1 className="av-header">Manage Availability</h1>

          <div className="av-grid">
            {/* FORM CARD */}
            <div className="av-card">
              <div className="av-top-accent" />
              <div className="av-card-pad">
                <form onSubmit={handleAddSlot}>
                  
                  {/* DATE SELECTOR */}
                  <div>
                    <label className="av-label">Date</label>
                    <div className="av-pill-row">
                      {['today', 'tomorrow', 'custom'].map(type => (
                        <button
                          key={type}
                          type="button"
                          className={`av-pill ${dateType === type ? 'active' : ''}`}
                          onClick={() => setDateType(type)}
                        >
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </button>
                      ))}
                    </div>

                    <AnimatePresence>
                      {dateType === 'custom' && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          style={{ overflow: 'hidden' }}
                        >
                          <input
                            type="date"
                            className="av-input"
                            value={customDate}
                            onChange={e => setCustomDate(e.target.value)}
                            min={new Date().toISOString().split('T')[0]}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* TIME SETTER */}
                  <div>
                    <label className="av-label">Start Time</label>
                    <div className="av-time-row">
                      <select className="av-select" value={hour} onChange={e => setHour(e.target.value)}>
                        {Array.from({ length: 12 }).map((_, i) => {
                          const val = (i + 1).toString().padStart(2, '0');
                          return <option key={val} value={val}>{val}</option>
                        })}
                      </select>
                      <span style={{ fontWeight: 800, color: 'var(--text2)' }}>:</span>
                      <select className="av-select" value={minute} onChange={e => setMinute(e.target.value)}>
                        {Array.from({ length: 60 }).map((_, i) => {
                          const val = i.toString().padStart(2, '0');
                          return <option key={val} value={val}>{val}</option>
                        })}
                      </select>
                      <select className="av-select" value={period} onChange={e => setPeriod(e.target.value)}>
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                      </select>
                    </div>
                  </div>

                  {/* DURATION SELECTOR */}
                  <div>
                    <label className="av-label">Duration</label>
                    <div className="av-pill-row">
                      {['30', '45', '60', 'custom'].map(d => (
                        <button
                          key={d}
                          type="button"
                          className={`av-pill ${duration === d ? 'active' : ''}`}
                          onClick={() => setDuration(d)}
                        >
                          {d === 'custom' ? 'Custom' : `${d} min`}
                        </button>
                      ))}
                    </div>

                    <AnimatePresence>
                      {duration === 'custom' && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          style={{ overflow: 'hidden' }}
                        >
                          <div className="av-time-row">
                            <select className="av-select" value={customHr} onChange={e => setCustomHr(e.target.value)}>
                              {[0, 1, 2, 3, 4].map(h => <option key={h} value={h}>{h} hr</option>)}
                            </select>
                            <select className="av-select" value={customMin} onChange={e => setCustomMin(e.target.value)}>
                              {Array.from({ length: 60 }).map((_, i) => {
                                const val = i.toString().padStart(2, '0');
                                return <option key={val} value={val}>{val} min</option>
                              })}
                            </select>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* ROLE INPUT */}
                  <div>
                    <label className="av-label">Target Role / Topic</label>
                    <input
                      type="text"
                      className="av-input"
                      placeholder="e.g. Frontend Engineer, System Design"
                      value={role}
                      onChange={e => setRole(e.target.value)}
                    />
                  </div>

                  {error && <p style={{ color: 'var(--red)', fontSize: '13px', margin: '0 0 16px 0', fontWeight: 600 }}>{error}</p>}

                  <button type="submit" className="av-btn" disabled={isAdding}>
                    {isAdding ? 'Creating Slot...' : 'Add Availability Slot'}
                  </button>
                </form>
              </div>
            </div>

            {/* SAVED SLOTS CARD */}
            <div className="av-card">
              <div className="av-card-header">Your Saved Slots</div>

              {loading ? (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text3)', fontSize: '14px' }}>Loading slots...</div>
              ) : Object.keys(grouped).length === 0 ? (
                <div style={{ padding: '60px 32px', textAlign: 'center' }}>
                   <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.2, margin: '0 auto 12px auto', display: 'block' }}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                   <div style={{ color: 'var(--text3)', fontSize: '14px' }}>No active slots. Start by adding one.</div>
                </div>
              ) : (
                <div style={{ paddingBottom: '16px' }}>
                  <AnimatePresence mode="popLayout">
                    {Object.keys(grouped).map(dateKey => (
                      <div key={dateKey} className="av-date-group">
                        <span className="av-date-label">{dateKey}</span>
                        {grouped[dateKey].map(s => {
                          const st = new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                          const et = new Date(s.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                          return (
                            <motion.div
                              key={s.id}
                              layout
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 20 }}
                              className="av-slot-row"
                            >
                              <div className="av-slot-info">
                                <span className="av-slot-time">{st} – {et}</span>
                                <div className="av-slot-meta">
                                  <span>{s.durationMinutes} min</span>
                                  <div className="av-meta-dot"></div>
                                  <span>{s.role}</span>
                                </div>
                              </div>

                              <button
                                className="av-del-btn"
                                onClick={() => handleDeleteSlot(s.id)}
                                title="Delete Slot"
                              >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                              </button>
                            </motion.div>
                          );
                        })}
                      </div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
            
          </div>
        </div>
      </motion.div>
    </PageLayout>
  );
}
