import React, { Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { ThemeProvider } from './lib/ThemeContext'

const LoginPage = React.lazy(() => import('./pages/LoginPage'))
const OnboardingPage = React.lazy(() => import('./pages/OnboardingPage'))
const CandidateProfilePage = React.lazy(() => import('./pages/CandidateProfilePage'))
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'))
const ExpertProfilePage = React.lazy(() => import('./pages/ExpertProfilePage'))
const ExplorePage = React.lazy(() => import('./pages/ExplorePage'))
const AvailabilityPage = React.lazy(() => import('./pages/AvailabilityPage'))
const BookingPage = React.lazy(() => import('./pages/BookingPage'))
const RoomPage = React.lazy(() => import('./pages/RoomPage'))
const UpcomingSessionsPage = React.lazy(() => import('./pages/UpcomingSessionsPage'))
const PastSessionsPage = React.lazy(() => import('./pages/PastSessionsPage'))

function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg, #f8f6f1)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        width: 28, height: 28,
        borderRadius: '50%',
        border: '2px solid rgba(184,150,90,0.2)',
        borderTopColor: '#b8965a',
        animation: 'spin 0.8s linear infinite'
      }}/>
      <style>{`
        @keyframes spin { 
          to { transform: rotate(360deg); } 
        }
      `}</style>
    </div>
  )
}

const Placeholder = ({ name }) => (
  <div style={{
    color: 'var(--text)', background: 'var(--bg)', minHeight: '100vh',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'var(--font-display)', fontSize: 22
  }}>
    {name} — coming soon
  </div>
)

function AppRoutes() {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait">
      <Suspense fallback={<LoadingScreen />}>
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/profile" element={<CandidateProfilePage />} />
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/expert/:uid" element={<ExpertProfilePage />} />
          <Route path="/availability" element={<AvailabilityPage />} />
          <Route path="/book/:expertUid" element={<BookingPage />} />
          <Route path="/room/:callId" element={<RoomPage />} />
          <Route path="/upcoming" element={<UpcomingSessionsPage />} />
          <Route path="/past-sessions" element={<PastSessionsPage />} />
          <Route path="/reports" element={<Placeholder name="Feedback Reports" />} />
          <Route path="/settings" element={<Placeholder name="Settings" />} />
        </Routes>
      </Suspense>
    </AnimatePresence>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AppRoutes />
    </ThemeProvider>
  )
}
