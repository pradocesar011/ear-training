import { useState } from 'react'
import OnboardingNav from '../OnboardingNav.jsx'

const INSTRUMENTS = ['Piano', 'Guitar', 'Drums', 'Violin', 'Saxophone', 'Bass', 'Flute', 'Trumpet', 'Ukelele', 'Voice', 'Other']
const AGE_RANGES   = [{ value: 'under_18', label: 'Under 18' }, { value: '18_25', label: '18–25' }, { value: '26_35', label: '26–35' }, { value: '36_45', label: '36–45' }, { value: '46_plus', label: '46+' }]
const MAIN_GOALS   = [
  { value: 'learn_scratch', label: 'Learn from scratch' },
  { value: 'improve',       label: 'Improve existing skills' },
  { value: 'music_school',  label: 'Prepare for music school' },
  { value: 'fun',           label: 'Just for fun' },
]

function YesNo({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {['Yes', 'No'].map(opt => {
        const val = opt === 'Yes'
        const active = value === val
        return (
          <button
            key={opt}
            onClick={() => onChange(active ? null : val)}
            style={{
              padding: '8px 20px', borderRadius: 20, fontSize: 14, fontWeight: 600,
              cursor: 'pointer', border: '1.5px solid',
              background: active ? '#55dde0' : 'transparent',
              borderColor: active ? '#55dde0' : '#33658a',
              color: active ? '#1a2a35' : '#7db8bb',
              transition: 'all 0.15s',
            }}
          >
            {opt}
          </button>
        )
      })}
    </div>
  )
}

function Question({ label, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <p style={{ margin: '0 0 10px', color: '#e8f8f9', fontSize: 14, fontWeight: 600 }}>{label}</p>
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
          <button
            key={v}
            onClick={() => onChange(active ? null : v)}
            style={{
              padding: '6px 14px', borderRadius: 16, fontSize: 13,
              cursor: 'pointer', border: '1.5px solid',
              background: active ? '#f6ae2d' : 'transparent',
              borderColor: active ? '#f6ae2d' : '#33658a',
              color: active ? '#1a2a35' : '#7db8bb',
              fontWeight: active ? 700 : 400,
              transition: 'all 0.15s',
            }}
          >
            {l}
          </button>
        )
      })}
    </div>
  )
}

export default function SurveyStep({ surveyData, onChange, onNext, onBack, onSkip, loading }) {
  const set = (key, val) => onChange({ ...surveyData, [key]: val })

  const yearsOptions = Array.from({ length: 10 }, (_, i) => i + 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <h2 style={{ color: '#e8f8f9', fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>
        Tell us about yourself
      </h2>
      <p style={{ color: '#7db8bb', fontSize: 13, margin: '0 0 20px' }}>
        Helps us understand our users and improve the app
      </p>

      <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>

        <Question label="Do you have formal musical training?">
          <YesNo value={surveyData.hasFormalTraining} onChange={v => {
            if (!v) set('trainingYears', null)
            set('hasFormalTraining', v)
          }} />
          <div style={{
            maxHeight: surveyData.hasFormalTraining ? 80 : 0,
            overflow: 'hidden', transition: 'max-height 0.3s ease',
          }}>
            <div style={{ paddingTop: 12 }}>
              <label style={{ color: '#7db8bb', fontSize: 13, marginRight: 8 }}>How many years?</label>
              <select
                value={surveyData.trainingYears ?? ''}
                onChange={e => set('trainingYears', e.target.value ? Number(e.target.value) : null)}
                style={{
                  background: '#243545', border: '1px solid #33658a', borderRadius: 8,
                  color: '#e8f8f9', padding: '6px 10px', fontSize: 14,
                }}
              >
                <option value="">— select —</option>
                {yearsOptions.map(y => (
                  <option key={y} value={y}>{y === 10 ? '10+' : y}</option>
                ))}
              </select>
            </div>
          </div>
        </Question>

        <Question label="Do you play an instrument?">
          <YesNo value={surveyData.playsInstrument} onChange={v => {
            if (!v) set('mainInstrument', null)
            set('playsInstrument', v)
          }} />
          <div style={{
            maxHeight: surveyData.playsInstrument ? 200 : 0,
            overflow: 'hidden', transition: 'max-height 0.3s ease',
          }}>
            <div style={{ paddingTop: 12 }}>
              <ChipSelect
                options={INSTRUMENTS}
                value={surveyData.mainInstrument}
                onChange={v => set('mainInstrument', v)}
              />
            </div>
          </div>
        </Question>

        <Question label="Have you practiced melodic dictation before?">
          <YesNo value={surveyData.practicedDictation} onChange={v => set('practicedDictation', v)} />
        </Question>

        <Question label="Your age range">
          <ChipSelect
            options={AGE_RANGES}
            value={surveyData.ageRange}
            onChange={v => set('ageRange', v)}
          />
        </Question>

        <Question label="Main goal">
          <ChipSelect
            options={MAIN_GOALS}
            value={surveyData.mainGoal}
            onChange={v => set('mainGoal', v)}
          />
        </Question>

      </div>

      <OnboardingNav
        onBack={onBack}
        onNext={onNext}
        nextLabel="Start Training"
        showSkip
        onSkip={onSkip}
        loading={loading}
      />
    </div>
  )
}
