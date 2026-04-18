/**
 * WelcomeScreen — first-visit onboarding only.
 * Shows a generated code and lets the user confirm it or enter an existing one.
 * Returning users (code in localStorage) never see this screen.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import LanguageSelector from '../components/LanguageSelector.jsx'

export default function WelcomeScreen({
  suggestedCode,
  loading,
  onConfirm,        // (code) → confirm new code
  onEnterCode,      // (code) → enter existing code
  onChangeLanguage,
}) {
  const { t } = useTranslation()
  const [view, setView]         = useState('new')   // 'new' | 'existing'
  const [codeInput, setCodeInput] = useState('')
  const [inputError, setInputError] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleConfirm() {
    if (!suggestedCode || submitting) return
    setSubmitting(true)
    await onConfirm(suggestedCode)
    setSubmitting(false)
  }

  async function handleEnterCode(e) {
    e.preventDefault()
    if (!codeInput.trim() || submitting) return
    setInputError(false)
    setSubmitting(true)
    const ok = await onEnterCode(codeInput.trim().toUpperCase())
    if (!ok) setInputError(true)
    setSubmitting(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-slate-400 gap-3">
        <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        {t('common.loading')}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-5 py-10 gap-0">
      {/* Language selector — top right */}
      <div className="absolute top-4 right-4">
        <LanguageSelector onChange={onChangeLanguage} />
      </div>

      {/* App title */}
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-white tracking-tight mb-2">
          {t('welcome_new.heading')}
        </h1>
        <p className="text-slate-400">{t('welcome_new.subtitle')}</p>
      </div>

      {view === 'new' ? (
        /* ── New user: show suggested code ─────────────────────────────── */
        <div className="w-full max-w-sm flex flex-col items-center gap-6">
          <div className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-7 text-center">
            <p className="text-slate-400 text-xs font-medium uppercase tracking-widest mb-4">
              {t('welcome_new.new_code_heading')}
            </p>

            {/* The code */}
            <div className="font-mono text-5xl font-bold text-indigo-400 tracking-[0.2em] mb-5">
              {suggestedCode ?? '……'}
            </div>

            <p className="text-slate-400 text-sm leading-relaxed">
              {t('welcome_new.new_code_instruction')}
            </p>
          </div>

          {/* Primary CTA */}
          <button
            onClick={handleConfirm}
            disabled={!suggestedCode || submitting}
            className="w-full py-4 bg-indigo-600 text-white text-lg font-bold rounded-2xl
              hover:bg-indigo-500 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed
              transition-all shadow-lg shadow-indigo-900/30"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {t('common.loading')}
              </span>
            ) : t('welcome_new.start_button')}
          </button>

          {/* Switch to existing code */}
          <button
            onClick={() => setView('existing')}
            className="text-slate-500 text-sm hover:text-slate-300 transition-colors underline"
          >
            {t('welcome_new.have_code')}
          </button>
        </div>

      ) : (
        /* ── Existing user: enter code ──────────────────────────────────── */
        <div className="w-full max-w-sm flex flex-col items-center gap-5">
          <div className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-7">
            <p className="text-slate-300 font-medium mb-5">{t('welcome_new.enter_code_heading')}</p>

            <form onSubmit={handleEnterCode} className="flex flex-col gap-3">
              <input
                value={codeInput}
                onChange={e => { setCodeInput(e.target.value.toUpperCase()); setInputError(false) }}
                placeholder={t('welcome_new.enter_code_placeholder')}
                maxLength={6}
                autoFocus
                className={`w-full bg-slate-900 border rounded-xl px-4 py-3 text-white font-mono
                  text-2xl text-center tracking-[0.3em] uppercase focus:outline-none
                  focus:ring-2 focus:ring-indigo-500 transition-colors
                  ${inputError ? 'border-red-500' : 'border-slate-600'}`}
              />
              {inputError && (
                <p className="text-red-400 text-sm text-center">{t('welcome_new.code_not_found')}</p>
              )}
              <button
                type="submit"
                disabled={!codeInput.trim() || submitting}
                className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-xl
                  hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? t('common.loading') : t('welcome_new.enter_code_button')}
              </button>
            </form>
          </div>

          <button
            onClick={() => { setView('new'); setInputError(false); setCodeInput('') }}
            className="text-slate-500 text-sm hover:text-slate-300 transition-colors"
          >
            ← {t('welcome_new.back')}
          </button>
        </div>
      )}
    </div>
  )
}
