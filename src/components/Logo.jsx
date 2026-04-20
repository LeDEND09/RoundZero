export default function Logo({ size = 32, showWordmark = true }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
      <svg width={size} height={size} viewBox="0 0 80 80" fill="none">
        <rect width="80" height="80" rx="18" fill="#1c1a14"/>
        <rect width="80" height="80" rx="18" stroke="#b8965a" 
          strokeWidth="1.2" fill="none"/>
        {/* Corner accent dots */}
        <circle cx="16" cy="16" r="2" fill="#b8965a" opacity="0.5"/>
        <circle cx="64" cy="16" r="2" fill="#b8965a" opacity="0.5"/>
        <circle cx="16" cy="64" r="2" fill="#b8965a" opacity="0.5"/>
        <circle cx="64" cy="64" r="2" fill="#b8965a" opacity="0.5"/>
        {/* 0 oval — left wall is shared with R stem */}
        <path d="M28 16 Q16 16 16 40 Q16 64 28 64 Q44 64 52 52 
          Q60 40 52 28 Q44 16 28 16 Z" 
          stroke="#d4af76" strokeWidth="3.2" fill="none"/>
        {/* R bowl inside the oval */}
        <path d="M28 26 Q44 26 44 34 Q44 42 28 42" 
          stroke="#d4af76" strokeWidth="3.2" 
          strokeLinecap="round" fill="none"/>
        {/* R diagonal leg exits through bottom right */}
        <path d="M36 42 L52 58" 
          stroke="#b8965a" strokeWidth="3" strokeLinecap="round"/>
      </svg>
      {showWordmark && (
        <span style={{
          fontFamily:"'Playfair Display', serif",
          fontWeight: 700,
          fontSize: size * 0.55,
          color: 'var(--text)',
          letterSpacing: '-0.02em'
        }}>
          Round<span style={{ color:'var(--accent)' }}>Zero</span>
        </span>
      )}
    </div>
  )
}
