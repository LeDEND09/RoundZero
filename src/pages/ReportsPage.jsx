import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import PageLayout from '../components/PageLayout';
import PageTransition from '../components/PageTransition';
import LoadingScreen from '../components/LoadingScreen';

import './ReportsPage.css';

export default function ReportsPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

        // Query feedback collection directly
        const fQuery = query(
          collection(db, 'feedback'),
          where(roleKey, '==', u.uid)
        );

        const unsubSnap = onSnapshot(fQuery, async (snap) => {
          const list = [];
          for (const d of snap.docs) {
            const data = d.data();
            // Fetch booking info for date and other user info
            const bDoc = await getDoc(doc(db, 'bookings', d.id));
            const bData = bDoc.exists() ? bDoc.data() : {};
            
            const otherUid = isCand ? bData.expertUid : bData.candidateUid;
            let otherName = isCand ? bData.expertName : bData.candidateName;
            
            if (!otherName && otherUid) {
              const uDoc = await getDoc(doc(db, 'users', otherUid));
              otherName = uDoc.exists() ? uDoc.data().name : 'User';
            }

            list.push({
              id: d.id,
              ...data,
              booking: bData,
              otherName: otherName || 'Expert',
              date: bData.startTime?.toDate ? bData.startTime.toDate() : new Date(bData.startTime || Date.now())
            });
          }

          list.sort((a, b) => b.date - a.date);
          setReports(list);
          setLoading(false);
        });

        return () => unsubSnap();
      } catch (err) {
        console.error('Error fetching reports:', err);
        setLoading(false);
      }
    });

    return () => unsubAuth();
  }, [navigate]);

  if (loading) return <LoadingScreen text="Loading reports..." />;

  return (
    <PageLayout>
      <PageTransition>
        <div className="rep-container">
          <div className="rep-header">
            <h1 className="rep-title">Actual Feedback Reports</h1>
            <p className="rep-subtitle">Direct access to all your AI-generated performance evaluations.</p>
          </div>

          {reports.length === 0 ? (
            <div className="rep-empty">
              <div className="rep-empty-icon">📄</div>
              <h3>No reports found</h3>
              <p>Completed interview reports will appear here automatically.</p>
              <Link to="/past-sessions" className="rep-link">Check Past Sessions →</Link>
            </div>
          ) : (
            <div className="rep-grid">
              {reports.map((rep, idx) => (
                <motion.div 
                  key={rep.id} 
                  className="rep-card"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => navigate(`/feedback/${rep.id}`)}
                >
                  <div className="rep-card-top">
                    <div className="rep-score-ring">
                      <svg viewBox="0 0 36 36" className="circular-chart">
                        <path className="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                        <path className="circle" strokeDasharray={`${(rep.overallScore || 0) * 10}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                        <text x="18" y="20.35" className="percentage">{rep.overallScore || 0}</text>
                      </svg>
                    </div>
                    <div className="rep-card-info">
                      <div className="rep-role">{rep.booking?.roleDescription || 'Software Engineer'}</div>
                      <div className="rep-with">with {rep.otherName}</div>
                      <div className="rep-date">{rep.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                    </div>
                  </div>
                  
                  <div className="rep-card-tags">
                    {rep.technicalScore && <span className="rep-tag">Technical: {rep.technicalScore}</span>}
                    {rep.communicationScore && <span className="rep-tag">Comm: {rep.communicationScore}</span>}
                  </div>

                  <div className="rep-card-footer">
                    <span>View Full Report</span>
                    <span className="arrow">→</span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </PageTransition>
    </PageLayout>
  );
}
