import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import emailjs from '@emailjs/browser'

const SERVICE_ID  = import.meta.env.VITE_EMAILJS_SERVICE_ID
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID
const PUBLIC_KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY

export default function ContactModal({ onClose }) {
  const { t } = useTranslation()
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState('idle') // idle | sending | sent | error

  async function handleSend() {
    if (!message.trim() || status === 'sending') return
    setStatus('sending')
    try {
      await emailjs.send(SERVICE_ID, TEMPLATE_ID, { message: message.trim() }, PUBLIC_KEY)
      setStatus('sent')
      setTimeout(onClose, 2200)
    } catch {
      setStatus('error')
    }
  }

  const canSend = message.trim().length > 0 && status === 'idle'

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 200,
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
      />

      {/* Bottom sheet */}
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0,
        zIndex: 201,
        background: '#2f4858',
        borderRadius: '20px 20px 0 0',
        padding: '8px 20px 44px',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.5)',
        maxWidth: 480,
        margin: '0 auto',
        animation: 'srSlideIn 0.22s ease-out',
      }}>
        {/* Drag handle */}
        <div style={{
          width: 40, height: 4, borderRadius: 2,
          background: 'rgba(255,255,255,0.15)',
          margin: '12px auto 20px',
        }} />

        <h2 style={{ color: '#e8f8f9', fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
          {t('profile.contact_heading')}
        </h2>
        <p style={{ color: '#7db8bb', fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
          {t('profile.contact_body')}
        </p>

        {status === 'sent' ? (
          <div style={{
            textAlign: 'center', padding: '28px 0',
            color: '#55dde0', fontSize: 15, fontWeight: 600,
          }}>
            ✓ {t('profile.contact_sent')}
          </div>
        ) : (
          <>
            <textarea
              value={message}
              onChange={e => { setMessage(e.target.value); if (status === 'error') setStatus('idle') }}
              placeholder={t('profile.contact_placeholder')}
              rows={5}
              style={{
                width: '100%', borderRadius: 12,
                background: '#1a2a35',
                border: `1px solid ${status === 'error' ? '#f26419' : '#3d5f73'}`,
                color: '#e8f8f9', fontSize: 14,
                padding: '12px', resize: 'none',
                outline: 'none', lineHeight: 1.5,
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
            {status === 'error' && (
              <p style={{ color: '#f26419', fontSize: 12, marginTop: 6 }}>
                {t('profile.contact_error')}
              </p>
            )}
            <button
              onClick={handleSend}
              disabled={!canSend}
              style={{
                marginTop: 12, width: '100%', height: 50,
                borderRadius: 14, border: 'none',
                background: canSend ? '#3dc8cb' : '#3d5f73',
                color: canSend ? '#1a2a35' : '#6a9ab5',
                fontSize: 15, fontWeight: 700,
                cursor: canSend ? 'pointer' : 'default',
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              {status === 'sending' ? '…' : t('profile.contact_button')}
            </button>
          </>
        )}
      </div>
    </>
  )
}
