import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import PageLayout from '../components/PageLayout';
import PageTransition from '../components/PageTransition';

import './ExplorePage.css';

const DOMAINS = ["All", "Frontend", "Backend", "System Design", "DSA", "Mobile", "DevOps", "ML / AI", "Behavioural", "Full Stack"];

export default function ExplorePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [experts, setExperts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeDomain, setActiveDomain] = useState("All");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { navigate('/login'); return; }
      try {
        const q = query(collection(db, 'users'), where('role', '==', 'expert'));
        const snap = await getDocs(q);
        const loaded = [];
        snap.forEach(doc => loaded.push({ id: doc.id, ...doc.data() }));
        setExperts(loaded);
      } catch (err) {
        console.error("Error fetching experts:", err);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, [navigate]);

  const filteredExperts = experts.filter(exp => {
    if (activeDomain !== "All") {
      const domains = exp.domains || [];
      if (!domains.includes(activeDomain)) return false;
    }
    if (searchQuery.trim() !== "") {
      const lowerQ = searchQuery.toLowerCase();
      const n = (exp.name || "").toLowerCase();
      const c = (exp.company || "").toLowerCase();
      if (!n.includes(lowerQ) && !c.includes(lowerQ)) return false;
    }
    return true;
  });

  return (
    <PageLayout>
      <PageTransition>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 4 }}>
            Find an Expert
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text2)', fontFamily: 'var(--font-body)' }}>
            Connect with senior engineers for your next mock interview.
          </p>
        </div>

        {/* Search & Filters */}
        <div style={{ marginBottom: 28 }}>
          <input
            type="text"
            placeholder="Search by name or company..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="explore-search"
          />
          <div className="domain-pills">
            {DOMAINS.map(dom => (
              <button
                key={dom}
                onClick={() => setActiveDomain(dom)}
                className={`domain-pill ${activeDomain === dom ? 'active' : ''}`}
              >
                {dom}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="expert-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="expert-card-skel">
                <div className="shimmer" style={{ width: 56, height: 56, borderRadius: '50%', marginBottom: 16 }} />
                <div className="shimmer" style={{ width: '60%', height: 16, marginBottom: 10 }} />
                <div className="shimmer" style={{ width: '40%', height: 12, marginBottom: 20 }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <div className="shimmer" style={{ width: 60, height: 24, borderRadius: 20 }} />
                  <div className="shimmer" style={{ width: 50, height: 24, borderRadius: 20 }} />
                </div>
              </div>
            ))}
          </div>
        ) : filteredExperts.length > 0 ? (
          <div className="expert-grid">
            {filteredExperts.map((exp, idx) => {
              const initials = exp.name ? exp.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase() : 'EX';
              const domains = exp.domains || [];
              const visibleTags = domains.slice(0, 3);
              const extraCount = domains.length - 3;

              return (
                <motion.div
                  key={exp.id}
                  className="expert-card"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05, duration: 0.3 }}
                  onClick={() => navigate(`/expert/${exp.id}`)}
                  whileHover={{ y: -4, boxShadow: 'var(--clay-hover)' }}
                >
                  <div className="exp-avatar">{initials}</div>
                  <h3 className="exp-name">{exp.name}</h3>
                  <p className="exp-subtitle">{exp.title || 'Expert'} @ {exp.company || 'Company'}</p>
                  <div className="exp-tags">
                    {visibleTags.map(tag => <span key={tag} className="exp-tag">{tag}</span>)}
                    {extraCount > 0 && <span className="exp-tag">+{extraCount}</span>}
                  </div>
                  <div className="exp-footer">
                    <span style={{ color: '#d4a017', fontSize: 13 }}>★★★★☆</span>
                    <span style={{ color: 'var(--text3)', fontSize: 12, marginLeft: 6 }}>4.8</span>
                  </div>
                  <div className="exp-cta">View profile →</div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text2)' }}>
            <div style={{ fontSize: 48, opacity: 0.2, marginBottom: 16 }}>🔍</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, marginBottom: 8 }}>No experts found</div>
            <div style={{ fontSize: 13, marginBottom: 20 }}>Try adjusting your search or domain filter.</div>
            <button
              onClick={() => { setSearchQuery(""); setActiveDomain("All"); }}
              style={{
                background: 'var(--accent)', color: '#fff', border: 'none',
                borderRadius: 10, padding: '9px 20px',
                fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', boxShadow: 'var(--clay-shadow)'
              }}
            >
              Clear filters
            </button>
          </div>
        )}
      </PageTransition>
    </PageLayout>
  );
}
