import { useMemo } from 'react'

export default function BubbleLayer() {
  const bubbles = useMemo(() => Array.from({ length: 18 }, (_, i) => ({
    id: i,
    size:    4 + Math.random() * 12,
    left:    Math.random() * 100,
    delay:   -Math.random() * 14,
    dur:     10 + Math.random() * 12,
    drift:   (Math.random() * 2 - 1) * 18,
    opacity: 0.12 + Math.random() * 0.25,
  })), [])

  return (
    <div style={{
      position: 'absolute', inset: 0,
      overflow: 'hidden', pointerEvents: 'none', zIndex: -1,
    }}>
      {bubbles.map(b => (
        <span key={b.id} style={{
          position: 'absolute',
          left: `${b.left}%`, bottom: -30,
          width: b.size, height: b.size, borderRadius: '50%',
          background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.8), rgba(85,221,224,0.15) 55%, transparent 70%)',
          boxShadow: '0 0 8px rgba(85,221,224,0.2)',
          animation: `srBubble ${b.dur}s linear ${b.delay}s infinite`,
          '--drift': `${b.drift}px`,
          '--o': b.opacity,
        }} />
      ))}
    </div>
  )
}
