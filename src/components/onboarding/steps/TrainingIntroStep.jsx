// Screen 4 — How training works

const C = {
  cyan: '#55dde0', floor: '#1a2a35', card: '#2f4858', cardHi: '#3d5f73',
  text: '#e8f8f9', text2: '#7db8bb',
}

const panels = [
  {
    label: 'Listen to the melody',
    icon: (
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke={C.cyan} strokeWidth="1.8"/>
        <path d="M10 8.5v7l6-3.5-6-3.5z" stroke={C.cyan} strokeWidth="1.6" strokeLinejoin="round" fill={C.cyan} fillOpacity="0.2"/>
      </svg>
    ),
  },
  {
    label: 'First note is free',
    icon: (
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
        <path d="M10 17V6l8-1.5V14" stroke={C.cyan} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="8" cy="17" r="2" stroke={C.cyan} strokeWidth="1.8"/>
        <circle cx="16" cy="14" r="2" stroke={C.cyan} strokeWidth="1.8"/>
        <path d="M3 12h4" stroke={C.cyan} strokeWidth="1.6" strokeLinecap="round" strokeDasharray="1 3"/>
      </svg>
    ),
  },
  {
    label: 'Play the sequence',
    icon: (
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="6" width="18" height="12" rx="1.5" stroke={C.cyan} strokeWidth="1.8"/>
        <path d="M9 6v8M15 6v8M3 14h18" stroke={C.cyan} strokeWidth="1.5"/>
        <circle cx="6" cy="10" r="1.2" fill={C.cyan}/>
        <circle cx="12" cy="10" r="1.2" fill={C.cyan}/>
        <circle cx="18" cy="10" r="1.2" fill={C.cyan}/>
      </svg>
    ),
  },
  {
    label: 'See how you did',
    icon: (
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
        <path d="M12 3.5l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17.6l-5.4 2.8 1-6.1L3.2 10l6.1-.9L12 3.5z"
              stroke={C.cyan} strokeWidth="1.6" strokeLinejoin="round" fill={C.cyan} fillOpacity="0.15"/>
      </svg>
    ),
  },
]

export default function TrainingIntroStep({ onNext }) {
  return (
    <div style={{ position: 'absolute', inset: 0, paddingTop: 50, color: C.text }}>

      <div style={{ padding: '0 28px', textAlign: 'center' }}>
        <h1 style={{ margin: 0, color: C.text, fontSize: 28, fontWeight: 700, letterSpacing: -0.4 }}>
          How training works
        </h1>
      </div>

      <div style={{ marginTop: 28, padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 12, position: 'relative' }}>
        {/* dotted vertical connector */}
        <svg style={{ position: 'absolute', left: 60, top: 70, height: 'calc(100% - 100px)', width: 2 }}
             preserveAspectRatio="none" viewBox="0 0 2 1">
          <line x1="1" y1="0" x2="1" y2="1" stroke={C.cyan} strokeOpacity="0.55"
                strokeWidth="2" strokeDasharray="3 5" vectorEffect="non-scaling-stroke"
                style={{ filter: `drop-shadow(0 0 2px ${C.cyan})` }}/>
        </svg>

        {panels.map((p, i) => (
          <div key={i} style={{
            background: C.cardHi, borderRadius: 20, padding: '14px 16px',
            display: 'flex', alignItems: 'center', gap: 16,
            border: '1px solid rgba(85,221,224,0.10)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
            animation: `srPanel 600ms cubic-bezier(.2,.7,.2,1) ${i * 110}ms backwards`,
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16, flexShrink: 0,
              background: `linear-gradient(160deg, ${C.card}, ${C.floor})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              filter: `drop-shadow(0 0 8px ${C.cyan}44)`,
              border: `1px solid ${C.cyan}33`,
              position: 'relative', zIndex: 1,
            }}>
              {p.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: C.text2, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 600, marginBottom: 2 }}>
                Step {i + 1}
              </div>
              <div style={{ fontSize: 15, color: C.text, fontWeight: 600, letterSpacing: -0.1 }}>
                {p.label}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Ghost next button */}
      <button onClick={onNext} style={{
        position: 'absolute', right: 20, bottom: 38,
        background: 'transparent', border: `1px solid ${C.cyan}55`,
        color: C.cyan, padding: '11px 18px', borderRadius: 999,
        fontSize: 15, fontWeight: 600, cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', gap: 8,
      }}>
        Next
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </div>
  )
}
