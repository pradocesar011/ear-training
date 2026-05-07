// Screen 5 — Explore your Reef

import { useRef } from 'react'

const C = {
  cyan: '#55dde0', honey: '#f6ae2d', floor: '#1a2a35',
  card: '#2f4858', baltic: '#33658a',
  text: '#e8f8f9', text2: '#7db8bb',
}

// ── Icons ──────────────────────────────────────────────────────────────────────
function AlgaeIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 21c-3-3-5-7-3-12 1 3 2 4 3 5 0-3 1-5 3-7-1 4 0 7 1 9-1 0-3 1-4 5z"
            fill="#7adf8a" stroke="#3fae5c" strokeWidth="1.2" strokeLinejoin="round"/>
    </svg>
  )
}

function FishMiniIcon({ size = 18, color = C.cyan }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M3 12s3-5 8-5 8 3 9 5c-1 2-4 5-9 5s-8-3-8-5z" stroke={color} strokeWidth="1.5" fill={color} fillOpacity="0.18"/>
      <path d="M3 12l-2 -3 2 6z" fill={color} fillOpacity="0.4" stroke={color} strokeWidth="1.2" strokeLinejoin="round"/>
      <circle cx="16" cy="11" r="0.9" fill="#0d1820"/>
    </svg>
  )
}

function PearlIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M4 14c0-3 4-7 8-7s8 4 8 7c0 1-2 2-3 2H7c-1 0-3-1-3-2z" fill="#a8b8b3" stroke="#7a8e89" strokeWidth="1.1"/>
      <circle cx="12" cy="13" r="3.2" fill="url(#pg)"/>
      <defs>
        <radialGradient id="pg" cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#fff"/>
          <stop offset="1" stopColor="#cfeef0"/>
        </radialGradient>
      </defs>
    </svg>
  )
}

function SparkleIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 3v6M12 15v6M3 12h6M15 12h6M6 6l4 4M14 14l4 4M18 6l-4 4M10 14l-4 4"
            stroke={C.honey} strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  )
}

function NoteTinyIcon({ size = 18, color = C.cyan }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M10 17V6l8-1.5V14" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="8" cy="17" r="2" fill={color}/>
      <circle cx="16" cy="14" r="2" fill={color}/>
    </svg>
  )
}

const TIER_SPRITES = {
  common:    '/Reef/Fish/Common/clownfish.png',
  rare:      '/Reef/Fish/Rare/betta.png',
  legendary: '/Reef/Fish/Legendary/whale_shark.png',
}

const TIER_GLOWS = {
  common: null, rare: C.cyan, legendary: C.honey,
}

const TIER_BORDERS = {
  common: '#8a9aa033', rare: `${C.cyan}33`, legendary: `${C.honey}33`,
}

function FishSpriteSlot({ tier }) {
  const glow = TIER_GLOWS[tier]
  return (
    <div style={{ position: 'relative', width: 64, height: 64, flexShrink: 0 }}>
      {glow && (
        <div style={{
          position: 'absolute', inset: -6, borderRadius: '50%',
          background: `radial-gradient(closest-side, ${glow}55, transparent 70%)`,
          filter: 'blur(4px)',
        }} />
      )}
      <div style={{
        position: 'relative', width: '100%', height: '100%', borderRadius: 16,
        background: 'linear-gradient(160deg, #0e1a23, #0a1218)',
        border: `1px solid ${TIER_BORDERS[tier]}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
      }}>
        <img
          src={TIER_SPRITES[tier]}
          alt={tier}
          style={{
            width: 52, height: 52, objectFit: 'contain',
            filter: glow ? `drop-shadow(0 0 6px ${glow})` : 'none',
          }}
        />
      </div>
    </div>
  )
}

// ── Animated fish for reef preview ────────────────────────────────────────────
function Fish({ tier, x, y, dir = 1, size = 56, delay = 0 }) {
  const swimDur = useRef(4 + Math.random()).current
  const glow = TIER_GLOWS[tier]
  return (
    <div style={{
      position: 'absolute', left: x, top: y,
      '--sx': dir,
      animation: `srSwim ${swimDur}s ease-in-out ${delay}s infinite alternate`,
    }}>
      {glow && (
        <div style={{
          position: 'absolute', left: -10, top: -10, right: -10, bottom: -10, borderRadius: '50%',
          background: `radial-gradient(closest-side, ${glow}55, transparent 70%)`,
          filter: 'blur(4px)',
        }} />
      )}
      <img
        src={TIER_SPRITES[tier]}
        alt={tier}
        style={{
          width: size, height: 'auto', objectFit: 'contain',
          position: 'relative',
          filter: glow ? `drop-shadow(0 0 8px ${glow})` : 'none',
          imageRendering: 'pixelated',
        }}
      />
    </div>
  )
}

// ── Reward loop ────────────────────────────────────────────────────────────────
const loopItems = [
  { icon: <NoteTinyIcon />, label: 'Train',    source: true },
  { icon: <AlgaeIcon />,   label: 'Algae',    gain: true },
  { icon: <FishMiniIcon />, label: 'Feed' },
  { icon: <PearlIcon />,   label: 'Pearls',   gain: true },
  { icon: <SparkleIcon />, label: 'New Fish' },
]

const tiers = [
  { id: 'common',    name: 'Common',    count: 13, accent: '#8a9aa0' },
  { id: 'rare',      name: 'Rare',      count: 22, accent: C.cyan },
  { id: 'legendary', name: 'Legendary', count: 13, accent: C.honey },
]

export default function ReefIntroStep({ onStart, loading }) {
  return (
    <div style={{ position: 'absolute', inset: 0, paddingTop: 14, color: C.text, overflowY: 'auto' }}>

      {/* Headline */}
      <div style={{ padding: '0 28px', textAlign: 'center' }}>
        <h1 style={{ margin: 0, color: C.text, fontSize: 26, fontWeight: 700, letterSpacing: -0.4, lineHeight: 1.15 }}>
          Explore your Reef
        </h1>
        <p style={{ margin: '8px 0 0', color: C.text2, fontSize: 13, lineHeight: 1.5 }}>
          Collect, feed, and discover rare fish as you train.
        </p>
      </div>

      {/* Reef preview scene */}
      <div style={{
        margin: '14px 20px 0', height: 160, borderRadius: 22,
        background:
          `radial-gradient(120% 80% at 50% 0%, ${C.baltic}55, transparent 60%),` +
          'linear-gradient(180deg, #1c3140 0%, #122230 100%)',
        position: 'relative', overflow: 'hidden',
        border: `1px solid ${C.cyan}1a`,
        boxShadow: `inset 0 0 60px ${C.baltic}44`,
      }}>
        {/* light shafts */}
        <div style={{ position: 'absolute', left: '20%', top: -20, width: 50, height: 200, background: `linear-gradient(180deg, ${C.cyan}33, transparent)`, transform: 'skewX(-12deg)', filter: 'blur(6px)' }} />
        <div style={{ position: 'absolute', left: '70%', top: -20, width: 36, height: 200, background: `linear-gradient(180deg, ${C.cyan}22, transparent)`, transform: 'skewX(-12deg)', filter: 'blur(6px)' }} />
        {/* swimming fish */}
        <Fish tier="common"    x={28}  y={86} dir={1}  size={48} delay={0.2} />
        <Fish tier="rare"      x={130} y={36} dir={-1} size={56} delay={0.6} />
        <Fish tier="legendary" x={210} y={92} dir={1}  size={62} delay={0.0} />
        {/* sea floor */}
        <svg width="100%" height="40" viewBox="0 0 335 40" preserveAspectRatio="none"
             style={{ position: 'absolute', bottom: 0, left: 0 }}>
          <path d="M0,24 C60,12 120,32 200,22 C260,12 310,30 335,24 L335,40 L0,40 Z" fill="#0e1d27"/>
        </svg>
        <div style={{ position: 'absolute', left: 18, bottom: 4 }}><AlgaeIcon size={24} /></div>
        <div style={{ position: 'absolute', left: 76, bottom: 2 }}><AlgaeIcon size={20} /></div>
        <div style={{ position: 'absolute', right: 28, bottom: 4 }}><AlgaeIcon size={22} /></div>
      </div>

      {/* Reward loop */}
      <div style={{
        margin: '12px 20px 0', padding: '12px 10px',
        background: C.card + '88', borderRadius: 16, border: `1px solid ${C.cyan}1a`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        {loopItems.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 0, position: 'relative' }}>
              <div style={{
                width: 34, height: 34, borderRadius: 11, position: 'relative',
                background: s.source ? 'rgba(85,221,224,0.14)' : 'rgba(85,221,224,0.06)',
                border: s.source ? `1px dashed ${C.cyan}55` : '1px solid transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {s.icon}
                {s.gain && (
                  <span style={{
                    position: 'absolute', top: -6, right: -6,
                    width: 16, height: 16, borderRadius: '50%',
                    background: '#7adf8a', color: '#0d2014',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 800, lineHeight: 1,
                    boxShadow: '0 0 8px rgba(122,223,138,0.6), inset 0 1px 0 rgba(255,255,255,0.5)',
                  }}>+</span>
                )}
              </div>
              <div style={{
                fontSize: 10, color: s.source ? C.cyan : C.text, fontWeight: s.source ? 600 : 500,
                letterSpacing: 0.3, fontStyle: s.source ? 'italic' : 'normal',
              }}>{s.label}</div>
            </div>
            {i < loopItems.length - 1 && (
              <span style={{ color: C.text2, opacity: 0.5, marginTop: -10, marginLeft: 2, marginRight: 2 }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Fish tier grid */}
      <div style={{ margin: '12px 20px 0', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {tiers.map((t, i) => (
          <div key={t.id} style={{
            background: C.card + 'cc', borderRadius: 16, padding: '10px 8px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            border: `1px solid ${t.accent}22`,
            boxShadow: t.id !== 'common' ? `0 0 14px ${t.accent}1f` : 'none',
            animation: `srPanel 500ms cubic-bezier(.2,.7,.2,1) ${i * 90}ms backwards`,
          }}>
            <FishSpriteSlot tier={t.id} />
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: 13, fontWeight: 700, color: C.text, letterSpacing: -0.1,
                textShadow: t.id !== 'common' ? `0 0 8px ${t.accent}88` : 'none',
              }}>{t.name}</div>
              <div style={{
                fontSize: 10, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase',
                color: t.accent, opacity: 0.85, marginTop: 2,
              }}>{t.count} fish</div>
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div style={{ padding: '16px 20px 36px' }}>
        <button
          onClick={onStart}
          disabled={loading}
          style={{
            width: '100%', height: 54, borderRadius: 18, border: 'none',
            background: loading ? '#2f4858' : 'linear-gradient(180deg, #ffc14a, #f6ae2d)',
            color: loading ? '#6a9ab5' : '#2a1a05',
            fontWeight: 700, fontSize: 16, letterSpacing: 0.1, cursor: loading ? 'default' : 'pointer',
            boxShadow: loading ? 'none' : `0 0 24px ${C.honey}55, 0 8px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.5)`,
          }}
        >
          {loading ? '…' : 'Start Training'}
        </button>
      </div>
    </div>
  )
}
