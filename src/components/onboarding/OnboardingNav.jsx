export default function OnboardingNav({ onBack, onNext, nextLabel = 'Continue', showSkip = false, onSkip, skipLabel = 'Skip for now', loading = false }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 24 }}>
      <div style={{ flex: 1 }}>
        {onBack && (
          <button
            onClick={onBack}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#6a9ab5', fontSize: 14, padding: '8px 0',
            }}
          >
            ← Back
          </button>
        )}
      </div>

      {showSkip && (
        <button
          onClick={onSkip}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#6a9ab5', fontSize: 13, padding: '8px 12px', textDecoration: 'underline',
          }}
        >
          {skipLabel}
        </button>
      )}

      <button
        onClick={onNext}
        disabled={loading}
        style={{
          background: loading ? '#2f4858' : '#55dde0',
          color: loading ? '#6a9ab5' : '#1a2a35',
          border: 'none', borderRadius: 10, padding: '12px 24px',
          fontSize: 15, fontWeight: 700, cursor: loading ? 'default' : 'pointer',
          transition: 'background 0.2s',
          minWidth: 120,
        }}
      >
        {loading ? '…' : nextLabel}
      </button>
    </div>
  )
}
