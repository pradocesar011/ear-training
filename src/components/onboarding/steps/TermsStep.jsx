import { useTranslation } from 'react-i18next'
import OnboardingNav from '../OnboardingNav.jsx'

export default function TermsStep({ onNext }) {
  const { t } = useTranslation()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <h2 style={{ color: '#e8f8f9', fontSize: 24, fontWeight: 700, margin: '0 0 16px', flexShrink: 0 }}>
        {t('onboarding.terms.heading')}
      </h2>

      <div style={{
        flex: 1, overflowY: 'auto', minHeight: 0,
        background: '#243545', borderRadius: 12,
        padding: '16px 18px', marginBottom: 8,
        border: '1px solid #3d5f73',
        color: '#b8dde0', fontSize: 14, lineHeight: 1.7,
      }}>
        <p style={{ marginTop: 0 }}>
          <strong style={{ color: '#e8f8f9' }}>{t('onboarding.terms.collect_title')}</strong>
        </p>
        <p>{t('onboarding.terms.collect_body')}</p>

        <p><strong style={{ color: '#e8f8f9' }}>{t('onboarding.terms.use_title')}</strong></p>
        <p>{t('onboarding.terms.use_body')}</p>

        <p><strong style={{ color: '#e8f8f9' }}>{t('onboarding.terms.control_title')}</strong></p>
        <p style={{ marginBottom: 0 }}>{t('onboarding.terms.control_body')}</p>
      </div>

      <OnboardingNav onNext={onNext} nextLabel={t('onboarding.terms.accept')} />
    </div>
  )
}
