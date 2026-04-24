/**
 * ReviewScreen — review past exercises with errors and track upcoming SRS items.
 *
 * List view:
 *   Section 1 — recent error exercises (last 3 sessions, precision < 1.0)
 *   Section 2 — upcoming SRS intervals (due soon or overdue)
 *
 * Exercise view:
 *   Replay the original exercise, unlimited listens, confirm answer,
 *   try again or mark as reviewed. Saves to review_attempts table.
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase.js'
import { useAppContext } from '../context/AppContext.jsx'
import { estimateHalfLife, recallProbability } from '../engines/srs.js'
import { computeWeightedPrecision } from '../engines/idm.js'
import { CHUNK_RULES, COLORS } from '../config/constants.js'
import PianoKeyboard from '../components/PianoKeyboard.jsx'

// ── helpers ───────────────────────────────────────────────────────────────────

function urgencyBorder() {
  return { border: 'border-l-zinc-700', bg: 'transparent' }
}

function precisionColor(p) {
  if (p >= 0.8) return '#10b981'
  if (p >= 0.5) return '#f97316'
  return '#ef4444'
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ReviewScreen() {
  const { t, i18n } = useTranslation()
  const { user, audio, session, setReviewInExercise } = useAppContext()
  const lang = i18n.language?.slice(0, 2) ?? 'es'

  const [loading,       setLoading]       = useState(true)
  const [recentErrors,  setRecentErrors]  = useState([])
  const [srsItems,      setSrsItems]      = useState([])
  const [completedIds,  setCompletedIds]  = useState(new Set())
  const [view,          setView]          = useState('list')      // 'list' | 'exercise'
  const [selectedEx,    setSelectedEx]    = useState(null)

  // ── exercise review state ─────────────────────────────────────────────────
  const [noteIndex,        setNoteIndex]        = useState(0)
  const [userSequence,     setUserSequence]     = useState([])
  const [exerciseResult,   setExerciseResult]   = useState(null)
  const [attemptNumber,    setAttemptNumber]    = useState(1)
  const [showHearingBonus, setShowHearingBonus] = useState(false)
  const [highlightOk,      setHighlightOk]      = useState([])
  const [highlightBad,     setHighlightBad]     = useState([])
  const [highlightBadFade, setHighlightBadFade] = useState([])
  const [isPlaying,        setIsPlaying]        = useState(false)

  const highlightTimerRef = useRef(null)
  const bonusGivenRef     = useRef(false)

  // Cleanup: restore nav when component unmounts
  useEffect(() => () => setReviewInExercise(false), [])

  // ── data fetching ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (user.userId) fetchData()
  }, [user.userId])

  async function fetchData() {
    setLoading(true)
    const [sessRes, srsRes, completedRes] = await Promise.all([
      supabase
        .from('sessions')
        .select('id')
        .eq('user_id', user.userId)
        .not('ended_at', 'is', null)
        .order('ended_at', { ascending: false })
        .limit(3),
      supabase
        .from('srs_items')
        .select('*')
        .eq('user_id', user.userId),
      supabase
        .from('review_attempts')
        .select('exercise_id')
        .eq('user_id', user.userId)
        .gte('precision', 0.999)
        .eq('completed', true),
    ])

    setSrsItems(srsRes.data ?? [])
    setCompletedIds(new Set((completedRes.data ?? []).map(r => r.exercise_id)))

    const sessions = sessRes.data ?? []
    if (sessions.length > 0) {
      const sessionIds = sessions.map(s => s.id)
      const { data: exercises } = await supabase
        .from('exercises')
        .select('*')
        .in('session_id', sessionIds)
        .lt('precision', 1.0)
        .order('created_at', { ascending: false })
      setRecentErrors(exercises ?? [])
    } else {
      setRecentErrors([])
    }

    setLoading(false)
  }

  // ── open / close exercise ─────────────────────────────────────────────────

  function openExercise(exercise) {
    audio.stopAll()
    setSelectedEx(exercise)
    setNoteIndex(0)
    setUserSequence([])
    setExerciseResult(null)
    setAttemptNumber(1)
    setShowHearingBonus(false)
    setHighlightOk([])
    setHighlightBad([])
    setHighlightBadFade([])
    setIsPlaying(false)
    bonusGivenRef.current = false
    setReviewInExercise(true)
    setView('exercise')
  }

  function closeExercise() {
    audio.stopAll()
    clearTimeout(highlightTimerRef.current)
    setReviewInExercise(false)
    setView('list')
    setSelectedEx(null)
    setExerciseResult(null)
    setShowHearingBonus(false)
  }

  // ── playback ──────────────────────────────────────────────────────────────

  async function handlePlay() {
    if (!selectedEx || !audio.ready) return
    if (isPlaying) {
      audio.stopAll()
      setIsPlaying(false)
      return
    }
    audio.stopAll()
    setIsPlaying(true)
    const notes = selectedEx.sequence.map(s => s.note)
    const rule  = CHUNK_RULES.find(r => notes.length <= r.maxNotes) ?? CHUNK_RULES[CHUNK_RULES.length - 1]
    const dur   = await audio.playSequence(
      notes,
      selectedEx.tempo,
      rule.silenceEnabled ? rule.notesPerChunk : 0,
      rule.silenceEnabled ? rule.silenceBeats  : 0,
    )
    setTimeout(() => setIsPlaying(false), (dur ?? 3) * 1000 + 200)
  }

  // ── note input ────────────────────────────────────────────────────────────

  const handleNote = useCallback(async (note) => {
    if (!selectedEx || exerciseResult || noteIndex >= selectedEx.sequence.length) return

    await audio.playNote(note)

    const expected = selectedEx.sequence[noteIndex]?.note
    const correct  = note === expected

    clearTimeout(highlightTimerRef.current)
    if (correct) {
      setHighlightOk([note])
      setHighlightBad([])
      setHighlightBadFade([])
      highlightTimerRef.current = setTimeout(() => setHighlightOk([]), 350)
    } else {
      setHighlightBad([note])
      setHighlightBadFade([])
      highlightTimerRef.current = setTimeout(() => {
        setHighlightBad([])
        setHighlightBadFade([note])
        highlightTimerRef.current = setTimeout(() => setHighlightBadFade([]), 1800)
      }, 200)
    }

    const newSeq  = [...userSequence, note]
    setUserSequence(newSeq)
    setNoteIndex(noteIndex + 1)
  }, [selectedEx, exerciseResult, noteIndex, userSequence, audio])

  function clearLast() {
    if (!userSequence.length || exerciseResult) return
    setUserSequence(prev => prev.slice(0, -1))
    setNoteIndex(prev => Math.max(0, prev - 1))
  }

  function clearAll() {
    if (exerciseResult) return
    setUserSequence([])
    setNoteIndex(0)
    setHighlightOk([])
    setHighlightBad([])
    setHighlightBadFade([])
  }

  // ── confirm ───────────────────────────────────────────────────────────────

  async function handleConfirm() {
    if (!selectedEx || exerciseResult) return
    const expected = selectedEx.sequence.map(s => s.note)
    const padded   = [...userSequence]
    while (padded.length < expected.length) padded.push(null)

    const correct   = expected.map((n, i) => padded[i] === n)
    const precision = computeWeightedPrecision(expected, padded)

    let attemptId = null
    try {
      const { data } = await supabase
        .from('review_attempts')
        .insert({
          user_id:        user.userId,
          exercise_id:    selectedEx.id,
          attempt_number: attemptNumber,
          user_sequence:  padded,
          correct,
          precision,
          completed:      false,
        })
        .select('id')
        .single()
      attemptId = data?.id ?? null
    } catch {}

    setExerciseResult({ precision, correct, attemptId, padded, expected })

    if (precision >= 1.0 && !bonusGivenRef.current) {
      bonusGivenRef.current = true
      session.addExtraHearing()
      setShowHearingBonus(true)
    }
  }

  function handleTryAgain() {
    setNoteIndex(0)
    setUserSequence([])
    setExerciseResult(null)
    setAttemptNumber(prev => prev + 1)
    setHighlightOk([])
    setHighlightBad([])
  }

  async function handleMarkReviewed() {
    if (exerciseResult?.attemptId && user.userId) {
      try {
        await supabase
          .from('review_attempts')
          .update({ completed: true })
          .eq('id', exerciseResult.attemptId)
      } catch {}
    }
    if (selectedEx && (exerciseResult?.precision ?? 0) >= 0.999) {
      setCompletedIds(prev => new Set([...prev, selectedEx.id]))
    }
    closeExercise()
  }

  // ── active octaves from the exercise sequence ─────────────────────────────

  const activeOctaves = selectedEx
    ? [...new Set(selectedEx.sequence.map(s => parseInt(s.note.slice(-1))))]
    : [3, 4]

  // ── tonicHighlight: first note only ──────────────────────────────────────

  const tonicHighlight = selectedEx?.sequence?.[0]?.note
    ? [selectedEx.sequence[0].note]
    : []

  // ── result highlights ─────────────────────────────────────────────────────

  let resultOk  = []
  let resultBad = []
  if (exerciseResult) {
    const { expected, correct, padded } = exerciseResult
    expected.forEach((n, i) => {
      if (correct[i]) resultOk.push(n)
      else if (padded[i]) resultBad.push(padded[i])
    })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ── RENDER ───────────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-full text-zinc-400">
        {t('common.loading')}
      </div>
    )
  }

  // ── Exercise review view ──────────────────────────────────────────────────

  if (view === 'exercise' && selectedEx) {
    const total     = selectedEx.sequence.length
    const filled    = userSequence.length
    const allFilled = filled >= total
    const origPrec  = Math.round((selectedEx.precision ?? 0) * 100)

    return (
      <div className="screen-enter flex flex-col items-center min-h-screen px-4 pt-5 gap-4">

        {/* top bar */}
        <div className="w-full max-w-2xl mx-auto flex items-center justify-between gap-3
                        bg-zinc-900/60 border border-zinc-800 rounded-2xl px-4 py-3"
             style={{ padding: '10px' }}>
          <button
            onClick={closeExercise}
            className="flex items-center gap-1.5 text-zinc-400 hover:text-white text-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t('common.back')}
          </button>

          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span>{t('review.unlimitedListens')}</span>
            <span className="font-mono" style={{ color: precisionColor(selectedEx.precision ?? 0) }}>
              {origPrec}%
            </span>
          </div>

          <span className="text-zinc-500 text-xs font-mono">
            {t('review.attemptsToCorrect')}: {attemptNumber}
          </span>
        </div>

        {/* note slots + clear buttons — vertically centered */}
        <div className="flex-1 w-full flex flex-col items-center justify-center gap-8">
          {/* note slots */}
          <div className="w-full max-w-2xl mx-auto">
            <div className="flex flex-wrap gap-1.5 justify-center">
              {selectedEx.sequence.map((slot, i) => {
                const answered = i < filled
                const userNote = userSequence[i]
                const correct  = exerciseResult ? exerciseResult.correct[i] : null

                let bg   = 'bg-zinc-800'
                let text = 'text-zinc-500'
                let label = '—'

                if (answered && !exerciseResult) {
                  bg    = 'bg-zinc-700'
                  text  = 'text-zinc-100'
                  label = userNote
                } else if (exerciseResult && correct === true) {
                  bg    = 'bg-emerald-900/50'
                  text  = 'text-emerald-300'
                  label = userNote ?? '—'
                } else if (exerciseResult && correct === false) {
                  bg    = 'bg-rose-900/50'
                  text  = 'text-rose-300'
                  label = userNote ?? '—'
                } else if (!answered && i === filled && !exerciseResult) {
                  bg   = 'bg-zinc-800 ring-1 ring-cyan-500/50'
                  text = 'text-zinc-600'
                }

                return (
                  <div
                    key={i}
                    className={`${bg} rounded-lg text-center font-mono text-xs font-medium min-w-[48px] px-2 py-3 ${text}`}
                  >
                    {label}
                    {exerciseResult && !exerciseResult.correct[i] && exerciseResult.expected[i] && (
                      <div className="text-emerald-500 text-[10px] mt-0.5">→{exerciseResult.expected[i]}</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* clear buttons + result info */}
          <div className="w-full max-w-2xl mx-auto flex items-center justify-between gap-3">
            <div className="flex gap-2">
              <button
                onClick={clearLast}
                disabled={!userSequence.length || !!exerciseResult}
                className="px-4 py-2.5 bg-zinc-800 text-zinc-400 rounded-lg text-sm
                  hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                {t('review.clearLast')}
              </button>
              <button
                onClick={clearAll}
                disabled={!userSequence.length || !!exerciseResult}
                className="px-4 py-2.5 bg-zinc-800 text-zinc-400 rounded-lg text-sm
                  hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                {t('review.clearAll')}
              </button>
            </div>
            {exerciseResult && (
              <span
                className="text-sm font-bold font-mono"
                style={{ color: precisionColor(exerciseResult.precision) }}
              >
                {Math.round(exerciseResult.precision * 100)}%
              </span>
            )}
          </div>
        </div>

        {/* play + action buttons + keyboard pinned to bottom */}
        <div className="w-full flex flex-col items-center gap-3 pb-0">

          {/* Play button */}
          <div className="w-full max-w-2xl px-4">
            <button
              onClick={handlePlay}
              disabled={!audio.ready}
              className={`w-full flex items-center justify-center gap-3 py-4 text-white
                rounded-2xl text-base font-bold active:scale-[0.98]
                disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150
                shadow-lg ${isPlaying
                  ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-900/30'
                  : 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-900/30'
                }`} style={{ padding: '16px' }}
            >
              {isPlaying ? (
                <>
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {t('tonal_context.stop')}
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                  </svg>
                  {t('common.play')}
                </>
              )}
            </button>
          </div>

          {/* Confirm / Try again / Mark reviewed */}
          <div className="w-full max-w-2xl px-4">
            {!exerciseResult ? (
              <button
                onClick={handleConfirm}
                disabled={!allFilled}
                className="w-full py-3 bg-zinc-700 text-white rounded-xl text-sm font-semibold
                  hover:bg-zinc-600 active:scale-[0.98]
                  disabled:opacity-30 disabled:cursor-not-allowed transition-all" style={{ padding: '14px' }}
              >
                {t('review.confirm')}
              </button>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={handleTryAgain}
                  className="flex-1 py-3 bg-zinc-800 text-zinc-300 rounded-xl text-sm font-semibold
                    hover:bg-zinc-700 active:scale-[0.98] transition-all" style={{ padding: '14px' }}
                >
                  {t('review.tryAgain')}
                </button>
                <button
                  onClick={handleMarkReviewed}
                  className="flex-1 py-3 bg-emerald-800/60 text-emerald-300 rounded-xl text-sm font-semibold
                    hover:bg-emerald-800/80 active:scale-[0.98] transition-all border border-emerald-700/40"
                  style={{ padding: '14px' }}
                >
                  {t('review.markReviewed')}
                </button>
              </div>
            )}
          </div>

          {/* Piano */}
          <div className="w-full">
            <PianoKeyboard
              onNote={handleNote}
              highlightCorrect={  exerciseResult ? resultOk  : highlightOk}
              highlightWrong={    exerciseResult ? resultBad : highlightBad}
              highlightWrongFade={exerciseResult ? []        : highlightBadFade}
              highlightTonic={tonicHighlight}
              activeOctaves={activeOctaves}
              disabled={!!exerciseResult || allFilled}
              language={lang}
            />
          </div>
        </div>

        {/* Extra hearing earned announcement */}
        {showHearingBonus && (
          <div
            className="absolute inset-0 flex items-center justify-center z-40"
            style={{ background: 'rgba(0,0,0,0.78)' }}
            onClick={() => setShowHearingBonus(false)}
          >
            <div
              className="bg-zinc-900 border border-cyan-500/60 rounded-2xl p-7 mx-6 text-center max-w-xs w-full"
              style={{ boxShadow: '0 0 40px rgba(34,211,238,0.18)' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="text-5xl mb-3">🎵</div>
              <h3 className="text-white text-xl font-bold mb-1">Extra Hearing Earned!</h3>
              <p className="text-cyan-300 text-sm font-semibold mb-3">+1 extra hearing</p>
              <p className="text-zinc-400 text-sm leading-relaxed">
                During training, once you've used your 2 regular hearings, tap{' '}
                <span className="text-cyan-300 font-semibold">"Use one"</span> to spend an
                extra hearing and listen again.
              </p>
              <div className="mt-2 text-zinc-500 text-xs">
                You now have{' '}
                <span className="text-cyan-300 font-bold">{session.extraHearings}</span>{' '}
                extra hearing{session.extraHearings !== 1 ? 's' : ''}.
              </div>
              <button
                onClick={() => setShowHearingBonus(false)}
                className="mt-5 px-6 py-2.5 bg-cyan-600 text-white font-semibold rounded-xl
                           hover:bg-cyan-500 active:scale-95 transition-all"
              >
                Got it!
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── List view ─────────────────────────────────────────────────────────────

  const now = new Date()
  const enrichedSRS = srsItems.map(item => {
    const h         = estimateHalfLife(item.correct_count, item.wrong_count, item.exposures)
    const lastSeen  = item.last_seen ? new Date(item.last_seen) : null
    const deltaDays = lastSeen ? (now - lastSeen) / 86400000 : 0
    const recall    = recallProbability(deltaDays, h)
    const nextRev   = item.next_review ? new Date(item.next_review) : null
    const overdue   = nextRev ? nextRev < now : false
    const dueToday  = nextRev ? nextRev.toDateString() === now.toDateString() : false
    return { ...item, recall, nextRev, overdue, dueToday }
  })

  // Upcoming: overdue + due today + next 7 days, sorted by urgency
  const upcoming = enrichedSRS
    .filter(item => {
      if (!item.nextRev) return false
      const daysAway = (item.nextRev - now) / 86400000
      return daysAway <= 7
    })
    .sort((a, b) => (a.nextRev - b.nextRev))

  return (
    <div className="screen-enter flex flex-col items-center min-h-full px-4 pt-8 pb-24 gap-8">
      <div className="w-full max-w-2xl flex flex-col items-center gap-2" style={{ paddingTop: '20px' }}>
        <h1 className="text-2xl font-bold text-white text-center">{t('review.title')}</h1>
        {session.extraHearings > 0 && (
          <div className="flex items-center gap-1.5 bg-cyan-900/40 border border-cyan-800/60 rounded-full px-3 py-1.5">
            <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15.536 8.464a5 5 0 010 7.072M12 6a7 7 0 010 12m-3.536-9.536a5 5 0 000 7.072" />
            </svg>
            <span className="text-cyan-300 text-xs font-semibold">
              {session.extraHearings} extra hearing{session.extraHearings !== 1 ? 's' : ''} saved
            </span>
          </div>
        )}
      </div>

      <div className="w-full max-w-2xl flex flex-col gap-8">

        {/* ── Section 1: Recent errors ───────────────────────────────────── */}
        <div>
          <p className="text-zinc-400 text-sm font-semibold mb-3 uppercase tracking-wide">
            {t('review.recentErrors')}
          </p>
          {recentErrors.length === 0 ? (
            <p className="text-zinc-500 text-sm">{t('review.noErrors')}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {recentErrors.map(ex => {
                const { border, bg } = urgencyBorder()
                const pct = Math.round((ex.precision ?? 0) * 100)
                const date = ex.created_at
                  ? new Date(ex.created_at).toLocaleDateString()
                  : '—'
                const intervals = (ex.sequence ?? []).filter(s => s.interval)

                return (
                  <button
                    key={ex.id}
                    onClick={() => openExercise(ex)}
                    className={`w-full text-left border border-l-4 ${border} border-zinc-800
                      rounded-xl hover:border-zinc-700 transition-colors`}
                    style={{ backgroundColor: bg, padding: '14px 14px 14px 16px' }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-zinc-500 text-xs">{date}</span>
                      <div className="flex items-center gap-2">
                        <span
                          className="text-sm font-bold font-mono"
                          style={{ color: precisionColor(ex.precision ?? 0) }}
                        >
                          {pct}%
                        </span>
                        {/* Completion checkbox */}
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                            completedIds.has(ex.id)
                              ? 'bg-emerald-500 border-emerald-400'
                              : 'border-zinc-600 bg-transparent'
                          }`}
                        >
                          {completedIds.has(ex.id) && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <span className="text-xs px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded font-mono">
                        {(ex.sequence?.[0]?.note ?? '?')}
                      </span>
                      {intervals.map((s, i) => (
                        <span key={i}
                          className="text-xs px-1.5 py-0.5 bg-zinc-800 text-zinc-300 rounded font-mono">
                          {s.interval}
                          <span className="text-zinc-500 ml-1">
                            {s.direction === 'ascending' ? '↑' : '↓'}
                          </span>
                        </span>
                      ))}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Section 2: Upcoming SRS reviews ───────────────────────────── */}
        {upcoming.length > 0 && (
          <div>
            <p className="text-zinc-400 text-sm font-semibold mb-3 uppercase tracking-wide">
              {t('review.upcomingReviews')}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {upcoming.map(item => {
                const pct = Math.round(item.recall * 100)
                const recallColor = pct >= 70 ? '#10b981' : pct >= 40 ? '#f97316' : '#ef4444'
                let reviewLabel = '—'
                if (item.nextRev) {
                  if (item.overdue)      reviewLabel = t('intervals_screen.overdue')
                  else if (item.dueToday) reviewLabel = t('intervals_screen.today')
                  else                   reviewLabel = item.nextRev.toLocaleDateString()
                }
                const reviewColor = item.overdue ? 'text-rose-500' : item.dueToday ? 'text-orange-400' : 'text-zinc-500'

                return (
                  <div
                    key={`${item.interval_type}-${item.direction}`}
                    className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex flex-col gap-2"
                    style={{ padding: '12px' }}
                  >
                    <div>
                      <p className="text-zinc-100 text-sm font-semibold leading-tight">
                        {t(`intervals.${item.interval_type}`)}
                      </p>
                      <p className="text-zinc-500 text-xs mt-0.5">{t(`intervals.${item.direction}`)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: recallColor }}
                        />
                      </div>
                      <span className="text-xs font-mono font-bold" style={{ color: recallColor }}>
                        {pct}%
                      </span>
                    </div>
                    <p className={`text-xs ${reviewColor}`}>{reviewLabel}</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
