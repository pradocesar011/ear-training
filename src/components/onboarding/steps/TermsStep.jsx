import { useTranslation } from 'react-i18next'
import OnboardingNav from '../OnboardingNav.jsx'

export default function TermsStep({ onNext }) {
  const { t } = useTranslation()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <h2 style={{ color: '#e8f8f9', fontSize: 24, fontWeight: 700, margin: '0 0 20px' }}>
        Before you begin
      </h2>

      <div
        style={{
          flex: 1, overflowY: 'auto',
          background: '#243545', borderRadius: 12,
          padding: '16px 18px', marginBottom: 8,
          border: '1px solid #3d5f73',
          color: '#b8dde0', fontSize: 14, lineHeight: 1.7,
        }}
      >
        <p style={{ marginTop: 0 }}>
          <strong style={{ color: '#e8f8f9' }}>What we collect</strong>
        </p>
        <p>
          Sound Reef stores a random identification code, your language preference, and training
          performance metrics — such as which intervals you practiced, precision scores, and
          session timing. No name, email address, or any other personal information is required
          or stored.
        </p>

        <p>
          <strong style={{ color: '#e8f8f9' }}>How we use it</strong>
        </p>
        <p>
          Your data is used solely to power the app (track your progress, feed your fish) and
          to research and improve ear-training methods. It is never sold or shared with
          third parties.
        </p>

        <p>
          <strong style={{ color: '#e8f8f9' }}>Your control</strong>
        </p>
        <p style={{ marginBottom: 0 }}>
          You can delete all your data at any time via <strong>Profile → Reset Progress</strong>.
          Continuing past this screen means you accept these terms.
        </p>
      </div>

      <OnboardingNav
        onNext={onNext}
        nextLabel="I Accept & Continue"
      />
    </div>
  )
}
