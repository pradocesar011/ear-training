import { useState, useEffect, useRef } from 'react'

export default function InfoTip({ text, position = 'top', highlighted = false, onFirstInteract }) {
  const [visible, setVisible] = useState(false)
  const ref = useRef(null)
  const interactedRef = useRef(false)

  useEffect(() => {
    if (!visible) return
    function onOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setVisible(false)
    }
    document.addEventListener('mousedown', onOutside)
    document.addEventListener('touchstart', onOutside)
    return () => {
      document.removeEventListener('mousedown', onOutside)
      document.removeEventListener('touchstart', onOutside)
    }
  }, [visible])

  function handleInteract() {
    if (!interactedRef.current && onFirstInteract) {
      interactedRef.current = true
      onFirstInteract()
    }
  }

  const tipPositionStyle = position === 'top'
    ? { bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 8 }
    : { top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 8 }

  const caretStyle = position === 'top'
    ? { top: '100%', left: '50%', transform: 'translateX(-50%)',
        borderWidth: '5px 5px 0 5px', borderColor: '#2f4858 transparent transparent transparent' }
    : { bottom: '100%', left: '50%', transform: 'translateX(-50%)',
        borderWidth: '0 5px 5px 5px', borderColor: 'transparent transparent #2f4858 transparent' }

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
      <button
        onClick={() => { setVisible(v => !v); handleInteract() }}
        onMouseEnter={() => { setVisible(true); handleInteract() }}
        onMouseLeave={() => setVisible(false)}
        style={{
          width: 16, height: 16,
          borderRadius: '50%',
          background: highlighted ? 'rgba(85,221,224,0.3)' : 'rgba(85,221,224,0.15)',
          border: highlighted ? '1px solid rgba(85,221,224,0.9)' : '1px solid rgba(85,221,224,0.4)',
          color: '#55dde0',
          fontSize: 10,
          fontWeight: 700,
          fontStyle: 'italic',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          lineHeight: 1,
          flexShrink: 0,
          animation: highlighted ? 'srHighlight 1.6s ease-in-out infinite' : 'none',
        }}
        aria-label="Info"
      >
        i
      </button>
      {visible && (
        <div style={{
          position: 'absolute',
          ...tipPositionStyle,
          width: 200,
          background: '#2f4858',
          border: '1px solid #3d5f73',
          borderRadius: 10,
          padding: '10px 12px',
          color: '#e8f8f9',
          fontSize: 12,
          lineHeight: 1.5,
          zIndex: 100,
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          pointerEvents: 'none',
          whiteSpace: 'normal',
        }}>
          {text}
          <div style={{
            position: 'absolute',
            ...caretStyle,
            width: 0, height: 0,
            borderStyle: 'solid',
          }} />
        </div>
      )}
    </div>
  )
}
