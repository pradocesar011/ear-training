import { useMemo } from 'react'

export default function ReefBackdrop() {
  const bubbles = useMemo(() => Array.from({ length: 22 }, (_, i) => {
    const size = 4 + Math.random() * 14
    return {
      id: i, size,
      left:    Math.random() * 100,
      delay:   -Math.random() * 14,
      dur:     10 + Math.random() * 12,
      drift:   (Math.random() * 2 - 1) * 18,
      opacity: 0.18 + Math.random() * 0.4,
    }
  }), [])

  return (
    <div style={{
      position: 'absolute', inset: 0, overflow: 'hidden',
      background: 'radial-gradient(120% 70% at 50% -10%, #2b4a5c 0%, #1f3441 35%, #16242e 70%, #111c24 100%)',
    }}>
      {/* caustic light shafts */}
      <div style={{
        position: 'absolute', inset: 0,
        background:
          'radial-gradient(50% 30% at 25% 0%, rgba(85,221,224,0.18), transparent 60%),' +
          'radial-gradient(45% 28% at 75% 0%, rgba(85,221,224,0.10), transparent 60%)',
        mixBlendMode: 'screen',
      }} />
      {/* deep glow */}
      <div style={{
        position: 'absolute', left: '50%', bottom: '-10%',
        transform: 'translateX(-50%)',
        width: 380, height: 220, borderRadius: '50%',
        background: 'radial-gradient(closest-side, rgba(51,101,138,0.45), transparent 70%)',
        filter: 'blur(10px)',
      }} />
      {/* drifting bubbles */}
      {bubbles.map(b => (
        <span key={b.id} style={{
          position: 'absolute',
          left: `${b.left}%`, bottom: -30,
          width: b.size, height: b.size, borderRadius: '50%',
          background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.85), rgba(85,221,224,0.18) 55%, transparent 70%)',
          boxShadow: '0 0 10px rgba(85,221,224,0.25)',
          animation: `srBubble ${b.dur}s linear ${b.delay}s infinite`,
          '--drift': `${b.drift}px`,
          '--o': b.opacity,
        }} />
      ))}
      {/* sea floor silhouette */}
      <svg width="100%" height="160" viewBox="0 0 375 160" preserveAspectRatio="none"
           style={{ position: 'absolute', bottom: 0, left: 0, opacity: 0.55 }}>
        <path d="M0,120 C60,90 110,140 170,120 C230,100 280,150 340,118 L375,130 L375,160 L0,160 Z" fill="#0d1820"/>
        <path d="M0,140 C50,128 110,150 175,140 C240,130 300,155 375,140 L375,160 L0,160 Z" fill="#0a1218"/>
      </svg>
    </div>
  )
}
