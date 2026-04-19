import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase.js'
import { useAppContext } from '../context/AppContext.jsx'
import LanguageSelector from '../components/LanguageSelector.jsx'
import { formatDuration, storeIDM } from '../lib/utils.js'

const INITIAL_IDM = 2.0

export default function ProfileScreen() {
  const { t } = useTranslation()
  const { user } = useAppContext()

  const [stats,         setStats]         = useState(null)
  const [loading,       setLoading]       = useState(true)
  const [copied,        setCopied]        = useState(false)
  const [resetPhase,    setResetPhase]    = useState('idle')   // idle | confirm | done
  const [showCodeEntry, setShowCodeEntry] = useState(false)
  const [codeInput,     setCodeInput]     = useState('')
  const [codeError,     setCodeError]     = useState(false)

  useEffect(() => {
    if (user.userId) fetchStats()
    else setLoading(false)
  }, [user.userId])

  async function fetchStats() {
    setLoading(true)
    const [{ data: sessions }, { data: exercises }] = await Promise.all([
      supabase.from('sessions')
        .select('started_at, ended_at')
        .eq('user_id', user.userId)
        .not('ended_at', 'is', null),
      supabase.from('exercises')
        .select('id')
        .eq('user_id', user.userId),
    ])

    const totalSessions  = sessions?.length ?? 0
    const totalExercises = exercises?.length ?? 0
    const totalSec = sessions?.reduce((acc, s) => {
      if (!s.ended_at) return acc
      return acc + Math.floor((new Date(s.ended_at) - new Date(s.started_at)) / 1000)
    }, 0) ?? 0

    setStats({ totalSessions, totalExercises, totalTime: totalSec })
    setLoading(false)
  }

  async function copyCode() {
    if (!user.userCode) return
    try {
      await navigator.clipboard.writeText(user.userCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  async function handleCodeSubmit(e) {
    e.preventDefault()
    if (!codeInput.trim()) return
    setCodeError(false)
    const ok = await user.enterCode(codeInput.trim().toUpperCase())
    if (ok) {
      setShowCodeEntry(false)
      setCodeInput('')
    } else {
      setCodeError(true)
    }
  }

  async function handleReset() {
    if (!user.userId) return
    setResetPhase('idle')
    await Promise.all([
      supabase.from('srs_items').delete().eq('user_id', user.userId),
      supabase.from('exercises').delete().eq('user_id', user.userId),
      supabase.from('sessions').delete().eq('user_id', user.userId),
    ])
    storeIDM(INITIAL_IDM)
    setStats({ totalSessions: 0, totalExercises: 0, totalTime: 0 })
    setResetPhase('done')
    setTimeout(() => setResetPhase('idle'), 3000)
  }

  return (
    <div className="screen-enter flex flex-col items-center min-h-full px-4 py-8 gap-5">
      <h1 className="text-2xl font-bold text-white text-center w-full max-w-sm" style={{ paddingTop: '20px' }}>{t('profile.heading')}</h1>
      <div className="w-full max-w-sm flex flex-col gap-5" >

      {/* ── Your Code ──────────────────────────────────────────────────────── */}
      <Card>
        <SectionLabel>{t('profile.your_code')}</SectionLabel>
        <div className="flex items-center justify-between mt-2" >
          <span className="font-mono text-3xl font-bold text-cyan-400 tracking-widest">
            {user.userCode ?? '——'}
          </span>
          <button
            onClick={copyCode}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-zinc-800 text-zinc-300 rounded-xl text-sm
              hover:bg-zinc-800 transition-colors font-medium" style={{ padding: '10px' }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            {copied ? t('profile.copied') : t('profile.copy_code')}
          </button>
        </div>
        <p className="text-zinc-500 text-xs mt-2" style={{ paddingTop: '10px' }}>{t('profile.code_instruction')}</p>
      </Card>

      {/* ── Switch Account (Logout) ────────────────────────────────────────── */}
      <Card>
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium">{t('profile.logout')}</p>
            <p className="text-zinc-500 text-xs mt-0.5 leading-snug"style={{ paddingTop: '10px', paddingBottom: '10px' }}>
              {t('profile.code_instruction')}
            </p>
          </div>
        </div>
        <button
          onClick={user.logout}
          className="mt-4 w-full py-3.5 bg-zinc-800 text-zinc-300 rounded-xl text-sm font-medium
            hover:bg-zinc-800 transition-colors" style={{ paddingTop: '10px', paddingBottom: '10px' }}
        >
          {t('profile.logout')}
        </button>
      </Card>

      {/* ── Change User Code ──────────────────────────────────────────────── */}
      <Card>
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium">{t('profile.change_code')}</p>
            <p className="text-zinc-500 text-xs mt-0.5 leading-snug" style={{ paddingTop: '10px', paddingBottom: '10px' }}>
              {t('profile.enter_code_label')}
            </p>
          </div>
        </div>

        {!showCodeEntry ? (
          <button
            onClick={() => setShowCodeEntry(true)}
            className="mt-3 w-full py-2 bg-zinc-800 text-zinc-300 rounded-xl text-sm font-medium
              hover:bg-zinc-800 transition-colors"style={{ paddingTop: '10px', paddingBottom: '10px' }}
          >
            {t('profile.change_code')}
          </button>
        ) : (
          <form onSubmit={handleCodeSubmit} className="flex flex-col gap-2 mt-3">
            <input
              value={codeInput}
              onChange={e => { setCodeInput(e.target.value.toUpperCase()); setCodeError(false) }}
              placeholder={t('profile.enter_code_placeholder')}
              maxLength={6}
              className={`bg-zinc-950 border rounded-xl px-3 py-2.5 text-white font-mono text-center
                tracking-widest uppercase text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500
                ${codeError ? 'border-rose-500' : 'border-zinc-700'}`} style={{ paddingTop: '5px', paddingBottom: '5px' }}
            />
            {codeError && <p className="text-rose-500 text-xs">{t('welcome_new.code_not_found')}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setShowCodeEntry(false); setCodeError(false) }}
                className="flex-1 py-3 bg-zinc-800 text-zinc-300 rounded-xl text-sm hover:bg-zinc-800 transition-colors"style={{ paddingTop: '10px', paddingBottom: '10px' }}
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                className="flex-1 py-3 bg-cyan-600 text-white rounded-xl text-sm hover:bg-cyan-500 transition-colors"
              >
                {t('common.confirm')}
              </button>
            </div>
          </form>
        )}
      </Card>

      {/* ── Language ──────────────────────────────────────────────────────── */}
      <Card>
        <SectionLabel>{t('profile.language_label')}</SectionLabel>
        <div className="mt-3" style={{ paddingTop: '10px', paddingBottom: '10px' }}>
          <LanguageSelector onChange={user.changeLanguage} />
        </div>
      </Card>

      {/* ── Statistics ────────────────────────────────────────────────────── */}
      <Card>
        <SectionLabel>{t('profile.global_stats')}</SectionLabel>
        {loading ? (
          <p className="text-zinc-500 text-sm mt-3">{t('common.loading')}</p>
        ) : (
          <div className="mt-3 space-y-0">
            <StatRow label={t('profile.total_sessions')}  value={stats?.totalSessions ?? 0} />
            <StatRow label={t('profile.total_exercises')} value={stats?.totalExercises ?? 0} />
            <StatRow
              label={t('profile.total_time')}
              value={stats?.totalTime ? formatDuration(stats.totalTime) : '0m'}
            />
          </div>
        )}
      </Card>

      {/* ── Reset Progress ────────────────────────────────────────────────── */}
      <div className="bg-rose-950/30 border border-rose-900/40 rounded-2xl p-5" style={{ padding: '20px' }}>
        <SectionLabel className="text-rose-500">{t('profile.reset_heading')}</SectionLabel>

        {resetPhase === 'idle' && (
          <>
            <p className="text-zinc-500 text-xs mt-2 mb-4 leading-relaxed"style={{ paddingTop: '5px', paddingBottom: '5px' }}>
              {t('profile.reset_warning')}
            </p>
            <button
              onClick={() => setResetPhase('confirm')}
              className="px-6 py-3 bg-rose-950/40 border border-rose-800/50 text-rose-500 rounded-xl
                text-sm hover:bg-rose-950/60 transition-colors"style={{ padding: '5px' }}
            >
              {t('profile.reset_button')}
            </button>
          </>
        )}

        {resetPhase === 'confirm' && (
          <div className="flex flex-col gap-3 mt-3">
            <p className="text-rose-400 text-sm font-medium">{t('profile.reset_warning')}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setResetPhase('idle')}
                className="flex-1 py-3 bg-zinc-800 text-zinc-300 rounded-xl text-sm hover:bg-zinc-800 transition-colors"
              >
                {t('profile.reset_cancel')}
              </button>
              <button
                onClick={handleReset}
                className="flex-1 py-3 bg-rose-700 text-white rounded-xl text-sm hover:bg-rose-600 transition-colors"
              >
                {t('profile.reset_confirm')}
              </button>
            </div>
          </div>
        )}

        {resetPhase === 'done' && (
          <p className="text-emerald-400 text-sm mt-3">✓ {t('common.confirm')}</p>
        )}
      </div>

      </div>{/* /max-w-sm */}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Card({ children }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6" style={{ padding: '20px' }}>
      {children}
    </div>
  )
}

function SectionLabel({ children, className = '' }) {
  return (
    <p className={`text-zinc-400 text-xs font-medium uppercase tracking-widest ${className}`} >
      {children}
    </p>
  )
}

function StatRow({ label, value }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-zinc-800/50 last:border-0" style={{ padding: '20px' }}>
      <span className="text-zinc-400 text-sm">{label}</span>
      <span className="text-white text-sm font-mono font-medium">{value}</span>
    </div>
  )
}
