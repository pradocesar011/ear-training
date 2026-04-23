#!/usr/bin/env node
/**
 * Ear Training Algorithm Simulator
 *
 * Simulates N sessions with a synthetic user profile to test IDM/DDA/SRS behavior
 * without touching the database or the UI.
 *
 * Usage:
 *   node simulate.js [options]
 *
 * Options:
 *   --profile   <name>   Profile: high|medium|low|improving|oscillating|plateau|steady
 *                        (default: medium)
 *   --sessions  <n>      Sessions to simulate (default: 50)
 *   --exercises <n>      Exercises per session (default: 10)
 *   --days      <n>      Days between sessions (default: 1)
 *   --precision <0-1>    Target DDA precision for 'steady' profile (default: 0.70)
 *   --start     <0-1>    Start precision for 'improving'/'plateau' (default: 0.40)
 *   --end       <0-1>    End precision for 'improving' (default: 0.85)
 *   --plateau   <0-1>    Plateau target for 'plateau' profile (default: 0.70)
 *   --seed      <n>      Integer seed for reproducible runs (default: random)
 *   --out       <dir>    Output directory (default: ./simulation_output)
 *   --no-csv            Print summary only, skip CSV files
 *
 * Precision note:
 *   --precision controls the target WEIGHTED precision (what the DDA sees).
 *   Mastery threshold = 0.80, overload threshold = 0.50.
 *
 * Profiles:
 *   high        Constant 0.85 — tests if IDM rises too fast
 *   medium      Constant 0.65 — tests if system stagnates near balance point
 *   low         Constant 0.40 — tests if IDM bottoms out gracefully
 *   improving   0.40 → 0.85 linearly over N sessions — tests realistic progress
 *   oscillating Alternates 0.50 / 0.80 — tests DDA response to sudden changes
 *   plateau     Rises from 0.40 → 0.70, then stagnates — tests skill ceiling
 *   steady      Constant custom precision (use --precision)
 *
 * Examples:
 *   node simulate.js --profile high --sessions 30
 *   node simulate.js --profile improving --sessions 60 --exercises 12
 *   node simulate.js --profile steady --precision 0.75 --seed 42
 *   node simulate.js --profile oscillating --sessions 40 --no-csv
 */

import { generateSequence }                         from './src/engines/sequenceGenerator.js'
import { computeWeightedPrecision }                 from './src/engines/idm.js'
import { evaluateDDA }                              from './src/engines/dda.js'
import { selectSessionIntervals, updateSRSItem, buildInitialSRSItem } from './src/engines/srs.js'
import { DDA, INTERVAL_INTRODUCTION_ORDER, KEYBOARD } from './src/config/constants.js'
import { writeFileSync, mkdirSync, existsSync }     from 'fs'

// ── Seeded PRNG (mulberry32) ──────────────────────────────────────────────────

function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ── Note pool for wrong answers (C3–B4, same as default keyboard) ─────────────

const MIDI_NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
const NOTE_POOL = []
for (let oct = 3; oct <= 4; oct++)
  for (const n of MIDI_NOTE_NAMES)
    NOTE_POOL.push(`${n}${oct}`)

function pickWrongNote(expected, rng) {
  const pool = NOTE_POOL.filter(n => n !== expected)
  return pool[Math.floor(rng() * pool.length)]
}

// ── Precision model ───────────────────────────────────────────────────────────
//
// computeWeightedPrecision uses penalty 2.0 for most wrong notes (non-adjacent).
// Given a target DDA precision P_target, the note-level correctness probability p satisfies:
//   P_target = p / (p + (1−p)×2)  →  p = P_target × 2 / (1 + P_target)
//
// We expose P_target to the user (the DDA-facing metric).

function targetToNoteP(targetPrecision) {
  return (targetPrecision * 2) / (1 + targetPrecision)
}

// ── Simulate one exercise ─────────────────────────────────────────────────────
//
// Returns { userSeq, correctArr, consecutiveErrors }
// consecutiveErrors is the trailing wrong-answer streak at exercise end
// (what the real useSession hook passes to evaluateDDA).

function simulateExercise(sequence, targetPrecision, rng) {
  const noteP = targetToNoteP(Math.min(Math.max(targetPrecision, 0), 1))
  const notes = sequence.map(s => s.note)
  const userSeq = []
  let consecErrors = 0

  for (const expected of notes) {
    const correct = rng() < noteP
    if (correct) {
      userSeq.push(expected)
      consecErrors = 0
    } else {
      userSeq.push(pickWrongNote(expected, rng))
      consecErrors++
    }
  }

  const correctArr = notes.map((n, i) => userSeq[i] === n)
  return { userSeq, correctArr, consecutiveErrors: consecErrors }
}

// ── Profile: resolve target precision for a given session index ───────────────

function resolveProfilePrecision(profile, sessionIdx, totalSessions, opts) {
  switch (profile) {
    case 'high':        return 0.85
    case 'medium':      return 0.65
    case 'low':         return 0.40
    case 'steady':      return opts.precision

    case 'improving': {
      const t = totalSessions > 1 ? sessionIdx / (totalSessions - 1) : 1
      return opts.start + t * (opts.end - opts.start)
    }

    case 'oscillating':
      return sessionIdx % 2 === 0 ? 0.50 : 0.80

    case 'plateau': {
      const halfSessions = Math.floor(totalSessions / 2)
      if (sessionIdx >= halfSessions) return opts.plateau
      const t = halfSessions > 0 ? sessionIdx / halfSessions : 1
      return opts.start + t * (opts.plateau - opts.start)
    }

    default:
      return opts.precision
  }
}

// ── CSV helpers ───────────────────────────────────────────────────────────────

function toCSV(rows) {
  if (!rows.length) return ''
  const headers = Object.keys(rows[0])
  return [
    headers.join(','),
    ...rows.map(row =>
      headers.map(h => {
        const v = row[h]
        if (v === null || v === undefined) return ''
        const s = String(v)
        return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s
      }).join(',')
    ),
  ].join('\n')
}

function writeCSV(dir, filename, rows) {
  writeFileSync(`${dir}/${filename}`, toCSV(rows), 'utf8')
}

// ── Argument parsing ──────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  const opts = {
    profile:   'medium',
    sessions:  50,
    exercises: 10,
    days:      1,
    precision: 0.70,
    start:     0.40,
    end:       0.85,
    plateau:   0.70,
    seed:      null,
    out:       './simulation_output',
    csv:       true,
  }
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--help': case '-h':
        console.log(process.argv[1].split(/[/\\]/).pop() + ' — see file header for usage')
        process.exit(0)
      case '--profile':   opts.profile   = args[++i];           break
      case '--sessions':  opts.sessions  = parseInt(args[++i]); break
      case '--exercises': opts.exercises = parseInt(args[++i]); break
      case '--days':      opts.days      = parseFloat(args[++i]);break
      case '--precision': opts.precision = parseFloat(args[++i]);break
      case '--start':     opts.start     = parseFloat(args[++i]);break
      case '--end':       opts.end       = parseFloat(args[++i]);break
      case '--plateau':   opts.plateau   = parseFloat(args[++i]);break
      case '--seed':      opts.seed      = parseInt(args[++i]); break
      case '--out':       opts.out       = args[++i];           break
      case '--no-csv':    opts.csv       = false;               break
    }
  }
  return opts
}

// ── MIDI range for sequence generation ───────────────────────────────────────

function noteNameToMidi(name) {
  const names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
  const n = name.slice(0, -1), oct = parseInt(name.slice(-1))
  return names.indexOf(n) + (oct + 1) * 12
}
const LOW_MIDI  = noteNameToMidi(KEYBOARD.LOW)   // C3 = 48
const HIGH_MIDI = noteNameToMidi(KEYBOARD.HIGH)  // B4 = 71

// ── Main simulation ───────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs()
  const rng  = opts.seed != null ? mulberry32(opts.seed) : Math.random.bind(Math)

  // Patch Math.random so engines use seeded RNG when --seed is specified
  if (opts.seed != null) Math.random = rng

  const PROFILES = ['high','medium','low','improving','oscillating','plateau','steady']
  if (!PROFILES.includes(opts.profile)) {
    console.error(`Unknown profile '${opts.profile}'. Valid: ${PROFILES.join(', ')}`)
    process.exit(1)
  }

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  Ear Training Simulator`)
  console.log(`${'═'.repeat(60)}`)
  console.log(`  Profile:   ${opts.profile}`)
  console.log(`  Sessions:  ${opts.sessions}`)
  console.log(`  Exercises: ${opts.exercises} per session`)
  console.log(`  Day gap:   ${opts.days} day(s) between sessions`)
  if (opts.seed != null) console.log(`  Seed:      ${opts.seed}`)
  console.log(`${'─'.repeat(60)}\n`)

  // State
  let idmCurrent       = 2.0
  let srsItems         = []         // in-memory SRS table rows
  let recentPrecisions = []         // last DDA.MASTERY_CONSECUTIVE_WINS precisions
  let currentDate      = new Date('2025-01-01T10:00:00Z')

  // Output rows
  const exerciseRows = []
  const sessionRows  = []
  const srsSnapshots = []

  // ── Session loop ──────────────────────────────────────────────────────────

  for (let s = 0; s < opts.sessions; s++) {
    const sessionStart    = currentDate
    const idmAtStart      = idmCurrent
    const targetPrecision = resolveProfilePrecision(opts.profile, s, opts.sessions, opts)

    // SRS: select due + new intervals
    const { due, newItems } = selectSessionIntervals(srsItems, s, currentDate, idmCurrent)

    // Init new intervals
    const newInitialized = newItems.map(ni => buildInitialSRSItem('sim-user', ni.interval, ni.direction))
    srsItems = [...srsItems, ...newInitialized]

    const available = [
      ...due,
      ...newInitialized.map(ni => ({
        interval_type: ni.interval_type,
        direction:     ni.direction,
        exposures:     0,
      })),
    ]
    if (!available.length)
      available.push({ interval_type: 'M2', direction: 'ascending', exposures: 0 })

    let sessionPrecSum = 0
    let masterTriggers = 0, overloadTriggers = 0, noneTriggers = 0

    // ── Exercise loop ─────────────────────────────────────────────────────

    for (let e = 0; e < opts.exercises; e++) {
      const idmBefore = idmCurrent

      const { sequence, tonic, idmComponents } = generateSequence({
        targetIDM:      idmCurrent,
        availableItems: available,
        lowMidi:        LOW_MIDI,
        highMidi:       HIGH_MIDI,
      })

      const { userSeq, correctArr, consecutiveErrors } =
        simulateExercise(sequence, targetPrecision, rng)

      const expected  = sequence.map(s => s.note)
      const precision = computeWeightedPrecision(expected, userSeq)

      const { newIDM, trigger } = evaluateDDA({
        currentIDM:        idmCurrent,
        precision,
        consecutiveErrors,
        recentPrecisions,
      })

      // Update SRS for each interval in the sequence
      const intervals = sequence.filter(s => s.interval)
      for (let i = 0; i < intervals.length; i++) {
        const { interval, direction } = intervals[i]
        const correct = correctArr[i + 1] ?? false   // tonic is at index 0
        const idx = srsItems.findIndex(
          it => it.interval_type === interval && it.direction === direction
        )
        if (idx !== -1) {
          const updates = updateSRSItem(srsItems[idx], correct, currentDate)
          srsItems[idx] = { ...srsItems[idx], ...updates }
        }
      }

      recentPrecisions = [...recentPrecisions, precision].slice(-DDA.MASTERY_CONSECUTIVE_WINS)
      idmCurrent = newIDM

      if (trigger === 'mastery')  masterTriggers++
      else if (trigger === 'overload') overloadTriggers++
      else noneTriggers++

      sessionPrecSum += precision

      // Count correct fraction (unweighted)
      const correctFraction = correctArr.filter(Boolean).length / correctArr.length

      exerciseRows.push({
        session:          s + 1,
        exercise:         e + 1,
        target_precision: targetPrecision.toFixed(2),
        precision_dda:    precision.toFixed(3),
        correct_fraction: correctFraction.toFixed(3),
        idm_before:       idmBefore.toFixed(2),
        idm_actual:       idmComponents.idm.toFixed(2),
        idm_after:        newIDM.toFixed(2),
        trigger,
        consec_errors:    consecutiveErrors,
        seq_length:       sequence.length,
        S_leaps:          idmComponents.S,
        C_contour:        idmComponents.C.toFixed(2),
        d_bar:            idmComponents.dBar.toFixed(2),
        X_chrom:          idmComponents.X.toFixed(2),
        n_chunks:         idmComponents.nChunks,
        intervals_used:   intervals.map(i => `${i.interval}${i.direction[0]}`).join('|'),
        sequence_notes:   sequence.map(s => s.note).join(' '),
      })
    }

    const meanPrec  = sessionPrecSum / opts.exercises
    const idmChange = idmCurrent - idmAtStart

    sessionRows.push({
      session:                s + 1,
      date:                   sessionStart.toISOString().slice(0, 10),
      target_precision:       targetPrecision.toFixed(2),
      idm_start:              idmAtStart.toFixed(2),
      idm_end:                idmCurrent.toFixed(2),
      idm_change:             idmChange.toFixed(2),
      mean_precision:         meanPrec.toFixed(3),
      triggers_mastery:       masterTriggers,
      triggers_overload:      overloadTriggers,
      triggers_none:          noneTriggers,
      new_intervals:          newItems.length,
      total_srs_items:        srsItems.length,
    })

    // SRS snapshot (once per session)
    srsSnapshots.push({
      session:    s + 1,
      date:       sessionStart.toISOString().slice(0, 10),
      idm:        idmCurrent.toFixed(2),
      srs_count:  srsItems.length,
      box1: srsItems.filter(i => i.leitner_box === 1).length,
      box2: srsItems.filter(i => i.leitner_box === 2).length,
      box3: srsItems.filter(i => i.leitner_box === 3).length,
      box4: srsItems.filter(i => i.leitner_box === 4).length,
      box5: srsItems.filter(i => i.leitner_box === 5).length,
    })

    // Advance simulated date
    currentDate = new Date(currentDate.getTime() + opts.days * 24 * 3600 * 1000)

    // Print rolling progress every 5 sessions or at end
    if ((s + 1) % 5 === 0 || s === opts.sessions - 1) {
      const bar  = '█'.repeat(Math.round(idmCurrent)) + '░'.repeat(Math.max(0, 12 - Math.round(idmCurrent)))
      const prec = (meanPrec * 100).toFixed(0).padStart(3)
      const idm  = idmCurrent.toFixed(2).padStart(5)
      const srsN = String(srsItems.length).padStart(2)
      console.log(
        `  S${String(s+1).padStart(3)} │ IDM ${idm} ${bar} │ prec ${prec}% │ SRS ${srsN} intervals`
      )
    }
  }

  // ── Summary statistics ────────────────────────────────────────────────────

  const idmValues    = sessionRows.map(r => parseFloat(r.idm_end))
  const precValues   = sessionRows.map(r => parseFloat(r.mean_precision))
  const finalIDM     = idmValues[idmValues.length - 1]
  const peakIDM      = Math.max(...idmValues)
  const meanPrec     = precValues.reduce((a, b) => a + b, 0) / precValues.length

  const masterCount  = sessionRows.reduce((a, r) => a + r.triggers_mastery,  0)
  const overloadCnt  = sessionRows.reduce((a, r) => a + r.triggers_overload, 0)
  const totalEx      = opts.sessions * opts.exercises

  // Session where IDM first reached 3.0, 5.0, 8.0
  const milestone = (threshold) => {
    const s = sessionRows.find(r => parseFloat(r.idm_end) >= threshold)
    return s ? `session ${s.session}` : 'not reached'
  }

  console.log(`\n${'─'.repeat(60)}`)
  console.log(`  SUMMARY`)
  console.log(`${'─'.repeat(60)}`)
  console.log(`  Final IDM:        ${finalIDM.toFixed(2)}`)
  console.log(`  Peak IDM:         ${peakIDM.toFixed(2)}`)
  console.log(`  Mean precision:   ${(meanPrec * 100).toFixed(1)}%`)
  console.log(`  SRS intervals:    ${srsItems.length} / ${INTERVAL_INTRODUCTION_ORDER.length}`)
  console.log(`  Mastery triggers: ${masterCount} / ${totalEx} exercises (${(masterCount/totalEx*100).toFixed(1)}%)`)
  console.log(`  Overload triggers:${overloadCnt} / ${totalEx} exercises (${(overloadCnt/totalEx*100).toFixed(1)}%)`)
  console.log(`  IDM 3.0 reached:  ${milestone(3.0)}`)
  console.log(`  IDM 5.0 reached:  ${milestone(5.0)}`)
  console.log(`  IDM 8.0 reached:  ${milestone(8.0)}`)
  console.log(`\n  Introduced intervals:`)
  srsItems.forEach(item => {
    const avg = item.exposures > 0
      ? (item.correct_count / item.exposures * 100).toFixed(0)
      : '—'
    const box = item.leitner_box
    console.log(`    ${item.interval_type.padEnd(3)} ${item.direction.padEnd(11)} box ${box}  acc ${avg}%  (${item.exposures}×)`)
  })

  // ── CSV output ────────────────────────────────────────────────────────────

  if (opts.csv) {
    if (!existsSync(opts.out)) mkdirSync(opts.out, { recursive: true })

    const ts      = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-')
    const prefix  = `${opts.profile}_s${opts.sessions}_${ts}`

    writeCSV(opts.out, `${prefix}_exercises.csv`, exerciseRows)
    writeCSV(opts.out, `${prefix}_sessions.csv`,  sessionRows)
    writeCSV(opts.out, `${prefix}_srs.csv`,       srsSnapshots)

    console.log(`\n  CSV files written to ${opts.out}/`)
    console.log(`    ${prefix}_exercises.csv`)
    console.log(`    ${prefix}_sessions.csv`)
    console.log(`    ${prefix}_srs.csv`)
  }

  console.log(`${'═'.repeat(60)}\n`)
}

main().catch(err => {
  console.error('\nSimulation error:', err.message)
  console.error(err.stack)
  process.exit(1)
})
