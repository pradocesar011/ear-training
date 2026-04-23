import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppContext } from '../context/AppContext.jsx'
import { supabase } from '../lib/supabase.js'
import { formatDuration, formatPrecision } from '../lib/utils.js'
import {
  TONAL_MODES,
  getStoredTonalMode, storeTonalMode,
  getStoredActiveOctaves, storeActiveOctaves,
} from '../lib/utils.js'
import { selectSessionIntervals } from '../engines/srs.js'

const SESSION_LENGTHS = [10, 20, 40]
const HEARINGS_OPTIONS = [1, 2, 3, 5, 8, 10]

export default function TrainScreen() {
  const { t } = useTranslation()
  const { user, session } = useAppContext()
  const { startSession } = session

  const [lastSession,  setLastSession]  = useState(null)
  const [dueCount,     setDueCount]     = useState(0)
  const [loadingStats, setLoadingStats] = useState(true)
  const [targetLength, setTargetLength] = useState(null)
  const [tonalMode,    setTonalMode]    = useState(getStoredTonalMode)
  const [hearingsOvr,  setHearingsOvr]  = useState(10)
  const [activeOctaves, setActiveOctaves] = useState(getStoredActiveOctaves)

  useEffect(() => {
    if (user.userId) fetchStats()
    else setLoadingStats(false)
  }, [user.userId])

  async function fetchStats() {
    setLoadingStats(true)

    const { data: sessions } = await supabase
      .from('sessions')
      .select('started_at, ended_at, exercises_count, idm_end')
      .eq('user_id', user.userId)
      .not('ended_at', 'is', null)
      .order('started_at', { ascending: false })
      .limit(1)

    if (sessions?.[0]) {
      const { data: exRows } = await supabase
        .from('exercises')
        .select('precision')
        .eq('user_id', user.userId)
        .gte('created_at', sessions[0].started_at)
        .lte('created_at', sessions[0].ended_at ?? new Date().toISOString())

      const avgPrecision = exRows?.length
        ? exRows.reduce((a, b) => a + (b.precision ?? 0), 0) / exRows.length
        : null
      const durationSec = sessions[0].ended_at
        ? Math.floor((new Date(sessions[0].ended_at) - new Date(sessions[0].started_at)) / 1000)
        : null

      setLastSession({ date: sessions[0].started_at, duration: durationSec, exercises: sessions[0].exercises_count, avgPrecision })
    }

    const { data: srsItems } = await supabase
      .from('srs_items').select('*').eq('user_id', user.userId)
    if (srsItems) {
      const sessionCount = sessions?.length ?? 0
      const { due, newItems } = selectSessionIntervals(srsItems, sessionCount, new Date())
      setDueCount(due.length + newItems.length)
    }

    setLoadingStats(false)
  }

  function handleTonalModeChange(mode) {
    setTonalMode(mode)
    storeTonalMode(mode)
  }

  // ── Octave toggle (consecutive, min 2) ────────────────────────────────────
  function toggleOctave(oct) {
    setActiveOctaves(prev => {
      const sorted = [...prev].sort((a, b) => a - b)
      const isActive = sorted.includes(oct)

      if (isActive) {
        if (sorted.length <= 2) return sorted  // minimum 2
        const min = sorted[0]
        const max = sorted[sorted.length - 1]
        if (oct !== min && oct !== max) return sorted  // only remove ends
        return sorted.filter(o => o !== oct)
      } else {
        const min = sorted[0]
        const max = sorted[sorted.length - 1]
        if (oct === min - 1 || oct === max + 1) {
          const next = [...sorted, oct].sort((a, b) => a - b)
          storeActiveOctaves(next)
          return next
        }
        return sorted  // non-adjacent, ignore
      }
    })
  }

  // Persist on change
  useEffect(() => {
    storeActiveOctaves(activeOctaves)
  }, [activeOctaves])

  function canToggle(oct) {
    const sorted = [...activeOctaves].sort((a, b) => a - b)
    const isActive = sorted.includes(oct)
    if (isActive) {
      if (sorted.length <= 2) return false
      return oct === sorted[0] || oct === sorted[sorted.length - 1]
    } else {
      return oct === sorted[0] - 1 || oct === sorted[sorted.length - 1] + 1
    }
  }

  const MODE_LABELS = {
    [TONAL_MODES.CHORDS_ONLY]:      t('tonal_context.mode_chords_only'),
    [TONAL_MODES.SCALE_AND_CHORDS]: t('tonal_context.mode_scale_and_chords'),
    [TONAL_MODES.SCALE_ONLY]:       t('tonal_context.mode_scale_only'),
  }

  function handleStart() {
    startSession(targetLength, { hearingsOverride: hearingsOvr, activeOctaves })
  }

  return (
    <div className="screen-enter flex flex-col items-center justify-start min-h-full px-4 pt-8 pb-24 gap-4">

      {/* Heading */}
      <div className="text-center mb-2" style={{ paddingTop: '20px' }}>
        <h1 className="text-3xl font-bold text-white tracking-tight">
          {t('train.ready_to_train')}
        </h1>
        {!loadingStats && dueCount > 0 && (
          <p className="text-cyan-300 text-sm mt-2">
            {t('train.intervals_due', { count: dueCount })}
          </p>
        )}
      </div>

      {/* Start button */}
      <button
        onClick={handleStart}
        disabled={!user.userCode}
        className="w-full max-w-sm py-5 bg-cyan-600 text-white text-xl font-bold rounded-2xl
          hover:bg-cyan-500 active:scale-95 disabled:opacity-40 transition-all duration-150
          shadow-xl shadow-indigo-900/40 mt-2" style={{ padding: '20px' }}
      >
        {t('common.start_session')}
      </button>

      {/* ── Session length ─────────────────────────────────────────────────── */}
      <SectionCard label={t('train.session_length')}>
        <div className="grid grid-cols-4 gap-2">
          <OptionButton
            label="∞"
            sublabel={t('nav.train').toLowerCase()}
            active={targetLength === null}
            onClick={() => setTargetLength(null)}
          />
          {SESSION_LENGTHS.map(n => (
            <OptionButton
              key={n}
              label={String(n)}
              sublabel={t('progress.col_exercises').toLowerCase()}
              active={targetLength === n}
              onClick={() => setTargetLength(n)}
            />
          ))}
        </div>
      </SectionCard>

      {/* ── Tonal context mode ─────────────────────────────────────────────── */}
      <SectionCard label={t('tonal_context.heading')}>
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(MODE_LABELS).map(([mode, label]) => (
            <OptionButton
              key={mode}
              label={label}
              active={tonalMode === mode}
              onClick={() => handleTonalModeChange(mode)}
            />
          ))}
        </div>
      </SectionCard>

      {/* ── Hearings per exercise ───────────────────────────────────────────── */}
      <SectionCard label={t('train.hearings_label')}>
        <div className="grid grid-cols-3 gap-2">
          {HEARINGS_OPTIONS.map(h => (
            <OptionButton
              key={h}
              label={String(h)}
              active={hearingsOvr === h}
              onClick={() => setHearingsOvr(h)}
            />
          ))}
        </div>
      </SectionCard>

      {/* ── Keyboard range ──────────────────────────────────────────────────── */}
      <SectionCard label={t('train.octave_range')}>
        <div className="grid grid-cols-6 gap-2 mb-4">
          {[1, 2, 3, 4, 5, 6].map(oct => {
            const isActive = activeOctaves.includes(oct)
            const toggleable = canToggle(oct)
            return (
              <OctaveButton
                key={oct}
                label={String(oct)}
                active={isActive}
                muted={!toggleable}
                onClick={() => toggleable && toggleOctave(oct)}
              />
            )
          })}
        </div>
        <div className="flex justify-center" style={{ paddingTop: '5px' }}>
          <MiniPiano activeOctaves={activeOctaves} />
        </div>
      </SectionCard>

      {/* ── Last session stats ──────────────────────────────────────────────── */}
      {!loadingStats && (
        <div className="w-full max-w-sm">
          {lastSession ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5" style={{ padding: '10px' }}>
              <p className="text-zinc-400 text-xs uppercase tracking-widest mb-4">
                {t('train.last_session')}
              </p>
              <div className="grid grid-cols-3 gap-3 text-center">
                <StatCell
                  value={lastSession.duration != null ? formatDuration(lastSession.duration) : '—'}
                  label={t('session.duration')}
                />
                <StatCell
                  value={lastSession.exercises ?? '—'}
                  label={t('session.exercises_completed')}
                />
                <StatCell
                  value={lastSession.avgPrecision != null ? formatPrecision(lastSession.avgPrecision) : '—'}
                  label={t('session.mean_precision')}
                />
              </div>
              <p className="text-zinc-500 text-xs text-center mt-4">
                {new Date(lastSession.date).toLocaleDateString()}
              </p>
            </div>
          ) : (
            <p className="text-zinc-500 text-sm text-center">{t('train.no_sessions_yet')}</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Mini Piano ────────────────────────────────────────────────────────────────

const WHITE_W  = 8
const WHITE_H  = 32
const BLACK_W  = 5
const BLACK_H  = 20
const OCTAVE_W = 7 * WHITE_W  // 56px
// C#, D#, F#, G#, A# left offsets within an octave
const BLACK_OFFSETS = [
  WHITE_W - 2,          // C# after C (w=8 → 6)
  2 * WHITE_W - 2,      // D# after D (14)
  4 * WHITE_W - 2,      // F# after F (30)
  5 * WHITE_W - 2,      // G# after G (38)
  6 * WHITE_W - 2,      // A# after A (46)
]

function MiniPiano({ activeOctaves }) {
  const totalWidth = 6 * OCTAVE_W

  return (
    <div
      className="relative rounded-md overflow-hidden border border-zinc-800 mt-1"
      style={{ width: totalWidth, height: WHITE_H }}
    >
      {[1, 2, 3, 4, 5, 6].map(oct => {
        const isActive = activeOctaves.includes(oct)
        const xBase = (oct - 1) * OCTAVE_W

        return (
          <div key={oct} className="absolute top-0" style={{ left: xBase }}>
            {/* White keys */}
            {[0, 1, 2, 3, 4, 5, 6].map(i => (
              <div
                key={i}
                className="absolute"
                style={{
                  left: i * WHITE_W,
                  top: 0,
                  width: WHITE_W - 1,
                  height: WHITE_H,
                  backgroundColor: isActive ? '#d4d4d8' : '#3f3f46',
                  borderRadius: '0 0 2px 2px',
                  borderRight: i < 6 ? '1px solid #27272a' : 'none',
                }}
              />
            ))}
            {/* Octave label on C */}
            <div
              className="absolute text-center z-20 pointer-events-none"
              style={{
                left: 0,
                bottom: 2,
                width: WHITE_W,
                fontSize: 5,
                color: isActive ? '#71717a' : '#27272a',
                lineHeight: 1,
              }}
            >
              {oct}
            </div>
            {/* Black keys */}
            {BLACK_OFFSETS.map((offset, i) => (
              <div
                key={i}
                className="absolute z-10"
                style={{
                  left: offset,
                  top: 0,
                  width: BLACK_W,
                  height: BLACK_H,
                  backgroundColor: isActive ? '#09090b' : '#09090b',
                  borderRadius: '0 0 2px 2px',
                  opacity: isActive ? 1 : 0.6,
                }}
              />
            ))}
          </div>
        )
      })}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionCard({ label, children }) {
  return (
    <div
      className="w-full max-w-lg bg-zinc-900/70 border border-zinc-800 rounded-2xl"
      style={{ padding: '10px' }}
    >
      <p className="text-white text-sm font-semibold" style={{ padding: '5px' }}>{label}</p>
      {children}
    </div>
  )
}

function OptionButton({ label, sublabel, active, onClick, muted }) {
  return (
    <button
      onClick={onClick}
      disabled={muted}
      className={`flex flex-col items-center justify-center min-h-[64px] py-4 px-4 rounded-xl
        font-semibold transition-all duration-150 w-full
        ${active
          ? 'bg-cyan-600 text-white shadow-lg shadow-indigo-900/40'
          : muted
            ? 'bg-zinc-800/40 text-zinc-500 cursor-default'
            : 'bg-zinc-800 text-zinc-100 hover:bg-zinc-800'}
      `}
    >
      <span className="text-lg leading-tight">{label}</span>
      {sublabel && <span className="text-xs opacity-60 mt-1 font-normal">{sublabel}</span>}
    </button>
  )
}

function OctaveButton({ label, active, muted, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={muted}
      className={`flex items-center justify-center min-h-[52px] rounded-xl
        text-base font-bold transition-all duration-150 w-full
        ${active
          ? 'bg-cyan-600 text-white shadow-lg shadow-indigo-900/40'
          : muted
            ? 'bg-zinc-800/40 text-zinc-500 cursor-default'
            : 'bg-zinc-800 text-zinc-100 hover:bg-zinc-800'}
      `}
    >
      {label}
    </button>
  )
}

function StatCell({ value, label }) {
  return (
    <div>
      <div className="text-xl font-bold text-white font-mono">{value}</div>
      <div className="text-zinc-400 text-xs mt-0.5 leading-tight">{label}</div>
    </div>
  )
}
