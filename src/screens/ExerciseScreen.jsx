import { useEffect, useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import PianoKeyboard from '../components/PianoKeyboard.jsx'
import HearingsIndicator from '../components/HearingsIndicator.jsx'
import ProgressIndicator from '../components/ProgressIndicator.jsx'
import { getMajorScaleNotes, getTonicTriad } from '../engines/sequenceGenerator.js'
import { TONAL_CONTEXT_TEMPO, COLORS, CHUNK_RULES, WORKING_MEMORY_CHUNK_LIMIT } from '../config/constants.js'
import { TONAL_MODES, getStoredTonalMode, storeTonalMode, getStoredCheatMode } from '../lib/utils.js'

function delay(ms) { return new Promise(r => setTimeout(r, ms)) }

export default function ExerciseScreen({
  exercise,
  hearingsLeft,
  noteIndex,
  lastNoteResult,
  isFirstExercise,
  activeOctaves,
  onNote,
  onPlay,
  onEnd,
  audio,
}) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language?.slice(0, 2) ?? 'es'

  const [keyboardLocked,   setKeyboardLocked]   = useState(false)
  const [contextPlaying,   setContextPlaying]   = useState(false)
  const [seqPlaying,       setSeqPlaying]       = useState(false)
  const [tonalMode,        setTonalMode]        = useState(getStoredTonalMode)
  const [showModeMenu,     setShowModeMenu]     = useState(false)
  const [endConfirm,       setEndConfirm]       = useState(false)
  const [wrongNote,        setWrongNote]        = useState([])
  const [wrongFadeNote,    setWrongFadeNote]    = useState([])
  const cheatMode = getStoredCheatMode()

  // Ref used to interrupt the async playTonalContext loop on stop
  const contextActiveRef  = useRef(false)
  const endConfirmTimerRef = useRef(null)
  const wrongTimerRef     = useRef(null)
  const pressedNoteRef    = useRef(null)

  const totalNotes    = exercise?.sequence?.length ?? 0
  const hearingsTotal = exercise?.idmComponents?.H ?? 3
  const hearingsUsed  = hearingsTotal - hearingsLeft
  const canPlay       = hearingsLeft > 0 && audio.ready && !keyboardLocked
  const tonic         = exercise?.tonic ?? 'C'

  const chunkRule     = exercise?.sequence
    ? CHUNK_RULES.find(r => exercise.sequence.length <= r.maxNotes) ?? CHUNK_RULES[CHUNK_RULES.length - 1]
    : null
  const chunkSize     = chunkRule?.silenceEnabled ? chunkRule.notesPerChunk : 0

  const tonicHighlight = exercise?.sequence?.[0]?.note ? [exercise.sequence[0].note] : []

  // ── Wrong note 2-second fade ─────────────────────────────────────────────
  useEffect(() => {
    clearTimeout(wrongTimerRef.current)
    if (lastNoteResult === 'wrong' && pressedNoteRef.current) {
      const note = pressedNoteRef.current
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
  }, [lastNoteResult])

  // ── Mode helpers ──────────────────────────────────────────────────────────
  function handleModeChange(mode) {
    setTonalMode(mode)
    storeTonalMode(mode)
    setShowModeMenu(false)
  }

  const MODE_LABELS = {
    [TONAL_MODES.SCALE_AND_CHORDS]: t('tonal_context.mode_scale_and_chords'),
    [TONAL_MODES.SCALE_ONLY]:       t('tonal_context.mode_scale_only'),
    [TONAL_MODES.CHORDS_ONLY]:      t('tonal_context.mode_chords_only'),
  }

  // ── Auto-play tonal context on first exercise ─────────────────────────────
  useEffect(() => {
    if (audio.ready && exercise && isFirstExercise) {
      playTonalContext(false)
    }
  }, [audio.ready, exercise?.tonic])

  // ── Tonal context playback ────────────────────────────────────────────────
  async function playTonalContext(costsHearing = true) {
    if (!audio.ready || contextActiveRef.current) return
    if (costsHearing) {
      if (hearingsLeft <= 0) return
      onPlay()
    }

    audio.stopAll()
    contextActiveRef.current = true
    setContextPlaying(true)
    setKeyboardLocked(true)

    if (tonalMode === TONAL_MODES.SCALE_AND_CHORDS || tonalMode === TONAL_MODES.SCALE_ONLY) {
      const { all: scaleNotes } = getMajorScaleNotes(tonic)
      const dur = await audio.playSequence(scaleNotes, TONAL_CONTEXT_TEMPO)
      if (!contextActiveRef.current) return
      await delay((dur ?? scaleNotes.length * (60 / TONAL_CONTEXT_TEMPO)) * 1000 + 300)
      if (!contextActiveRef.current) return
    }

    if (tonalMode === TONAL_MODES.SCALE_AND_CHORDS || tonalMode === TONAL_MODES.CHORDS_ONLY) {
      const triad = getTonicTriad(tonic)
      const dur = await audio.playTriad(triad)
      if (!contextActiveRef.current) return
      await delay((dur ?? 1) * 1000 + 300)
    }

    contextActiveRef.current = false
    setContextPlaying(false)
    setKeyboardLocked(false)
  }

  function stopTonalContext() {
    contextActiveRef.current = false
    audio.stopAll()
    setContextPlaying(false)
    setKeyboardLocked(false)
  }

  // ── Play exercise sequence ────────────────────────────────────────────────
  async function handlePlaySequence() {
    if (seqPlaying) {
      audio.stopAll()
      setSeqPlaying(false)
      return
    }
    if (!canPlay) return
    onPlay()
    audio.stopAll()
    setSeqPlaying(true)
    const notes = exercise.sequence.map(s => s.note)
    const rule = CHUNK_RULES.find(r => notes.length <= r.maxNotes) ?? CHUNK_RULES[CHUNK_RULES.length - 1]
    const dur = await audio.playSequence(
      notes,
      exercise.tempo,
      rule.silenceEnabled ? rule.notesPerChunk : 0,
      rule.silenceEnabled ? rule.silenceBeats  : 0,
    )
    setTimeout(() => setSeqPlaying(false), (dur ?? 3) * 1000 + 200)
  }

  // ── End session (with confirm) ────────────────────────────────────────────
  function handleEndClick() {
    if (endConfirm) {
      clearTimeout(endConfirmTimerRef.current)
      stopTonalContext()
      onEnd()
    } else {
      setEndConfirm(true)
      endConfirmTimerRef.current = setTimeout(() => setEndConfirm(false), 2500)
    }
  }

  // ── Note feedback ─────────────────────────────────────────────────────────
  const feedbackColor = lastNoteResult === 'correct' ? COLORS.CORRECT
    : lastNoteResult === 'wrong' ? COLORS.WRONG : null
  const feedbackLabel = lastNoteResult === 'correct' ? t('exercise.correct_note')
    : lastNoteResult === 'wrong' ? t('exercise.wrong_note') : null

  return (
    <div className="screen-enter flex flex-col items-center min-h-screen px-4 pt-5 gap-5">

      {/* ── Top control bar ─────────────────────────────────────────────── */}
      <div className="w-full max-w-2xl mx-auto flex items-center justify-between gap-3
                      bg-zinc-900/60 border border-zinc-800 rounded-2xl px-4 py-3" style={{ padding: '10px' }}>

        {/* Exit button */}
        <button
          onClick={handleEndClick}
          title={t('exercise.end_session_title')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium
            border transition-all duration-150 flex-shrink-0
            ${endConfirm
              ? 'bg-rose-950/60 border-rose-700 text-rose-400'
              : 'bg-zinc-800/60 border-zinc-700 text-zinc-400 hover:text-zinc-100 hover:border-zinc-700'
            }`} style={{ padding: '10px' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M6 18L18 6M6 6l12 12" />
          </svg>
          {endConfirm ? t('exercise.end_confirm') : t('exercise.end_session_title')}
        </button>

        <span className="text-zinc-400 text-sm font-medium truncate">
          {t('tonal_context.tonality', { tonic })}
        </span>

        {/* Mode selector */}
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setShowModeMenu(v => !v)}
            className="flex items-center gap-1.5 px-3 py-2.5 text-sm text-zinc-400
              hover:text-zinc-100 border border-zinc-800 hover:border-zinc-700
              rounded-xl transition-colors bg-zinc-800/40" style={{ padding: '10px' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
            <span className="hidden sm:inline">{MODE_LABELS[tonalMode]}</span>
            <svg className="w-3 h-3 opacity-50" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
          {showModeMenu && (
            <div className="absolute right-0 top-full mt-2 bg-zinc-900 border border-zinc-800
                            rounded-xl shadow-xl z-20 min-w-max overflow-hidden">
              {Object.entries(MODE_LABELS).map(([mode, label]) => (
                <button
                  key={mode}
                  onClick={() => handleModeChange(mode)}
                  className={`block w-full text-left px-4 py-3 text-sm transition-colors
                    ${tonalMode === mode
                      ? 'text-cyan-400 bg-cyan-950/30'
                      : 'text-zinc-300 hover:bg-zinc-800'}`} style={{ padding: '10px' }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Tonal context + hearings row ─────────────────────────────────── */}
      <div className="w-full max-w-2xl mx-auto flex items-center justify-between gap-3">
        <HearingsIndicator used={hearingsUsed} total={hearingsTotal} />

        {/* Play tonal context / Stop */}
        {contextPlaying ? (
          <button
            onClick={stopTonalContext}
            className="flex items-center gap-2 px-5 py-3 bg-rose-950/40 border border-rose-800/60
              text-rose-400 rounded-xl text-sm font-medium hover:bg-rose-950/60 transition-colors" style={{ padding: '10px' }}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <rect x="4" y="4" width="12" height="12" rx="1" />
            </svg>
            {t('tonal_context.stop')}
          </button>
        ) : (
          <button
            onClick={() => playTonalContext(true)}
            disabled={hearingsLeft <= 0 || keyboardLocked}
            title={`${t('tonal_context.heading')} (−1 ${t('exercise.hearings_label')})`}
            className="flex items-center gap-2 px-5 py-3 bg-zinc-800 border border-zinc-700
              text-zinc-100 rounded-xl text-sm font-medium
              hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors" style={{ padding: '10px' }}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" />
            </svg>
            {t('tonal_context.heading')}
          </button>
        )}
      </div>

      {/* ── Cheat Mode Panel ────────────────────────────────────────────── */}
      {cheatMode && exercise && (() => {
        const { idm, dBar, S, C, X, nChunks } = exercise.idmComponents
        const nOver5 = nChunks / WORKING_MEMORY_CHUNK_LIMIT
        const intervals = exercise.sequence.filter(s => s.interval)
        return (
          <div className="w-full max-w-2xl mx-auto bg-zinc-900/80 border border-orange-800/50
                          rounded-2xl px-4 py-3 font-mono text-xs flex flex-col gap-2" style={{ padding: '12px' }}>
            <p className="text-orange-400 font-semibold text-xs uppercase tracking-widest">Cheat Mode</p>

            {/* Formula symbolic */}
            <p className="text-zinc-400">
              IDM = <span className="text-zinc-200">d̄</span> + <span className="text-zinc-200">S</span> + <span className="text-zinc-200">C</span> + <span className="text-zinc-200">X</span> + <span className="text-zinc-200">N/5</span> + <span className="text-zinc-200">K</span>
            </p>

            {/* Formula with numbers */}
            <p className="text-zinc-300">
              IDM = <span className="text-cyan-300">{dBar.toFixed(2)}</span>
              {' + '}<span className="text-cyan-300">{S}</span>
              {' + '}<span className="text-cyan-300">{C.toFixed(2)}</span>
              {' + '}<span className="text-cyan-300">{X.toFixed(2)}</span>
              {' + '}<span className="text-cyan-300">{nOver5.toFixed(2)}</span>
              {' + '}<span className="text-cyan-300">1.00</span>
              {' = '}<span className="text-orange-300 font-bold">{idm.toFixed(2)}</span>
            </p>

            {/* Pattern answer */}
            <div className="border-t border-zinc-800 pt-2 flex flex-wrap gap-1" style={{ paddingTop: '8px' }}>
              <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                {exercise.sequence[0]?.note} <span className="text-zinc-500">(tonic)</span>
              </span>
              {intervals.map((s, i) => (
                <span key={i} className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-200">
                  {s.note}
                  <span className="text-cyan-400"> {s.interval}</span>
                  <span className="text-zinc-500"> {s.direction === 'ascending' ? '↑' : '↓'}</span>
                </span>
              ))}
            </div>
          </div>
        )
      })()}

      {/* ── Progress + feedback — vertically centered in remaining space ─── */}
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <ProgressIndicator current={noteIndex} total={totalNotes} chunkSize={chunkSize} />
        <div className="h-7 flex items-center">
          {keyboardLocked && !feedbackLabel ? (
            <span className="text-cyan-300 text-sm animate-pulse">
              {t('tonal_context.playing_scale')}
            </span>
          ) : feedbackLabel ? (
            <span
              className="text-sm font-medium px-3 py-1 rounded-full transition-all duration-150"
              style={{ padding: '5px', color: feedbackColor, backgroundColor: `${feedbackColor}22` }}
            >
              {feedbackLabel}
            </span>
          ) : null}
        </div>
      </div>

      {/* ── Play button + keyboard pinned to bottom ──────────────────────── */}
      <div className="w-full flex flex-col items-center gap-4 pb-0">
        <div className="w-full max-w-2xl px-4">
          <button
            onClick={handlePlaySequence}
            disabled={!seqPlaying && !canPlay}
            className={`w-full flex items-center justify-center gap-3 py-5 text-white
              rounded-2xl text-lg font-bold active:scale-[0.98]
              disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150
              shadow-lg ${seqPlaying
                ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-900/40'
                : 'bg-cyan-600 hover:bg-cyan-500 shadow-indigo-900/40'
              }`} style={{ padding: '20px' }}
          >
            {seqPlaying ? (
              <>
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {t('tonal_context.stop')}
              </>
            ) : (
              <>
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                </svg>
                {t('common.play')}
              </>
            )}
          </button>
        </div>
        <div className="w-full">
          <PianoKeyboard
            onNote={(note) => { pressedNoteRef.current = note; onNote(note) }}
            highlightTonic={tonicHighlight}
            highlightWrong={wrongNote}
            highlightWrongFade={wrongFadeNote}
            activeOctaves={activeOctaves ?? [3, 4]}
            disabled={keyboardLocked || noteIndex >= totalNotes}
            language={lang}
          />
        </div>
      </div>
    </div>
  )
}
