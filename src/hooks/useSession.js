/**
 * useSession — exercise state machine and session lifecycle.
 *
 * Manages the flow:
 *   idle → exercise → result → (next exercise or summary)
 *
 * Tonal context is handled inside ExerciseScreen (no separate phase).
 * Writes to Supabase: sessions, exercises, srs_items tables.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'
import { storeIDM, getStoredIDM, getStoredExtraHearings, storeExtraHearings } from '../lib/utils.js'
import { evaluateDDA, updateConsecutiveErrors, getIDMTrend } from '../engines/dda.js'
import { computeIDM, computeWeightedPrecision } from '../engines/idm.js'
import { selectSessionIntervals, updateSRSItem, buildInitialSRSItem } from '../engines/srs.js'
import { generateSequence } from '../engines/sequenceGenerator.js'
import { DDA } from '../config/constants.js'

const INITIAL_IDM = 2.0

// Compute MIDI range from an array of active octave numbers.
// C(n) = (n+1)*12,  B(n) = (n+2)*12 - 1
function octavesToMidiRange(octaves) {
  const min = Math.min(...octaves)
  const max = Math.max(...octaves)
  return {
    lowMidi:  (min + 1) * 12,
    highMidi: (max + 2) * 12 - 1,
  }
}

export function useSession(userId) {
  // ── Session-level state ───────────────────────────────────────────────────
  const [phase, setPhase]             = useState('idle')
  const [isFirstExercise, setIsFirstExercise] = useState(true)
  const [exercisesTarget, setExercisesTarget] = useState(null)
  const [sessionId, setSessionId]     = useState(null)
  const [sessionStart, setSessionStart] = useState(null)
  const [idmCurrent, setIdmCurrent]   = useState(getStoredIDM() ?? INITIAL_IDM)
  const [idmAtStart, setIdmAtStart]   = useState(null)
  const [exerciseHistory, setExerciseHistory] = useState([])
  const [srsItems, setSrsItems]       = useState([])
  const [activeOctaves, setActiveOctaves] = useState([3, 4])
  const [hearingsOverride, setHearingsOverride] = useState(null)
  const [extraHearings, setExtraHearings] = useState(getStoredExtraHearings)

  // ── Exercise-level state ──────────────────────────────────────────────────
  const [currentExercise, setCurrentExercise] = useState(null)
  const [hearingsLeft, setHearingsLeft]       = useState(0)
  const [noteIndex, setNoteIndex]             = useState(0)
  const [userSequence, setUserSequence]       = useState([])
  const [consecutiveErrors, setConsecErrors]  = useState(0)
  const [lastNoteResult, setLastNoteResult]   = useState(null)
  const [exerciseResult, setExerciseResult]   = useState(null)
  const [recentPrecisions, setRecentPrecisions] = useState([])

  const startTimeRef = useRef(null)

  // ── Load SRS items ────────────────────────────────────────────────────────
  useEffect(() => {
    if (userId) fetchSRSItems()
  }, [userId])

  async function fetchSRSItems() {
    const { data } = await supabase
      .from('srs_items')
      .select('*')
      .eq('user_id', userId)
    if (data) setSrsItems(data)
  }

  // ── Start session ─────────────────────────────────────────────────────────
  // options: { hearingsOverride?: number|null, activeOctaves?: number[] }
  const startSession = useCallback(async (target = null, options = {}) => {
    const { hearingsOverride: ho = null, activeOctaves: ao = [3, 4] } = options
    setExercisesTarget(target)
    setHearingsOverride(ho)
    setActiveOctaves(ao)
    const now = new Date()
    setSessionStart(now)
    setIdmAtStart(idmCurrent)
    setExerciseHistory([])

    let sid = null
    if (userId) {
      const { data } = await supabase
        .from('sessions')
        .insert({
          user_id:    userId,
          started_at: now.toISOString(),
          idm_start:  idmCurrent,
        })
        .select('id')
        .single()
      sid = data?.id ?? null
    }
    setSessionId(sid)
    setIsFirstExercise(true)
    await prepareNextExercise(idmCurrent, srsItems, true, ao, ho)
  }, [userId, idmCurrent, srsItems])

  // ── Prepare next exercise ─────────────────────────────────────────────────
  async function prepareNextExercise(idm, items, firstExercise, octaves, ho) {
    const sessionCount = exerciseHistory.length

    const { due, newItems } = selectSessionIntervals(items, sessionCount, new Date(), idm)
    const available = [...due, ...newItems.map(ni => ({
      interval_type: ni.interval,
      direction:     ni.direction,
      exposures:     0,
    }))]

    if (!available.length) {
      available.push({ interval_type: 'P5', direction: 'ascending', exposures: 0 })
    }

    const { lowMidi, highMidi } = octavesToMidiRange(octaves ?? [3, 4])

    const { sequence, tonic, tempo, idmComponents } = generateSequence({
      targetIDM:      idm,
      availableItems: available,
      lowMidi,
      highMidi,
    })

    const hearings = 2
    const finalIdmComponents = { ...idmComponents, H: 2 }

    setCurrentExercise({ sequence, tonic, tempo, idmComponents: finalIdmComponents })
    setHearingsLeft(hearings)
    setNoteIndex(0)
    setUserSequence([])
    setConsecErrors(0)
    setLastNoteResult(null)
    setExerciseResult(null)
    startTimeRef.current = Date.now()
    setIsFirstExercise(firstExercise)
    setPhase('exercise')
  }

  // ── User presses a key on the piano ──────────────────────────────────────
  const submitNote = useCallback((note) => {
    if (!currentExercise || phase !== 'exercise') return
    const expected = currentExercise.sequence[noteIndex]?.note
    if (!expected) return

    const correct = note === expected
    const newConsec = updateConsecutiveErrors(correct, consecutiveErrors)
    setConsecErrors(newConsec)
    setLastNoteResult(correct ? 'correct' : 'wrong')

    const newUserSeq = [...userSequence, note]
    setUserSequence(newUserSeq)

    const nextIndex = noteIndex + 1
    setNoteIndex(nextIndex)

    if (nextIndex >= currentExercise.sequence.length) {
      finishExercise(newUserSeq, newConsec)
    }
  }, [currentExercise, phase, noteIndex, consecutiveErrors, userSequence])

  // ── Decrement hearing counter ─────────────────────────────────────────────
  const useHearing = useCallback(() => {
    setHearingsLeft(h => Math.max(0, h - 1))
  }, [])

  // ── Extra hearings (earned from review, spent in exercise) ────────────────
  const addExtraHearing = useCallback(() => {
    setExtraHearings(prev => {
      const next = prev + 1
      storeExtraHearings(next)
      return next
    })
  }, [])

  const useExtraHearing = useCallback(() => {
    if (hearingsLeft >= 2 || extraHearings <= 0) return false
    setExtraHearings(prev => { storeExtraHearings(prev - 1); return prev - 1 })
    setHearingsLeft(h => h + 1)
    return true
  }, [hearingsLeft, extraHearings])

  // ── Finish exercise ───────────────────────────────────────────────────────
  async function finishExercise(userSeq, consec) {
    const expected = currentExercise.sequence.map(s => s.note)
    const precision = computeWeightedPrecision(expected, userSeq)
    const correctArr = expected.map((note, i) => userSeq[i] === note)
    const responseTime = (Date.now() - startTimeRef.current) / 1000

    const { newIDM, trigger } = evaluateDDA({
      currentIDM:        idmCurrent,
      precision,
      consecutiveErrors: consec,
      recentPrecisions,
    })

    const newPrecisions = [...recentPrecisions, precision].slice(-DDA.MASTERY_CONSECUTIVE_WINS)
    setRecentPrecisions(newPrecisions)
    setIdmCurrent(newIDM)
    storeIDM(newIDM)

    const trend = getIDMTrend(idmCurrent, newIDM)

    const algaeEarned = Math.floor(idmCurrent * precision)

    const result = {
      precision,
      correct: correctArr,
      userSequence: userSeq,
      expectedSequence: expected,
      responseTime,
      trend,
      idmBefore: idmCurrent,
      idmAfter:  newIDM,
      algaeEarned,
    }
    setExerciseResult(result)

    const { idmComponents, tonic, tempo } = currentExercise
    if (userId && sessionId) {
      await supabase.from('exercises').insert({
        session_id:        sessionId,
        user_id:           userId,
        tonic,
        sequence:          currentExercise.sequence,
        tempo,
        idm:               idmComponents.idm,
        d_bar:             idmComponents.dBar,
        s:                 idmComponents.S,
        c:                 idmComponents.C,
        x:                 idmComponents.X,
        n_chunks:          idmComponents.nChunks,
        d_density:         idmComponents.dDensity,
        r:                 idmComponents.R,
        h:                 idmComponents.H,
        auditions_used:    idmComponents.H - hearingsLeft,
        user_sequence:     userSeq,
        correct:           correctArr,
        precision,
        response_time:     responseTime,
        consecutive_errors: consec,
      }).select('id').single()

      await updateSRSForExercise(correctArr)
    }

    const newHistory = [...exerciseHistory, { precision, idm: newIDM, algae: algaeEarned }]
    setExerciseHistory(newHistory)
    setPhase('result')
  }

  // ── Update SRS for each interval ──────────────────────────────────────────
  async function updateSRSForExercise(correctArr) {
    if (!userId) return
    const intervals = currentExercise.sequence.filter(s => s.interval)
    const now = new Date()

    for (let i = 0; i < intervals.length; i++) {
      const { interval, direction } = intervals[i]
      const correct = correctArr[i + 1] ?? false

      const existing = srsItems.find(
        item => item.interval_type === interval && item.direction === direction
      )

      if (existing) {
        const updates = updateSRSItem(existing, correct, now)
        await supabase.from('srs_items').update(updates).eq('id', existing.id)
        setSrsItems(prev => prev.map(item =>
          item.id === existing.id ? { ...item, ...updates } : item
        ))
      } else {
        const newItem = buildInitialSRSItem(userId, interval, direction)
        const updates = updateSRSItem(newItem, correct, now)
        const { data } = await supabase
          .from('srs_items')
          .insert({ ...newItem, ...updates })
          .select()
          .single()
        if (data) setSrsItems(prev => [...prev, data])
      }
    }
  }

  // ── Move to next exercise ─────────────────────────────────────────────────
  const nextExercise = useCallback(async () => {
    await prepareNextExercise(idmCurrent, srsItems, false, activeOctaves, hearingsOverride)
  }, [idmCurrent, srsItems, activeOctaves, hearingsOverride])

  // ── End session ───────────────────────────────────────────────────────────
  const endSession = useCallback(async () => {
    const now = new Date()
    if (userId && sessionId) {
      await supabase.from('sessions').update({
        ended_at:        now.toISOString(),
        idm_end:         idmCurrent,
        exercises_count: exerciseHistory.length,
      }).eq('id', sessionId)
    }
    setPhase('summary')
  }, [userId, sessionId, exerciseHistory, idmCurrent])

  // ── Session summary data ──────────────────────────────────────────────────
  const _meanPrec = exerciseHistory.length
    ? exerciseHistory.reduce((a, b) => a + b.precision, 0) / exerciseHistory.length
    : 0

  const summaryData = {
    duration: sessionStart ? Math.floor((Date.now() - sessionStart.getTime()) / 1000) : 0,
    exercises: exerciseHistory.length,
    meanPrecision: _meanPrec,
    idmStart:    idmAtStart,
    idmEnd:      idmCurrent,
    history:     exerciseHistory,
    algaeEarned: exerciseHistory.reduce((s, e) => s + (e.algae ?? 0), 0),
    algaeBonus:  exerciseHistory.length > 0 ? Math.floor(idmCurrent * _meanPrec) : 0,
  }

  const resetSession = useCallback(() => {
    setPhase('idle')
    setSessionId(null)
    setSessionStart(null)
    setExerciseHistory([])
    setCurrentExercise(null)
    setActiveOctaves([3, 4])
    setHearingsOverride(null)
  }, [])

  const isLastExercise = exercisesTarget != null &&
    exerciseHistory.length >= exercisesTarget - 1

  return {
    phase,
    isFirstExercise,
    isLastExercise,
    currentExercise,
    hearingsLeft,
    noteIndex,
    userSequence,
    lastNoteResult,
    exerciseResult,
    summaryData,
    idmCurrent,
    activeOctaves,
    startSession,
    submitNote,
    useHearing,
    extraHearings,
    addExtraHearing,
    useExtraHearing,
    nextExercise,
    endSession,
    resetSession,
  }
}
