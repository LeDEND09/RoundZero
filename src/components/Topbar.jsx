import { useState, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { auth, db } from '../firebase'
import { signOut, onAuthStateChanged } from 'firebase/auth'
import { doc, onSnapshot, collection, query, where } from 'firebase/firestore'
import { useTheme } from '../lib/ThemeContext'
import Logo from './Logo'

const NAV_CANDIDATE = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Upcoming', to: '/upcoming', badge: true },
  { label: 'Past Sessions', to: '/past-sessions' },
  { label: 'Find Experts', to: '/explore' },
  { label: 'Feedback', to: '/reports' },
]

const NAV_EXPERT = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Upcoming', to: '/upcoming', badge: true },
  { label: 'Past Sessions', to: '/past-sessions' },
  { label: 'Availability', to: '/availability' },
  { label: 'My Profile', to: '/profile' },
]

export default function Topbar() {
  const { dark, setDark } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [profileName, setProfileName] = useState('')
  const [upcomingCount, setUpcomingCount] = useState(0)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  useEffect(() => {
    let unsubAuth = () => {}
    let unsubUser = () => {}
    let unsubBookings = () => {}
    let lastRole = null
    let lastUid = null

    unsubAuth = onAuthStateChanged(auth, (u) => {
      if (u) {
        if (u.uid !== lastUid) {
          lastUid = u.uid
          setUser(u)

          // Cleanup previous user listener if any
          unsubUser()
          unsubUser = onSnapshot(doc(db, 'users', u.uid), (snap) => {
            if (snap.exists()) {
              const data = snap.data()
              const userRole = data.role
              setRole(userRole)
              setProfileName(data.name || 'User')

              // Only re-subscribe to bookings if the role changed
              if (userRole !== lastRole) {
                lastRole = userRole
                const roleKey = userRole === 'expert' ? 'expertUid' : 'candidateUid'
                
                unsubBookings()
                unsubBookings = onSnapshot(
                  query(collection(db, 'bookings'), where(roleKey, '==', u.uid)),
                  (bookingSnap) => {
                    const now = new Date()
                    let count = 0
                    bookingSnap.forEach(d => {
                      const b = d.data()
                      const t = b.startTime?.toDate ? b.startTime.toDate() : new Date(b.startTime)
                      if (b.status === 'confirmed' && t > now) count++
                    })
                    setUpcomingCount(count)
                  },
                  (err) => console.error("Topbar bookings listen error:", err)
                )
              }
            }
          }, (err) => console.error("Topbar user listen error:", err))
        }
      } else {
        // Logout cleanup
        unsubUser()
        unsubUser = () => {}
        unsubBookings()
        unsubBookings = () => {}
        setUser(null)
        setRole(null)
        setProfileName('')
        setUpcomingCount(0)
        lastUid = null
        lastRole = null
      }
    })

    return () => {
      unsubAuth()
      unsubUser()
      unsubBookings()
    }
  }, [])

  const handleLogout = async () => {
    await signOut(auth)
    navigate('/login')
  }

  const navItems = role === 'expert' ? NAV_EXPERT : NAV_CANDIDATE
  const initials = profileName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'RZ'

  return (
    <>
      <style>{`
        .topbar {
          position: sticky; top: 0; z-index: 100;
          height: 60px; width: 100%;
          background: var(--surface);
          border-bottom: 1px solid var(--border);
          box-shadow: var(--clay-shadow);
          display: flex; align-items: center;
          padding: 0 32px; gap: 32px;
        }
        .topbar-nav { display: flex; align-items: center; gap: 4px; flex: 1; justify-content: center; }
        .topbar-right { display: flex; align-items: center; gap: 12px; }
        
        .nav-link {
          position: relative; display: flex; align-items: center; gap: 6px;
          padding: 6px 14px; border-radius: 8px;
          font-family: var(--font-ui); font-size: 13.5px; font-weight: 500;
          color: var(--text2); transition: all 0.18s; border: none; background: transparent;
          cursor: pointer; white-space: nowrap;
          text-decoration: none;
        }
        .nav-link::after {
          content: ''; position: absolute; bottom: 2px; left: 14px; right: 14px;
          height: 2px; background: var(--accent); border-radius: 1px;
          transform: scaleX(0); transform-origin: left;
          transition: transform 0.22s cubic-bezier(0.4,0,0.2,1);
        }
        .nav-link:hover { background: var(--bg2); color: var(--text); }
        .nav-link:hover::after { transform: scaleX(0.4); opacity: 0.5; }
        .nav-link.active { background: var(--accent-dim); color: var(--accent); }
        .nav-link.active::after { transform: scaleX(1); }

        .nav-badge {
          width: 16px; height: 16px; border-radius: 50%;
          background: var(--accent); color: #fff;
          font-size: 9px; font-weight: 700;
          display: inline-flex; align-items: center; justify-content: center;
        }

        .theme-toggle {
          width: 44px; height: 24px; border-radius: 12px;
          background: var(--bg3); border: 1px solid var(--border2);
          box-shadow: var(--clay-inset);
          cursor: pointer; position: relative;
          display: flex; align-items: center; padding: 4px;
          transition: border-color 0.25s;
        }
        .theme-toggle[data-dark="true"] { border-color: var(--accent); }
        .toggle-thumb {
          width: 16px; height: 16px; border-radius: 50%;
          background: var(--accent);
          transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1);
          display: flex; align-items: center; justify-content: center;
          font-size: 9px;
        }

        .profile-avatar {
          width: 34px; height: 34px; border-radius: 50%;
          background: linear-gradient(135deg, var(--accent), var(--accent2));
          display: flex; align-items: center; justify-content: center;
          font-family: var(--font-display); font-weight: 700;
          font-size: 12px; color: #fff;
          box-shadow: var(--clay-shadow);
          border: 2px solid var(--accent-glow);
          cursor: pointer; transition: all 0.2s;
        }

        .hamburger-btn {
          display: none; background: transparent; border: none;
          cursor: pointer; padding: 4px; color: var(--text);
        }

        .mobile-drawer-overlay {
          display: none; position: fixed; inset: 0;
          background: rgba(0,0,0,0.4); z-index: 90;
        }
        .mobile-drawer {
          display: none; position: fixed; top: 60px; left: 0; right: 0;
          background: var(--surface); border-bottom: 1px solid var(--border);
          padding: 16px 24px 24px; z-index: 95; flex-direction: column; gap: 4px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.15);
        }
        .mobile-drawer.open { display: flex; }
        .mobile-drawer-overlay.open { display: block; }
        .mobile-drawer .nav-link { justify-content: flex-start; }

        @media (max-width: 768px) {
          .topbar { padding: 0 20px; }
          .topbar-nav { display: none; }
          .hamburger-btn { display: flex; }
        }
      `}</style>

      <header className="topbar">
        <NavLink to="/dashboard"><Logo size={30} showWordmark={true} /></NavLink>

        <nav className="topbar-nav">
          {navItems.map(item => (
            <motion.div key={item.to} whileHover={{ y: -1 }} whileTap={{ y: 0, scale: 0.97 }}>
              <NavLink
                to={item.to}
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              >
                {item.label}
                {item.badge && upcomingCount > 0 && (
                  <span className="nav-badge">{upcomingCount}</span>
                )}
              </NavLink>
            </motion.div>
          ))}
        </nav>

        <div className="topbar-right">
          {/* Theme Toggle */}
          <button
            className="theme-toggle"
            data-dark={dark}
            onClick={() => setDark(d => !d)}
            aria-label="Toggle theme"
          >
            <div className="toggle-thumb" style={{ transform: dark ? 'translateX(20px)' : 'translateX(0)' }}>
              {dark ? '🌙' : '☀️'}
            </div>
          </button>

          {/* Profile Avatar */}
          {user && (
            <motion.div
              className="profile-avatar"
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => navigate('/profile')}
              title="View profile"
            >
              {initials}
            </motion.div>
          )}

          {/* Logout */}
          {user && (
            <motion.button
              onClick={handleLogout}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              style={{
                background: 'transparent', border: '1px solid var(--border2)',
                borderRadius: 8, padding: '5px 12px',
                fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 500,
                color: 'var(--text2)', cursor: 'pointer', transition: 'all 0.2s'
              }}
            >
              Sign out
            </motion.button>
          )}

          {/* Hamburger */}
          <button
            className="hamburger-btn"
            onClick={() => setMobileOpen(o => !o)}
            aria-label="Toggle menu"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {mobileOpen
                ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
                : <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>
              }
            </svg>
          </button>
        </div>
      </header>

      {/* Mobile Drawer */}
      <div className={`mobile-drawer-overlay ${mobileOpen ? 'open' : ''}`} onClick={() => setMobileOpen(false)} />
      <nav className={`mobile-drawer ${mobileOpen ? 'open' : ''}`}>
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            {item.label}
            {item.badge && upcomingCount > 0 && <span className="nav-badge">{upcomingCount}</span>}
          </NavLink>
        ))}
      </nav>
    </>
  )
}
