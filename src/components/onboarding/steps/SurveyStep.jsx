import { useTranslation } from 'react-i18next'
import OnboardingNav from '../OnboardingNav.jsx'

const INSTRUMENTS = ['Piano', 'Guitar', 'Drums', 'Violin', 'Saxophone', 'Bass', 'Flute', 'Trumpet', 'Ukelele', 'Voice', 'Other']

function YesNo({ value, onChange, labelYes, labelNo }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {[{ label: labelYes, val: true }, { label: labelNo, val: false }].map(({ label, val }) => {
        const active = value === val
        return (
          <button key={label} onClick={() => onChange(active ? null : val)} style={{
            padding: '8px 20px', borderRadius: 20, fontSize: 14, fontWeight: 600,
            cursor: 'pointer', border: '1.5px solid',
            background: active ? '#55dde0' : 'transparent',
            borderColor: active ? '#55dde0' : '#33658a',
            color: active ? '#1a2a35' : '#7db8bb',
            transition: 'all 0.15s',
          }}>
            {label}
          </button>
        )
      })}
    </div>
  )
}

function Question({ label, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <p style={{ margin: '0 0 8px', color: '#e8f8f9', fontSize: 14, fontWeight: 600 }}>{label}</p>
      {children}
    </div>
  )
}

function ChipSelect({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {options.map(opt => {
        const v = typeof opt === 'string' ? opt : opt.value
        const l = typeof opt === 'string' ? opt : opt.label
        const active = value === v
        return (
          <button key={v} onClick={() => onChange(active ? null : v)} style={{
            padding: '6px 14px', borderRadius: 16, fontSize: 13,
            cursor: 'pointer', border: '1.5px solid',
            background: active ? '#f6ae2d' : 'transparent',
            borderColor: active ? '#f6ae2d' : '#33658a',
            color: active ? '#1a2a35' : '#7db8bb',
            fontWeight: active ? 700 : 400,
            transition: 'all 0.15s',
          }}>
            {l}
          </button>
        )
      })}
    </div>
  )
}

export default function SurveyStep({ surveyData, onChange, onNext, onBack, onSkip, loading }) {
  const { t } = useTranslation()
  const set = (key, val) => onChange({ ...surveyData, [key]: val })

  const yearsOptions = Array.from({ length: 10 }, (_, i) => i + 1)

  const ageRanges = [
    { value: 'under_18', label: t('onboarding.survey.age_under_18') },
    { value: '18_25',    label: t('onboarding.survey.age_18_25') },
    { value: '26_35',    label: t('onboarding.survey.age_26_35') },
    { value: '36_45',    label: t('onboarding.survey.age_36_45') },
    { value: '46_plus',  label: t('onboarding.survey.age_46_plus') },
  ]

  const goals = [
    { value: 'learn_scratch', label: t('onboarding.survey.goal_learn_scratch') },
    { value: 'improve',       label: t('onboarding.survey.goal_improve') },
    { value: 'music_school',  label: t('onboarding.survey.goal_music_school') },
    { value: 'fun',           label: t('onboarding.survey.goal_fun') },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ flexShrink: 0 }}>
        <h2 style={{ color: '#e8f8f9', fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>
          {t('onboarding.survey.heading')}
        </h2>
        <p style={{ color: '#7db8bb', fontSize: 13, margin: '0 0 16px' }}>
          {t('onboarding.survey.subheading')}
        </p>
      </div>

      {/* Scrollable questions area */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, paddingRight: 4 }}>

        <Question label={t('onboarding.survey.formal_training')}>
          <YesNo
            value={surveyData.hasFormalTraining}
            labelYes={t('onboarding.survey.yes')}
            labelNo={t('onboarding.survey.no')}
            onChange={v => { set('hasFormalTraining', v); if (!v) set('trainingYears', null) }}
          />
          <div style={{ maxHeight: surveyData.hasFormalTraining ? 80 : 0, overflow: 'hidden', transition: 'max-height 0.3s ease' }}>
            <div style={{ paddingTop: 12 }}>
              <label style={{ color: '#7db8bb', fontSize: 13, marginRight: 8 }}>
                {t('onboarding.survey.how_many_years')}
              </label>
              <select
                value={surveyData.trainingYears ?? ''}
                onChange={e => set('trainingYears', e.target.value ? Number(e.target.value) : null)}
                style={{ background: '#243545', border: '1px solid #33658a', borderRadius: 8, color: '#e8f8f9', padding: '6px 10px', fontSize: 14 }}
              >
                <option value="">—</option>
                {yearsOptions.map(y => <option key={y} value={y}>{y === 10 ? '10+' : y}</option>)}
              </select>
            </div>
          </div>
        </Question>

        <Question label={t('onboarding.survey.plays_instrument')}>
          <YesNo
            value={surveyData.playsInstrument}
            labelYes={t('onboarding.survey.yes')}
            labelNo={t('onboarding.survey.no')}
            onChange={v => { set('playsInstrument', v); if (!v) set('mainInstrument', null) }}
          />
          <div style={{ maxHeight: surveyData.playsInstrument ? 200 : 0, overflow: 'hidden', transition: 'max-height 0.3s ease' }}>
            <div style={{ paddingTop: 12 }}>
              <ChipSelect options={INSTRUMENTS} value={surveyData.mainInstrument} onChange={v => set('mainInstrument', v)} />
            </div>
          </div>
        </Question>

        <Question label={t('onboarding.survey.dictation')}>
          <YesNo
            value={surveyData.practicedDictation}
            labelYes={t('onboarding.survey.yes')}
            labelNo={t('onboarding.survey.no')}
            onChange={v => set('practicedDictation', v)}
          />
        </Question>

        <Question label={t('onboarding.survey.age_range')}>
          <ChipSelect options={ageRanges} value={surveyData.ageRange} onChange={v => set('ageRange', v)} />
        </Question>

        <Question label={t('onboarding.survey.main_goal')}>
          <ChipSelect options={goals} value={surveyData.mainGoal} onChange={v => set('mainGoal', v)} />
        </Question>

      </div>

      <OnboardingNav
        onBack={onBack}
        onNext={onNext}
        nextLabel={t('onboarding.survey.continue')}
        showSkip
        onSkip={onSkip}
        skipLabel={t('onboarding.survey.skip')}
        loading={loading}
      />
    </div>
  )
}
