import React, { useState, useEffect } from 'react';
import { useTheme } from '../lib/ThemeContext';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from '../firebase';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, collection, query, where } from 'firebase/firestore';

const styles = `
  /* MOBILE TOP BAR */
  .mobile-topbar {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 70px;
    background: var(--surface);
    backdrop-filter: blur(10px);
    z-index: 50;
    border-bottom: 1px solid var(--border);
    justify-content: space-between;
    align-items: center;
    padding: 0 20px;
  }
  .mobile-logo {
    display: flex;
    align-items: center;
    gap: 12px;
    text-decoration: none;
    color: var(--text);
  }
  
  /* HAMBURGER BUTTON WITH SVG ANIMATION */
  .hamburger {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    width: 26px;
    height: 18px;
    background: transparent;
    border: none;
    cursor: pointer;
    z-index: 100;
    padding: 0;
  }
  .hamburger span {
    width: 100%;
    height: 2px;
    background-color: var(--text);
    border-radius: 2px;
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    transform-origin: center;
  }
  .hamburger.open span:nth-child(1) {
    transform: translateY(8px) rotate(45deg);
  }
  .hamburger.open span:nth-child(2) {
    opacity: 0;
  }
  .hamburger.open span:nth-child(3) {
    transform: translateY(-8px) rotate(-45deg);
  }

  /* SIDEBAR LAYER */
  .sidebar-container {
    width: 260px;
    height: 100vh;
    background: var(--surface);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    padding: 32px 24px;
    position: fixed;
    top: 0;
    left: 0;
    z-index: 40;
    transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    font-family: 'Inter', sans-serif;
  }

  .sidebar-overlay {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(8, 8, 14, 0.7);
    backdrop-filter: blur(4px);
    z-index: 35;
    opacity: 0;
    transition: opacity 0.4s ease;
  }

  .sidebar-logo {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 48px;
    text-decoration: none;
    color: var(--text);
  }
  .sidebar-logo-icon {
    background: var(--accent);
    width: 36px; height: 36px; border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    font-family: 'Inter', sans-serif; font-weight: 700; font-size: 16px; color: #fff;
  }
  .sidebar-logo-text {
    font-family: 'Inter', sans-serif; font-weight: 700; font-size: 20px; letter-spacing: -0.02em;
  }
  .sidebar-nav {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
  }
  .nav-item {
    padding: 12px 16px;
    border-radius: 10px;
    color: var(--text2);
    text-decoration: none;
    font-weight: 600;
    font-size: 14px;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 12px;
    border-left: 3px solid transparent;
  }
  .nav-item:hover {
    background: var(--surface2);
    color: var(--text);
  }
  .nav-item.active {
    background: var(--surface2);
    color: var(--accent2);
    border-left: 3px solid var(--accent);
  }
  
  .sidebar-user {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    border-radius: 12px;
    background: var(--surface2);
    margin-bottom: 12px;
  }
  .sidebar-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--accent), var(--accent2));
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 14px;
    color: #fff;
    font-family: 'Inter', sans-serif;
  }
  .sidebar-user-info {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: hidden;
  }
  .sidebar-user-name {
    font-weight: 700;
    font-size: 14px;
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
    color: var(--text);
  }
  .sidebar-user-role {
    font-size: 11px;
    color: var(--text3);
    text-transform: uppercase;
    font-weight: 700;
    letter-spacing: 0.05em;
  }
  .logout-btn {
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 16px;
    color: var(--text3);
    font-weight: 600;
    font-size: 13px;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-family: 'Inter', sans-serif;
  }
  .logout-btn:hover {
    color: var(--red);
    border-color: rgba(240, 96, 96, 0.3);
    background: rgba(240, 96, 96, 0.05);
  }
  .notification-dot {
    width: 8px; height: 8px; background: var(--green); border-radius: 50%; margin-left: auto;
    box-shadow: 0 0 8px var(--green);
  }

  /* MEDIA QUERIES FOR MOBILE & TABLET */
  @media (max-width: 768px) {
    .mobile-topbar {
      display: flex;
    }
    
    .sidebar-container {
      transform: translateX(-100%);
      padding-top: 100px;
    }
    
    .sidebar-container.open {
      transform: translateX(0);
    }
    
    .sidebar-overlay.open {
      display: block;
      opacity: 1;
    }

    .sidebar-logo {
      display: none;
    }
  }

  .theme-toggle-btn {
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 8px;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--text);
    transition: all 0.2s;
  }
  .theme-toggle-btn:hover {
    background: var(--surface3);
    border-color: var(--accent);
  }
`;

export default function Sidebar() {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [profileName, setProfileName] = useState('');
  const [upcomingCount, setUpcomingCount] = useState(0);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

  // Lock body scroll when drawer open
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isMobileOpen]);

  useEffect(() => {
    let unsubscribeUser = () => {};
    let unsubscribeBookings = () => {};

    const unsubAuth = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
        const userRef = doc(db, 'users', u.uid);
        unsubscribeUser = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setRole(data.role);
            setProfileName(data.name || 'User');
          }
        });

        // Query upcoming sessions
        const now = new Date();
        const bookingsRef = collection(db, 'bookings');
        unsubscribeBookings = onSnapshot(bookingsRef, (snap) => {
          let count = 0;
          snap.forEach(doc => {
            const booking = doc.data();
            const isParticipant = booking.candidateUid === u.uid || booking.expertUid === u.uid;
            const bkTime = booking.startTime?.toDate ? booking.startTime.toDate() : new Date(booking.startTime);
            const isUpcoming = bkTime > now && booking.status === 'confirmed';
            if (isParticipant && isUpcoming) count++;
          });
          setUpcomingCount(count);
        });
      }
    });

    return () => {
      unsubAuth();
      unsubscribeUser();
      unsubscribeBookings();
    };
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const isCandidate = role === 'candidate';
  const initials = profileName ? profileName.split(' ').map(n=>n[0]).join('').slice(0, 2).toUpperCase() : 'US';

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      
      {/* MOBILE TOP BAR */}
      <div className="mobile-topbar">
        <NavLink to="/dashboard" className="mobile-logo">
          <div className="sidebar-logo-icon">R0</div>
          <div className="sidebar-logo-text">RoundZero</div>
        </NavLink>
        
        <button 
          className={`hamburger ${isMobileOpen ? 'open' : ''}`} 
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          aria-label="Toggle Navigation"
        >
          <span></span>
          <span></span>
        </button>

        <button className="theme-toggle-btn" onClick={toggleTheme} aria-label="Toggle Theme" style={{ marginRight: '10px' }}>
          {theme === 'light' ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
          )}
        </button>
      </div>

      {/* OVERLAY */}
      <div 
        className={`sidebar-overlay ${isMobileOpen ? 'open' : ''}`} 
        onClick={() => setIsMobileOpen(false)}
      />

      {/* SIDEBAR */}
      <div className={`sidebar-container ${isMobileOpen ? 'open' : ''}`}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '48px' }}>
          <NavLink to="/dashboard" className="sidebar-logo" style={{ marginBottom: 0 }}>
            <div className="sidebar-logo-icon">R0</div>
            <div className="sidebar-logo-text">RoundZero</div>
          </NavLink>
          <button className="theme-toggle-btn hide-mobile" onClick={toggleTheme} aria-label="Toggle Theme">
            {theme === 'light' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
            )}
          </button>
        </div>

        <nav className="sidebar-nav">
          <NavLink to="/dashboard" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
            Dashboard
            {upcomingCount > 0 && <div className="notification-dot" />}
          </NavLink>
          <NavLink to="/upcoming" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
            Upcoming
          </NavLink>
          <NavLink to="/past-sessions" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
            Past Sessions
          </NavLink>
          
          {isCandidate ? (
            <>
              <NavLink to="/explore" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>Find Experts</NavLink>
              <NavLink to="/reports" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>Feedback Reports</NavLink>
              <NavLink to="/profile" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>My Profile</NavLink>
            </>
          ) : (
            <>
              <NavLink to="/availability" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>Manage Availability</NavLink>
              <NavLink to="/profile" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>My Profile</NavLink>
            </>
          )}

          <NavLink to="/settings" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>Settings</NavLink>
        </nav>

        {user && (
          <div className="sidebar-user">
            <div className="sidebar-avatar">{initials}</div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{profileName}</span>
              <span className="sidebar-user-role">{role}</span>
            </div>
          </div>
        )}

        <button className="logout-btn" onClick={handleLogout}>
          Sign Out
        </button>

      </div>
    </>
  );
}
