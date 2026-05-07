// Screen 3 — What is Sound Reef?
import { useTranslation } from 'react-i18next'

const C = { cyan: '#55dde0', card: '#2f4858', baltic: '#33658a', text: '#e8f8f9', text2: '#7db8bb' }

function NoteIcon({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M9 18V5l11-2v13" stroke={C.cyan} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="6.5" cy="18" r="2.5" stroke={C.cyan} strokeWidth="1.8"/>
      <circle cx="17.5" cy="16" r="2.5" stroke={C.cyan} strokeWidth="1.8"/>
    </svg>
  )
}
function PianoIcon({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5" width="18" height="14" rx="2" stroke={C.cyan} strokeWidth="1.8"/>
      <path d="M8 5v9M13 5v9M3 14h18" stroke={C.cyan} strokeWidth="1.6"/>
      <rect x="6" y="5" width="3" height="6" fill={C.cyan} fillOpacity="0.18"/>
      <rect x="11" y="5" width="3" height="6" fill={C.cyan} fillOpacity="0.18"/>
      <rect x="16" y="5" width="3" height="6" fill={C.cyan} fillOpacity="0.18"/>
    </svg>
  )
}
function TrendIcon({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M3 17l5-5 4 3 8-9" stroke={C.cyan} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M15 6h6v6" stroke={C.cyan} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export default function AppIntroStep({ onNext }) {
  const { t } = useTranslation()

  const features = [
    { icon: <NoteIcon />,  label: t('onboarding.app_intro.hear') },
    { icon: <PianoIcon />, label: t('onboarding.app_intro.identify') },
    { icon: <TrendIcon />, label: t('onboarding.app_intro.train_ear') },
  ]

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', overflowY: 'auto' }}>
      <div style={{ width: '100%', maxWidth: 480, padding: '0 24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

        {/* Central illustration */}
        <div style={{ height: 280, width: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 60 }}>
          {[0, 1, 2].map(i => (
            <span key={i} style={{
              position: 'absolute', width: 200, height: 200, borderRadius: '50%',
              border: `1.5px solid ${C.cyan}`, opacity: 0,
              animation: `srRipple 3.2s ease-out ${i * 1.06}s infinite`,
              boxShadow: `0 0 20px ${C.cyan}55`,
            }} />
          ))}
          <div style={{
            position: 'absolute', width: 170, height: 170, borderRadius: '50%',
            background: `radial-gradient(closest-side, ${C.cyan}22, transparent 70%)`,
            filter: 'blur(2px)',
          }} />
          <div style={{
            position: 'relative', width: 110, height: 110, borderRadius: 28,
            background: `linear-gradient(160deg, ${C.baltic} 0%, ${C.card} 100%)`,
            boxShadow: `0 0 36px ${C.cyan}66, inset 0 1px 0 rgba(255,255,255,0.08)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'srFloat 5s ease-in-out infinite',
          }}>
            <svg width="60" height="60" viewBox="0 0 24 24" fill="none">
              <path d="M9 18V5l11-2v13" stroke={C.cyan} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 4px ${C.cyan})` }}/>
              <circle cx="6.5" cy="18" r="2.5" fill={C.cyan} style={{ filter: `drop-shadow(0 0 6px ${C.cyan})` }}/>
              <circle cx="17.5" cy="16" r="2.5" fill={C.cyan} style={{ filter: `drop-shadow(0 0 6px ${C.cyan})` }}/>
            </svg>
          </div>
        </div>

        {/* Headline */}
        <div style={{ textAlign: 'center', marginTop: -10 }}>
          <h1 style={{ margin: 0, color: C.text, fontSize: 28, fontWeight: 700, letterSpacing: -0.4, lineHeight: 1.15 }}>
            {t('onboarding.app_intro.heading')}
          </h1>
          <p style={{ margin: '10px 0 0', color: C.text2, fontSize: 14, lineHeight: 1.5 }}>
            {t('onboarding.app_intro.sub')}
          </p>
        </div>

        {/* 3-column feature cards */}
        <div style={{ marginTop: 28, width: '100%', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {features.map((it, i) => (
            <div key={i} style={{
              background: C.card + 'cc', borderRadius: 20, padding: '18px 8px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
              border: '1px solid rgba(85,221,224,0.12)',
            }}>
              <div style={{ filter: `drop-shadow(0 0 6px ${C.cyan}66)` }}>{it.icon}</div>
              <div style={{ fontSize: 12, color: C.text, fontWeight: 500, textAlign: 'center', lineHeight: 1.25 }}>{it.label}</div>
            </div>
          ))}
        </div>

        {/* Centered Next button */}
        <button onClick={onNext} style={{
          marginTop: 32, marginBottom: 32,
          background: 'transparent', border: `1px solid ${C.cyan}55`,
          color: C.cyan, padding: '12px 28px', borderRadius: 999,
          fontSize: 15, fontWeight: 600, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 8,
        }}>
          {t('onboarding.app_intro.next')}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

      </div>
    </div>
  )
}
