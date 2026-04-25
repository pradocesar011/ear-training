/**
 * PracticeScreen — focused interval practice session.
 * 10 exercises, one selected interval, no rewards.
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAppContext } from '../context/AppContext.jsx'
import PianoKeyboard from '../components/PianoKeyboard.jsx'
import HearingsIndicator from '../components/HearingsIndicator.jsx'
import { computeWeightedPrecision } from '../engines/idm.js'

const PRACTICE_COUNT    = 10
const PRACTICE_HEARINGS = 2
const LOW_MIDI          = 48   // C3
const HIGH_MIDI         = 71   // B4

const SEMITONES = {
  m2: 1, M2: 2, m3: 3, M3: 4, P4: 5, TT: 6,
  P5: 7, m6: 8, M6: 9, m7: 10, M7: 11, P8: 12,
}
const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
function midiToNote(m) { return `${NOTE_NAMES[m % 12]}${Math.floor(m / 12) - 1}` }

function generateExercise(intervalType, direction) {
  const st = SEMITONES[intervalType] ?? 7
  const minT = direction === 'ascending' ? LOW_MIDI : LOW_MIDI + st
  const maxT = direction === 'ascending' ? HIGH_MIDI - st : HIGH_MIDI
  const tonicMidi    = minT + Math.floor(Math.random() * (maxT - minT + 1))
  const intervalMidi = direction === 'ascending' ? tonicMidi + st : tonicMidi - st
  return {
    sequence: [
      { note: midiToNote(tonicMidi) },
      { note: midiToNote(intervalMidi), interval: intervalType, direction },
    ],
    tonic: midiToNote(tonicMidi),
    tempo: 60,
    interval: intervalType,
    direction,
  }
}

function pickAndGenerate(pairs) {
  const pair = pairs[Math.floor(Math.random() * pairs.length)]
  return generateExercise(pair.interval, pair.direction)
}

function precisionColor(p) {
  return p >= 0.8 ? '#10b981' : p >= 0.5 ? '#f97316' : '#ef4444'
}

// ── Summary screen ────────────────────────────────────────────────────────────

function PracticeSummary({ pairs, history, onBack, onRestart, t }) {
  const meanPrec     = history.reduce((a, r) => a + r.precision, 0) / history.length
  const perfectCount = history.filter(r => r.precision >= 1).length
  const col          = precisionColor(meanPrec)
  const isMixed      = pairs.length > 1

  return (
    <div className="screen-enter flex flex-col items-center min-h-screen px-4 pt-8 pb-8 gap-6">
      {/* Header */}
      <div className="text-center" style={{ paddingTop: '20px' }}>
        <p className="text-zinc-400 text-sm uppercase tracking-widest mb-1">Practice Complete</p>
        <h2 className="text-white text-xl font-bold">
          {isMixed ? 'Mixed Practice' : (
            <>
              {t(`intervals.${pairs[0].interval}`)}
              <span className="text-zinc-400 font-normal ml-2 text-base">
                {pairs[0].direction === 'ascending' ? '↑' : '↓'} {t(`intervals.${pairs[0].direction}`)}
              </span>
            </>
          )}
        </h2>
      </div>

      {/* Big precision */}
      <div className="text-center">
        <div className="text-6xl font-bold font-mono" style={{ color: col }}>
          {Math.round(meanPrec * 100)}%
        </div>
        <div className="text-zinc-400 text-sm mt-1">avg precision</div>
      </div>

      {/* Perfect count */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-8 py-4 text-center">
        <div className="text-3xl font-bold text-white font-mono">{perfectCount} / {PRACTICE_COUNT}</div>
        <div className="text-zinc-400 text-sm mt-1">perfect exercises</div>
      </div>

      {/* Per-exercise result dots */}
      <div className="flex gap-2 flex-wrap justify-center max-w-xs">
        {history.map((r, i) => {
          const c = precisionColor(r.precision)
          return (
            <div
              key={i}
              className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ backgroundColor: c + '22', border: `2px solid ${c}`, color: c }}
            >
              {Math.round(r.precision * 100)}
            </div>
          )
        })}
      </div>

      {/* Actions */}
      <div className="flex gap-3 w-full max-w-sm">
        <button
          onClick={onBack}
          className="flex-1 py-4 bg-zinc-800 text-zinc-300 rounded-xl font-semibold
            hover:bg-zinc-700 active:scale-95 transition-all"
        >
          Done
        </button>
        <button
          onClick={onRestart}
          className="flex-1 py-4 bg-cyan-600 text-white rounded-xl font-semibold
            hover:bg-cyan-500 active:scale-95 transition-all"
        >
          Practice Again
        </button>
      </div>

      <div style={{ height: 100 }} />
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PracticeScreen() {
  const { t, i18n }  = useTranslation()
  const lang          = i18n.language?.slice(0, 2) ?? 'es'
  const navigate      = useNavigate()
  const { state }     = useLocation()
  const { audio, setReviewInExercise } = useAppContext()

  const pairs = state?.pairs ?? [{ interval: state?.interval ?? 'P5', direction: state?.direction ?? 'ascending' }]

  // Hide bottom nav for the duration of the practice session
  useEffect(() => {
    setReviewInExercise(true)
    return () => setReviewInExercise(false)
  }, [])

  // ── Session state ──────────────────────────────────────────────────────────
  const [phase,          setPhase]          = useState('exercise')
  const [exerciseNum,    setExerciseNum]    = useState(1)
  const [currentEx,      setCurrentEx]      = useState(() => pickAndGenerate(pairs))
  const [hearingsLeft,   setHearingsLeft]   = useState(PRACTICE_HEARINGS)
  const [noteIndex,      setNoteIndex]      = useState(0)
  const [userSequence,   setUserSequence]   = useState([])
  const [exerciseResult, setExerciseResult] = useState(null)
  const [history,        setHistory]        = useState([])
  const [isPlaying,      setIsPlaying]      = useState(false)
  const [wrongNote,      setWrongNote]      = useState([])
  const [wrongFadeNote,  setWrongFadeNote]  = useState([])

  const wrongTimerRef = useRef(null)

  // ── Play sequence ──────────────────────────────────────────────────────────
  async function handlePlay() {
    if (hearingsLeft <= 0 || !audio.ready || isPlaying || exerciseResult) return
    setHearingsLeft(h => h - 1)
    setIsPlaying(true)
    const notes = currentEx.sequence.map(s => s.note)
    const dur   = await audio.playSequence(notes, currentEx.tempo)
    setTimeout(() => setIsPlaying(false), (dur ?? 2) * 1000 + 200)
  }

  // ── Note press ─────────────────────────────────────────────────────────────
  const handleNote = useCallback(async (note) => {
    if (exerciseResult || noteIndex >= currentEx.sequence.length) return
    await audio.playNote(note)

    const expected = currentEx.sequence[noteIndex]?.note
    const correct  = note === expected

    clearTimeout(wrongTimerRef.current)
    if (!correct) {
      setWrongNote([note])
      setWrongFadeNote([])
      wrongTimerRef.current = setTimeout(() => {
        setWrongNote([])
        setWrongFadeNote([note])
        wrongTimerRef.current = setTimeout(() => setWrongFadeNote([]), 1800)
      }, 200)
    } else {
      setWrongNote([])
      setWrongFadeNote([])
    }

    const newSeq  = [...userSequence, note]
    const nextIdx = noteIndex + 1
    setUserSequence(newSeq)
    setNoteIndex(nextIdx)

    if (nextIdx >= currentEx.sequence.length) {
      const exp       = currentEx.sequence.map(s => s.note)
      const precision = computeWeightedPrecision(exp, newSeq)
      const correctArr = exp.map((n, i) => newSeq[i] === n)
      setExerciseResult({ precision, correct: correctArr })
    }
  }, [exerciseResult, noteIndex, currentEx, userSequence, audio])

  // ── Advance to next exercise or summary ────────────────────────────────────
  function handleNext() {
    const newHistory = [...history, exerciseResult]
    if (exerciseNum >= PRACTICE_COUNT) {
      setHistory(newHistory)
      setPhase('summary')
    } else {
      setHistory(newHistory)
      setExerciseNum(n => n + 1)
      setCurrentEx(pickAndGenerate(pairs))
      setHearingsLeft(PRACTICE_HEARINGS)
      setNoteIndex(0)
      setUserSequence([])
      setExerciseResult(null)
      setWrongNote([])
      setWrongFadeNote([])
    }
  }

  function handleBack() {
    audio.stopAll()
    navigate(-1)
  }

  function handleRestart() {
    setPhase('exercise')
    setExerciseNum(1)
    setCurrentEx(pickAndGenerate(pairs))
    setHearingsLeft(PRACTICE_HEARINGS)
    setNoteIndex(0)
    setUserSequence([])
    setExerciseResult(null)
    setHistory([])
    setWrongNote([])
    setWrongFadeNote([])
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  if (phase === 'summary') {
    return (
      <PracticeSummary
        pairs={pairs}
        history={history}
        onBack={handleBack}
        onRestart={handleRestart}
        t={t}
      />
    )
  }

  // ── Exercise view ──────────────────────────────────────────────────────────
  const hearingsUsed = PRACTICE_HEARINGS - hearingsLeft
  const filled       = userSequence.length
  const tonicHighlight = exerciseResult ? [] : [currentEx.tonic]

  let correctHighlight = []
  let wrongHighlight   = []
  if (exerciseResult) {
    currentEx.sequence.forEach((slot, i) => {
      if (exerciseResult.correct[i]) {
        correctHighlight.push(slot.note)
      } else {
        wrongHighlight.push(slot.note)
        if (userSequence[i] && userSequence[i] !== slot.note) {
          wrongHighlight.push(userSequence[i])
        }
      }
    })
  }

  return (
    <div className="screen-enter flex flex-col items-center min-h-screen px-4 pt-5 gap-4">

      {/* Top bar */}
      <div
        className="w-full max-w-2xl mx-auto flex items-center justify-between gap-3
                   bg-zinc-900/60 border border-zinc-800 rounded-2xl"
        style={{ padding: '10px' }}
      >
        <button
          onClick={handleBack}
          className="flex items-center gap-1.5 text-zinc-400 hover:text-white text-sm transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <div className="text-center">
          <span className="text-white text-sm font-semibold">
            {t(`intervals.${currentEx.interval}`)}
          </span>
          <span className="text-zinc-400 text-xs ml-2">
            {currentEx.direction === 'ascending' ? '↑' : '↓'} {t(`intervals.${currentEx.direction}`)}
          </span>
        </div>

        <span className="text-zinc-500 text-xs font-mono">
          {exerciseNum} / {PRACTICE_COUNT}
        </span>
      </div>

      {/* Hearings indicator */}
      <div className="w-full max-w-2xl mx-auto">
        <HearingsIndicator used={hearingsUsed} total={PRACTICE_HEARINGS} />
      </div>

      {/* Note slots + result — vertically centered */}
      <div className="flex-1 w-full flex flex-col items-center justify-center gap-8">

        {/* Note slots */}
        <div className="w-full max-w-2xl mx-auto">
          <div className="flex gap-1.5 justify-center">
            {currentEx.sequence.map((slot, i) => {
              const answered = i < filled
              const userNote = userSequence[i]
              const correct  = exerciseResult ? exerciseResult.correct[i] : null

              let bg    = 'bg-zinc-800'
              let text  = 'text-zinc-500'
              let label = '—'

              if (answered && !exerciseResult) {
                bg = 'bg-zinc-700'; text = 'text-zinc-100'; label = userNote
              } else if (exerciseResult && correct === true) {
                bg = 'bg-emerald-900/50'; text = 'text-emerald-300'; label = userNote ?? '—'
              } else if (exerciseResult && correct === false) {
                bg = 'bg-rose-900/50'; text = 'text-rose-300'; label = userNote ?? '—'
              } else if (!answered && i === filled && !exerciseResult) {
                bg = 'bg-zinc-800 ring-1 ring-cyan-500/50'; text = 'text-zinc-600'
              }

              return (
                <div
                  key={i}
                  className={`${bg} rounded-lg text-center font-mono text-xs font-medium
                    min-w-[56px] px-3 py-3 ${text}`}
                >
                  {label}
                  {exerciseResult && !exerciseResult.correct[i] && (
                    <div className="text-emerald-500 text-[10px] mt-0.5">→{slot.note}</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Result: precision + next button */}
        {exerciseResult && (
          <div className="flex flex-col items-center gap-4">
            <div
              className="text-3xl font-bold font-mono"
              style={{ color: precisionColor(exerciseResult.precision) }}
            >
              {Math.round(exerciseResult.precision * 100)}%
            </div>
            <button
              onClick={handleNext}
              className="px-10 py-3 bg-cyan-600 text-white rounded-xl font-semibold
                hover:bg-cyan-500 active:scale-95 transition-all shadow-lg shadow-cyan-900/30"
            >
              {exerciseNum >= PRACTICE_COUNT ? 'See Results' : 'Next →'}
            </button>
          </div>
        )}
      </div>

      {/* Play button + piano pinned to bottom */}
      <div className="w-full flex flex-col items-center gap-3">

        <div className="w-full max-w-2xl px-4">
          <button
            onClick={handlePlay}
            disabled={hearingsLeft <= 0 || !audio.ready || isPlaying || !!exerciseResult}
            className={`w-full flex items-center justify-center gap-3 text-white rounded-2xl
              text-base font-bold active:scale-[0.98]
              disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 shadow-lg
              ${isPlaying
                ? 'bg-amber-600 shadow-amber-900/30'
                : 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-900/30'
              }`}
            style={{ padding: '16px' }}
          >
            {isPlaying ? (
              <>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                Playing…
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                </svg>
                {t('common.play')} ({hearingsLeft})
              </>
            )}
          </button>
        </div>

        <div className="w-full">
          <PianoKeyboard
            onNote={handleNote}
            highlightCorrect={exerciseResult ? correctHighlight : []}
            highlightWrong={exerciseResult ? wrongHighlight : wrongNote}
            highlightWrongFade={exerciseResult ? [] : wrongFadeNote}
            highlightTonic={tonicHighlight}
            activeOctaves={[3, 4]}
            disabled={!!exerciseResult || filled >= currentEx.sequence.length}
            language={lang}
          />
        </div>
      </div>
    </div>
  )
}
