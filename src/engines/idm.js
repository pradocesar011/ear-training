/**
 * IDM — Melodic Difficulty Index (pure utility, no React dependencies)
 *
 * Formula: IDM = d̄ + S_norm + C + X + N/5 + K
 *
 *   d̄     = weighted mean interval difficulty
 *   S_norm = leaps / (n−1), normalized leap proportion (0–1)
 *   C      = direction changes / (n−1), melodic contour complexity (0–1)
 *   X      = proportion of non-diatonic notes (0–1)
 *   N/5    = number of chunks / 5 (working memory load)
 *   K      = D/D_ref + R = IDM_CONSTANT_K (fixed at 1.0; tempo and rhythm are constant)
 *
 * A sequence is an array of:
 *   { note: 'C4', interval: 'P5', direction: 'ascending' }
 * The first element has no interval (it is the tonic reference).
 */

import {
  INTERVAL_DI,
  DIRECTION_FDI,
  CHUNK_RULES,
  WORKING_MEMORY_CHUNK_LIMIT,
  HEARINGS_TABLE,
  IDM_CONSTANT_K,
  GROUP_INDEX,
  ERROR_PENALTY,
} from '../config/constants.js'

// ── Major scale semitones (0-based from tonic) ───────────────────────────────
const MAJOR_SCALE_SEMITONES = new Set([0, 2, 4, 5, 7, 9, 11])

// ── Note → MIDI number ────────────────────────────────────────────────────────
const NOTE_TO_MIDI = (() => {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const aliases = { 'Db': 1, 'Eb': 3, 'Fb': 4, 'Gb': 6, 'Ab': 8, 'Bb': 10, 'Cb': 11 }
  return (noteStr) => {
    const match = noteStr.match(/^([A-G][b#]?)(\d)$/)
    if (!match) throw new Error(`Invalid note: ${noteStr}`)
    const [, name, octave] = match
    const semitone = names.indexOf(name) !== -1 ? names.indexOf(name) : aliases[name]
    if (semitone === undefined) throw new Error(`Unknown note name: ${name}`)
    return semitone + (parseInt(octave) + 1) * 12
  }
})()

export { NOTE_TO_MIDI }

/**
 * Get the interval type (m2, M2, …) from two MIDI numbers.
 */
export function getIntervalType(midiA, midiB) {
  const semitones = Math.abs(midiB - midiA) % 12
  const map = { 1: 'm2', 2: 'M2', 3: 'm3', 4: 'M3', 5: 'P4', 6: 'TT', 7: 'P5', 8: 'm6', 9: 'M6', 10: 'm7', 11: 'M7', 0: 'P8' }
  return map[semitones] ?? 'P8'
}

/**
 * 4.1 — d̄ (weighted mean difficulty)
 * intervals: Array<{ interval: string, direction: string }>
 */
export function computeDBar(intervals) {
  if (!intervals.length) return 0
  const sum = intervals.reduce((acc, { interval, direction }) => {
    const di = INTERVAL_DI[interval] ?? 1
    const fdi = DIRECTION_FDI[direction] ?? 1
    return acc + di * fdi
  }, 0)
  return sum / intervals.length
}

/**
 * 4.2 — S (raw melodic leap count)
 * A leap = any interval that is a third or larger (not m2 or M2).
 * S is the dominant difficulty variable — even a few leaps push the IDM up significantly.
 */
export function computeS(intervals) {
  if (!intervals.length) return 0
  const steps = new Set(['m2', 'M2'])
  return intervals.filter(({ interval }) => !steps.has(interval)).length
}

/**
 * 4.3 — C (melodic contour)
 * direction_changes / (n − 1) where n − 1 = total number of intervals.
 * Ranges 0.0–1.0.
 */
export function computeC(intervals) {
  if (intervals.length < 2) return 0
  let changes = 0
  for (let i = 1; i < intervals.length; i++) {
    if (intervals[i - 1].direction !== intervals[i].direction) changes++
  }
  return changes / intervals.length
}

/**
 * 4.4 — X (chromaticism)
 * Proportion of notes that do NOT belong to the tonic's major scale.
 * notes: string[] e.g. ['C4', 'D4', 'Bb4']
 * tonicNote: string e.g. 'C'
 */
export function computeX(notes, tonicNote) {
  if (!notes.length) return 0
  const tonicMidi = NOTE_TO_MIDI(tonicNote + '4') % 12
  const chromatic = notes.filter(n => {
    const semitone = (NOTE_TO_MIDI(n) % 12 - tonicMidi + 12) % 12
    return !MAJOR_SCALE_SEMITONES.has(semitone)
  }).length
  return chromatic / notes.length
}

/**
 * 4.5 — N (number of chunks) and N/5
 * Chunk size is determined by sequence length via CHUNK_RULES.
 * n = total note count (including tonic).
 *
 * For sequences with no chunking (≤ 5 notes), we estimate 2 notes per
 * cognitive unit to still produce a meaningful N value.
 */
export function computeNChunks(n) {
  const rule = CHUNK_RULES.find(r => n <= r.maxNotes) ?? CHUNK_RULES[CHUNK_RULES.length - 1]
  const chunkSize = rule.notesPerChunk ?? 2
  return Math.ceil(n / chunkSize)
}

export function computeNOver5(n) {
  return computeNChunks(n) / WORKING_MEMORY_CHUNK_LIMIT
}

/**
 * 4.8 — Allowed hearings H (used for UX; not part of IDM formula in this prototype)
 */
export function computeHearings(idm) {
  const entry = HEARINGS_TABLE.find(e => idm < e.maxIDM)
  return entry ? entry.H : 1
}

/**
 * Full IDM calculation.
 *
 * @param {object} params
 * @param {Array<{note: string, interval?: string, direction?: string}>} params.sequence
 *   First element is the tonic note (no interval). Remaining elements have interval + direction.
 * @param {string}  params.tonic      - e.g. 'C'
 * @param {number}  params.currentIDM - used only to determine allowed hearings (H)
 * @returns {{ idm, dBar, S, C, X, nChunks, dDensity, R, H }}
 */
export function computeIDM({ sequence, tonic, currentIDM }) {
  const intervals = sequence
    .filter(s => s.interval && s.direction)
    .map(s => ({ interval: s.interval, direction: s.direction }))

  const notes = sequence.map(s => s.note)

  const dBar    = computeDBar(intervals)
  const S       = computeS(intervals)
  const C       = computeC(intervals)
  const X       = computeX(notes, tonic)
  const nChunks = computeNChunks(notes.length)
  const nOver5  = nChunks / WORKING_MEMORY_CHUNK_LIMIT
  const H       = computeHearings(currentIDM)

  // K = D/D_ref + R = IDM_CONSTANT_K (fixed at 1.0; tempo = 60 BPM, R = 0)
  const idm = dBar + S + C + X + nOver5 + IDM_CONSTANT_K

  return { idm, dBar, S, C, X, nChunks, dDensity: IDM_CONSTANT_K, R: 0, H }
}

/**
 * Weighted precision calculation (Samplaski, 2005).
 *
 * @param {string[]} expected  - array of note names e.g. ['C4','E4','G4']
 * @param {string[]} answered  - user's input (same length)
 * @returns {number} 0–1
 */
export function computeWeightedPrecision(expected, answered) {
  if (!expected.length) return 1
  let correct = 0
  let weightedErrors = 0

  expected.forEach((exp, i) => {
    const ans = answered[i]
    if (!ans) {
      weightedErrors += ERROR_PENALTY.non_adjacent
      return
    }
    if (exp === ans) {
      correct++
      return
    }

    // Use pitch class distance as proxy for error severity
    const expPC = NOTE_TO_MIDI(exp) % 12
    const ansPC = NOTE_TO_MIDI(ans) % 12
    const semDist = Math.min(Math.abs(expPC - ansPC), 12 - Math.abs(expPC - ansPC))

    let penalty
    if (semDist === 0) penalty = ERROR_PENALTY.same
    else if (semDist <= 2) penalty = ERROR_PENALTY.adjacent
    else penalty = ERROR_PENALTY.non_adjacent

    weightedErrors += penalty
  })

  const denominator = correct + weightedErrors
  if (denominator === 0) return 1
  return correct / denominator
}

/**
 * Weighted precision using interval group distance (more accurate).
 *
 * expected / answered are interval type strings (m2, M3, …)
 */
export function computeIntervalPrecision(expectedIntervals, answeredIntervals) {
  if (!expectedIntervals.length) return 1
  let correct = 0
  let weightedErrors = 0

  expectedIntervals.forEach((exp, i) => {
    const ans = answeredIntervals[i]
    if (!ans) {
      weightedErrors += ERROR_PENALTY.non_adjacent
      return
    }
    if (exp === ans) {
      correct++
      return
    }
    const expGroup = GROUP_INDEX[exp] ?? 0
    const ansGroup = GROUP_INDEX[ans] ?? 0
    const dist = Math.abs(expGroup - ansGroup)
    let penalty
    if (dist === 0) penalty = ERROR_PENALTY.same
    else if (dist === 1) penalty = ERROR_PENALTY.adjacent
    else penalty = ERROR_PENALTY.non_adjacent

    weightedErrors += penalty
  })

  const denominator = correct + weightedErrors
  if (denominator === 0) return 1
  return correct / denominator
}
