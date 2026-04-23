/**
 * Sequence Generator — builds note sequences for exercises.
 *
 * Given a target IDM and a set of intervals selected by the SRS engine,
 * generates a melodic sequence that satisfies the IDM_PROGRESSION constraints
 * for that IDM level. Retries up to MAX_ATTEMPTS times to land within ±0.5
 * of the target IDM before falling back to the best result found.
 */

import {
  KEYBOARD,
  IDM_PROGRESSION,
  EXERCISE_TEMPO_BPM,
} from '../config/constants.js'
import { computeIDM } from './idm.js'

const MAX_ATTEMPTS = 20
const IDM_TOLERANCE = 0.5

// ── Note arithmetic ───────────────────────────────────────────────────────────

const SEMITONE_MAP = {
  m2: 1, M2: 2, m3: 3, M3: 4, P4: 5, TT: 6,
  P5: 7, m6: 8, M6: 9, m7: 10, M7: 11, P8: 12,
}

const MIDI_TO_NOTE = (() => {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  return (midi) => {
    const semitone = midi % 12
    const octave   = Math.floor(midi / 12) - 1
    return `${names[semitone]}${octave}`
  }
})()

function midiToNote(midi) { return MIDI_TO_NOTE(midi) }

function noteNameToMidi(noteName) {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const name   = noteName.slice(0, -1)
  const octave = parseInt(noteName.slice(-1))
  return names.indexOf(name) + (octave + 1) * 12
}

// Default active range from constants
const DEFAULT_LOW_MIDI  = noteNameToMidi(KEYBOARD.LOW)   // C3 = 48
const DEFAULT_HIGH_MIDI = noteNameToMidi(KEYBOARD.HIGH)  // B4 = 71

/**
 * Apply one interval from a MIDI note, respecting bounds.
 * Returns the new MIDI note or null if out of range.
 */
function applyInterval(midi, intervalType, direction, low, high) {
  const semitones = SEMITONE_MAP[intervalType] ?? 0
  const delta = direction === 'descending' ? -semitones : semitones
  const next  = midi + delta
  if (next < low || next > high) return null
  return next
}

/**
 * Choose a random tonic within the range that allows at least a P5 from each edge.
 */
function pickTonic(low, high) {
  const margin = 7
  const min = low + margin
  const max = high - margin
  if (min > max) return Math.floor((low + high) / 2)
  return min + Math.floor(Math.random() * (max - min + 1))
}

/**
 * Find the IDM_PROGRESSION entry for a given target IDM.
 * Falls back to the last entry if targetIDM >= all range upper bounds.
 */
function findProgression(targetIDM) {
  return IDM_PROGRESSION.find(
    p => targetIDM >= p.range[0] && targetIDM < p.range[1]
  ) ?? IDM_PROGRESSION[IDM_PROGRESSION.length - 1]
}

// ── Weighted interval selection ───────────────────────────────────────────────

const STEP_INTERVALS = new Set(['m2', 'M2'])
const PERFECT_LEAPS  = new Set(['P4', 'P5'])

/**
 * Weight for a given pool item based on IDM and recent history.
 *
 * At low IDM (≤ 2.5):  steps are heavily favored, perfect leaps are rare.
 * By IDM 5+:           all intervals are equally weighted.
 * Consecutive P4/P5:   strongly penalized at any IDM.
 * Same item repeat:    penalized to force variety (interval + direction pair).
 * Same direction:      lightly penalized to encourage alternation.
 */
function intervalWeight(intervalType, direction, prevIntervalType, prevDirection, targetIDM) {
  // biasFactor: 1 at IDM=1, 0 at IDM=5
  const biasFactor = Math.max(0, (5 - targetIDM) / 4)

  let weight = 1.0
  if (STEP_INTERVALS.has(intervalType)) {
    weight *= 1 + 2 * biasFactor            // up to 3× for steps at low IDM
  } else if (PERFECT_LEAPS.has(intervalType)) {
    weight *= Math.max(0.15, 1 - biasFactor) // down to 0.15× for P4/P5 at low IDM
  }

  // Penalize consecutive perfect leaps regardless of IDM
  if (PERFECT_LEAPS.has(intervalType) && PERFECT_LEAPS.has(prevIntervalType)) {
    weight *= 0.1
  }

  // Penalize repeating the exact same interval+direction pair — forces variety
  if (intervalType === prevIntervalType && direction === prevDirection) {
    weight *= 0.1
  }

  // Light penalty for repeating the same direction — encourages alternation
  if (direction === prevDirection && prevDirection !== null) {
    weight *= 0.5
  }

  return Math.max(weight, 0.01) // never zero
}

/**
 * Return pool items sorted by weighted-random priority (Gumbel-max trick).
 * Higher weight → more likely to appear first.
 */
function weightedPickOrder(pool, prevIntervalType, prevDirection, targetIDM) {
  return [...pool]
    .map(item => ({
      item,
      key: -Math.log(Math.random()) / intervalWeight(item.interval_type, item.direction, prevIntervalType, prevDirection, targetIDM),
    }))
    .sort((a, b) => a.key - b.key)
    .map(x => x.item)
}

/**
 * Build one candidate sequence of `totalNotes` notes from `pool`.
 * Enforces maxS (max leap count) during construction — once maxS leaps are
 * placed, only step intervals are eligible for remaining notes.
 * Returns null if fewer than 3 notes could be placed.
 */
function buildSequence(totalNotes, pool, effectiveLow, effectiveHigh, targetIDM = 5, maxS = Infinity) {
  const tonicMidi = pickTonic(effectiveLow, effectiveHigh)
  const tonicNote = midiToNote(tonicMidi)
  const sequence  = [{ note: tonicNote }]
  let currentMidi      = tonicMidi
  let prevIntervalType = null
  let prevDirection    = null
  let leapCount        = 0

  for (let i = 1; i < totalNotes; i++) {
    // Once maxS leaps are used, restrict to steps only
    const stepOnly = leapCount >= maxS
    const eligible = stepOnly
      ? pool.filter(item => STEP_INTERVALS.has(item.interval_type))
      : pool
    const activePool = eligible.length > 0 ? eligible : pool

    const ordered = weightedPickOrder(activePool, prevIntervalType, prevDirection, targetIDM)
    let placed = false
    for (const item of ordered) {
      const nextMidi = applyInterval(
        currentMidi, item.interval_type, item.direction,
        effectiveLow, effectiveHigh
      )
      if (nextMidi !== null) {
        sequence.push({
          note:      midiToNote(nextMidi),
          interval:  item.interval_type,
          direction: item.direction,
        })
        currentMidi      = nextMidi
        prevIntervalType = item.interval_type
        prevDirection    = item.direction
        if (!STEP_INTERVALS.has(item.interval_type)) leapCount++
        placed = true
        break
      }
    }
    if (!placed) break
  }

  return sequence.length >= 3 ? sequence : null
}

/**
 * Generate a melodic sequence suitable for the given target IDM.
 *
 * The function:
 *   1. Finds the IDM_PROGRESSION entry for targetIDM.
 *   2. Filters availableItems to allowed intervals + directions.
 *   3. Generates up to MAX_ATTEMPTS sequences, checking S_norm / C / X
 *      constraints and IDM ± tolerance.
 *   4. Returns the attempt whose IDM is closest to targetIDM, or the
 *      last valid attempt if none fell within tolerance.
 *
 * @param {object} options
 * @param {number}   options.targetIDM       - desired difficulty
 * @param {object[]} options.availableItems  - items with interval_type + direction
 * @param {number}   [options.lowMidi]       - override low MIDI bound
 * @param {number}   [options.highMidi]      - override high MIDI bound
 * @returns {{ sequence, tonic, tempo, idmComponents }}
 */
export function generateSequence({ targetIDM, availableItems, lowMidi, highMidi }) {
  const effectiveLow  = lowMidi  ?? DEFAULT_LOW_MIDI
  const effectiveHigh = highMidi ?? DEFAULT_HIGH_MIDI

  const progression = findProgression(targetIDM)
  const { allowedIntervals, allowedDirections, minNotes, maxNotes, maxS, maxC, maxX } = progression

  // Filter pool to only progression-allowed intervals and directions
  let pool = availableItems.filter(item =>
    allowedIntervals.includes(item.interval_type) &&
    allowedDirections.includes(item.direction)
  )

  // Fallback: use the simplest allowed interval if nothing in the pool qualifies
  if (pool.length === 0) {
    pool = [{ interval_type: allowedIntervals[0], direction: allowedDirections[0] }]
  }

  // Variety fix: if pool only has ascending items but the tier allows descending,
  // add descending mirrors so the generator can produce descending exercises from
  // session 1, without waiting for SRS to unlock descending intervals.
  const poolHasDescending = pool.some(item => item.direction === 'descending')
  if (!poolHasDescending && allowedDirections.includes('descending')) {
    pool = [
      ...pool,
      ...pool
        .filter(item => item.direction === 'ascending')
        .map(item => ({ ...item, direction: 'descending' })),
    ]
  }

  // P4/P5 company fix: if SRS only gave us perfect leaps but the tier allows steps,
  // inject M2 ascending + descending so leaps always appear alongside a step interval.
  const poolHasSteps = pool.some(item => STEP_INTERVALS.has(item.interval_type))
  const poolHasLeaps = pool.some(item => PERFECT_LEAPS.has(item.interval_type))
  if (poolHasLeaps && !poolHasSteps && allowedIntervals.some(i => STEP_INTERVALS.has(i))) {
    pool = [
      ...pool,
      { interval_type: 'M2', direction: 'ascending'  },
      { interval_type: 'M2', direction: 'descending' },
    ]
  }

  let bestResult   = null
  let bestIDMDist  = Infinity

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // Pick a random sequence length within the progression tier's range
    const totalNotes = minNotes + Math.floor(Math.random() * (maxNotes - minNotes + 1))

    const sequence = buildSequence(totalNotes, pool, effectiveLow, effectiveHigh, targetIDM, maxS)
    if (!sequence) continue

    // If the sequence contains any P4/P5, it must also contain at least one step.
    // This prevents consecutive-leap-only sequences that are very hard to parse.
    const seqIntervals  = sequence.slice(1).map(s => s.interval)
    const hasPerfectLeap = seqIntervals.some(i => PERFECT_LEAPS.has(i))
    const hasStep        = seqIntervals.some(i => STEP_INTERVALS.has(i))
    const poolHasSteps   = pool.some(item => STEP_INTERVALS.has(item.interval_type))
    if (hasPerfectLeap && !hasStep && poolHasSteps) continue

    const tonicName = sequence[0].note.slice(0, -1)
    const idmComponents = computeIDM({ sequence, tonic: tonicName, currentIDM: targetIDM })

    // S is enforced during build; only check C and X post-hoc
    if (idmComponents.C > maxC + 0.05) continue
    if (idmComponents.X > maxX + 0.05) continue

    const idmDist = Math.abs(idmComponents.idm - targetIDM)

    if (idmDist < bestIDMDist) {
      bestIDMDist = idmDist
      bestResult  = { sequence, tonic: tonicName, idmComponents }
    }

    if (idmDist <= IDM_TOLERANCE) break  // good enough — stop early
  }

  // Last-resort fallback: generate without constraints to guarantee a result
  if (!bestResult) {
    const fallbackPool = pool.length > 0 ? pool : [
      { interval_type: 'M2', direction: 'ascending' },
      { interval_type: 'M2', direction: 'descending' },
    ]
    let sequence = buildSequence(Math.max(minNotes, 3), fallbackPool, effectiveLow, effectiveHigh, targetIDM, maxS)

    // If still null, manually construct a minimum 2-note sequence
    if (!sequence) {
      const tonicMidi = pickTonic(effectiveLow, effectiveHigh)
      outer: for (const fb of fallbackPool) {
        for (const dir of [fb.direction, fb.direction === 'ascending' ? 'descending' : 'ascending']) {
          const nextMidi = applyInterval(tonicMidi, fb.interval_type, dir, effectiveLow, effectiveHigh)
          if (nextMidi !== null) {
            sequence = [
              { note: midiToNote(tonicMidi) },
              { note: midiToNote(nextMidi), interval: fb.interval_type, direction: dir },
            ]
            break outer
          }
        }
      }
      // Absolute worst case: clamp a M2 up within range
      if (!sequence) {
        const nextMidi = Math.min(tonicMidi + 2, effectiveHigh)
        sequence = [
          { note: midiToNote(tonicMidi) },
          { note: midiToNote(nextMidi), interval: 'M2', direction: 'ascending' },
        ]
      }
    }

    const tonicName = sequence[0].note.slice(0, -1)
    bestResult = {
      sequence,
      tonic: tonicName,
      idmComponents: computeIDM({ sequence, tonic: tonicName, currentIDM: targetIDM }),
    }
  }

  return {
    sequence:      bestResult.sequence,
    tonic:         bestResult.tonic,
    tempo:         EXERCISE_TEMPO_BPM,
    idmComponents: bestResult.idmComponents,
  }
}

/**
 * Compute the notes of the major scale for tonal context playback.
 * Always uses the default C3–B4 range for tonal context display.
 */
export function getMajorScaleNotes(tonicName) {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const aliases = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' }
  const resolvedName = aliases[tonicName] ?? tonicName
  const tonicIdx = names.indexOf(resolvedName)
  const scaleSemitones = [0, 2, 4, 5, 7, 9, 11, 12]

  const ascending = []
  for (const oct of [3, 4]) {
    const baseMidi = tonicIdx + (oct + 1) * 12
    const scale = scaleSemitones.map(s => baseMidi + s)
    if (scale[0] >= DEFAULT_LOW_MIDI && scale[scale.length - 1] <= DEFAULT_HIGH_MIDI) {
      ascending.push(...scale.map(midiToNote))
      break
    }
  }
  if (!ascending.length) {
    const baseMidi = tonicIdx + 4 * 12
    ascending.push(...scaleSemitones.map(s => midiToNote(baseMidi + s)))
  }

  const descending = [...ascending].reverse().slice(1)
  return { ascending, descending, all: [...ascending, ...descending] }
}

/**
 * Get the tonic triad (root, major 3rd, perfect 5th) for tonal context.
 */
export function getTonicTriad(tonicName) {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const aliases = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' }
  const resolvedName = aliases[tonicName] ?? tonicName
  const tonicIdx = names.indexOf(resolvedName)

  for (const oct of [3, 4]) {
    const root  = tonicIdx + (oct + 1) * 12
    const third = root + 4
    const fifth = root + 7
    if (root >= DEFAULT_LOW_MIDI && fifth <= DEFAULT_HIGH_MIDI) {
      return [midiToNote(root), midiToNote(third), midiToNote(fifth)]
    }
  }
  const root = tonicIdx + 4 * 12
  return [midiToNote(root), midiToNote(root + 4), midiToNote(root + 7)]
}
