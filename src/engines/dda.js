/**
 * DDA — Dynamic Difficulty Adjustment Engine (pure utility, no React dependencies)
 *
 * Tracks session-level mastery windows and exercise-level consecutive errors
 * to decide when to raise or lower the IDM.
 *
 * References: Cornelius & Brown (2020)
 */

import { DDA } from '../config/constants.js'

/**
 * Determine the IDM adjustment after an exercise.
 *
 * @param {object} state
 * @param {number}   state.currentIDM
 * @param {number}   state.precision          - weighted precision of the just-finished exercise (0–1)
 * @param {number}   state.consecutiveErrors  - running count of consecutive wrong answers in this exercise
 * @param {number[]} state.recentPrecisions   - precisions of the last N sessions (newest last)
 * @returns {{ newIDM: number, trigger: 'mastery'|'overload'|'none', consecutiveErrors: number }}
 */
export function evaluateDDA({ currentIDM, precision, consecutiveErrors, recentPrecisions }) {
  // Consecutive errors reset on any correct note; the caller tracks this.
  // Here we just evaluate what to do after the exercise completes.

  const overloaded =
    precision <= DDA.OVERLOAD_PRECISION ||
    consecutiveErrors >= DDA.OVERLOAD_CONSECUTIVE_ERRORS

  if (overloaded) {
    return {
      newIDM: Math.max(DDA.IDM_MIN, currentIDM - DDA.IDM_STEP),
      trigger: 'overload',
      consecutiveErrors: 0,
    }
  }

  // Check mastery window: last N sessions must all be ≥ 80%
  const window = recentPrecisions.slice(-DDA.MASTERY_CONSECUTIVE_WINS)
  const mastery =
    window.length >= DDA.MASTERY_CONSECUTIVE_WINS &&
    window.every(p => p >= DDA.MASTERY_PRECISION) &&
    precision >= DDA.MASTERY_PRECISION

  if (mastery) {
    return {
      newIDM: Math.min(DDA.IDM_MAX, currentIDM + DDA.IDM_STEP),
      trigger: 'mastery',
      consecutiveErrors: 0,
    }
  }

  return {
    newIDM: currentIDM,
    trigger: 'none',
    consecutiveErrors: 0,
  }
}

/**
 * Update the consecutive error counter after a single note answer.
 *
 * @param {boolean} correct
 * @param {number}  current  - current consecutiveErrors count
 * @returns {number} updated count
 */
export function updateConsecutiveErrors(correct, current) {
  return correct ? 0 : current + 1
}

/**
 * Compute the IDM trend for display (↑ / → / ↓).
 *
 * @param {number} idmStart - IDM at session start
 * @param {number} idmEnd   - IDM at session end
 * @returns {'up'|'stable'|'down'}
 */
export function getIDMTrend(idmStart, idmEnd) {
  if (idmEnd > idmStart) return 'up'
  if (idmEnd < idmStart) return 'down'
  return 'stable'
}
