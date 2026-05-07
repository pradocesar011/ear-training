import { useState } from 'react'
import { useAppContext } from '../../context/AppContext.jsx'
import { useSurveySubmit } from '../../hooks/useSurveySubmit.js'
import OnboardingProgressBar from './OnboardingProgressBar.jsx'
import ReefBackdrop from './ReefBackdrop.jsx'
import TermsStep         from './steps/TermsStep.jsx'
import SurveyStep        from './steps/SurveyStep.jsx'
import AppIntroStep      from './steps/AppIntroStep.jsx'
import TrainingIntroStep from './steps/TrainingIntroStep.jsx'
import ReefIntroStep     from './steps/ReefIntroStep.jsx'

const TOTAL_STEPS = 5

const EMPTY_SURVEY = {
  hasFormalTraining:  null,
  trainingYears:      null,
  playsInstrument:    null,
  mainInstrument:     null,
  practicedDictation: null,
  ageRange:           null,
  mainGoal:           null,
}

export default function OnboardingFlow({ onComplete }) {
  const { user } = useAppContext()
  const { submitSurvey } = useSurveySubmit()

  const [step,       setStep]       = useState(1)
  const [slideDir,   setSlideDir]   = useState(1) // 1 = forward, -1 = back
  const [surveyData, setSurveyData] = useState(EMPTY_SURVEY)
  const [submitting, setSubmitting] = useState(false)

  function goTo(nextStep, dir = 1) {
    setSlideDir(dir)
    setStep(nextStep)
  }

  async function handleSurveyNext(skip = false) {
    setSubmitting(true)
    if (!skip) {
      await submitSurvey(user.userId, surveyData)
    }
    setSubmitting(false)
    goTo(3, 1)
  }

  async function handleComplete() {
    setSubmitting(true)
    await onComplete()
    setSubmitting(false)
  }

  // Steps 1–2: card layout on dark ocean floor
  if (step <= 2) {
    return (
      <div style={{
        minHeight: '100dvh', background: '#1a2a35',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '24px 20px',
      }}>
        <div style={{
          width: '100%', maxWidth: 420,
          background: '#2f4858', borderRadius: 20,
          padding: '28px 24px',
          border: '1px solid #3d5f73',
          display: 'flex', flexDirection: 'column',
          minHeight: 520, maxHeight: 'calc(100dvh - 48px)',
        }}>
          <OnboardingProgressBar current={step} total={TOTAL_STEPS} />

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', marginTop: 20, minHeight: 0 }}>
            {step === 1 && (
              <TermsStep onNext={() => goTo(2)} />
            )}
            {step === 2 && (
              <SurveyStep
                surveyData={surveyData}
                onChange={setSurveyData}
                onBack={() => goTo(1, -1)}
                onNext={() => handleSurveyNext(false)}
                onSkip={() => handleSurveyNext(true)}
                loading={submitting}
              />
            )}
          </div>
        </div>
      </div>
    )
  }

  // Steps 3–5: full-screen underwater layout
  return (
    <div style={{
      position: 'relative', height: '100dvh', overflow: 'hidden',
      color: '#e8f8f9', fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <ReefBackdrop />

      <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Top chrome: back arrow + 5-dot progress */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 20px 0', flexShrink: 0,
        }}>
          <button
            onClick={() => goTo(step - 1, -1)}
            style={{
              width: 36, height: 36, borderRadius: 12, border: 'none',
              background: 'transparent', color: '#6a9ab5', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 8 }}>
            {[0, 1, 2, 3, 4].map(i => {
              const activeDot = step - 1 // 0-indexed
              const active    = i === activeDot
              const filled    = i < activeDot
              return (
                <span key={i} style={{
                  width: active ? 22 : 6, height: 6, borderRadius: 999,
                  background: active
                    ? 'linear-gradient(90deg, #55dde0, #8af0f3)'
                    : filled ? '#7db8bb' : 'rgba(125,184,187,0.25)',
                  boxShadow: active ? '0 0 10px #55dde0' : 'none',
                  transition: 'all 360ms cubic-bezier(.2,.7,.2,1)',
                }} />
              )
            })}
          </div>

          {/* spacer to balance back button */}
          <div style={{ width: 36 }} />
        </div>

        {/* Slide stage */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <div key={step} style={{
            position: 'absolute', inset: 0,
            animation: `${slideDir > 0 ? 'srSlideIn' : 'srSlideBack'} 420ms cubic-bezier(.2,.7,.2,1)`,
          }}>
            {step === 3 && <AppIntroStep      onNext={() => goTo(4)} />}
            {step === 4 && <TrainingIntroStep onNext={() => goTo(5)} />}
            {step === 5 && <ReefIntroStep     onStart={handleComplete} loading={submitting} />}
          </div>
        </div>
      </div>
    </div>
  )
}
