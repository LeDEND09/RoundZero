import Topbar from './Topbar'

export default function PageLayout({ children, title, subtitle, action }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Topbar />
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 32px' }}>
        {(title || action) && (
          <div style={{
            display: 'flex', alignItems: 'flex-start',
            justifyContent: 'space-between', marginBottom: 28
          }}>
            <div>
              {title && (
                <h1 style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 26, fontWeight: 700, color: 'var(--text)',
                  letterSpacing: '-0.02em', marginBottom: 4
                }}>
                  {title}
                </h1>
              )}
              {subtitle && (
                <p style={{
                  fontSize: 13, color: 'var(--text2)',
                  fontFamily: 'var(--font-body)'
                }}>
                  {subtitle}
                </p>
              )}
            </div>
            {action && action}
          </div>
        )}
        {children}
      </main>
    </div>
  )
}
