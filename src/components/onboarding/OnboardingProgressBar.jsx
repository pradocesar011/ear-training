export default function OnboardingProgressBar({ current, total }) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', padding: '0 0 8px' }}>
      {Array.from({ length: total }, (_, i) => {
        const activeDot = current - 1 // 0-indexed
        const active    = i === activeDot
        const filled    = i < activeDot
        return (
          <div key={i} style={{
            width: active ? 20 : 6,
            height: 6,
            borderRadius: 4,
            background: active
              ? 'linear-gradient(90deg, #55dde0, #8af0f3)'
              : filled ? '#7db8bb' : 'rgba(85,221,224,0.2)',
            boxShadow: active ? '0 0 8px #55dde0' : 'none',
            transition: 'width 0.3s, background 0.3s',
          }} />
        )
      })}
    </div>
  )
}
