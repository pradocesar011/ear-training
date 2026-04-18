/**
 * SRS — Spaced Repetition Engine (pure utility, no React dependencies)
 *
 * Combines three algorithms:
 *   1. Half-Life Regression (HLR) — Settles & Meeder (2016)
 *   2. Leitner Queue Network — Reddy et al. (2016)
 *   3. MEMORIZE — Tabibian et al. (2019)
 */

import {
  HLR_WEIGHTS_INIT,
  MEMORIZE_Q,
  SRS_RECALL_THRESHOLD,
  SRS_MAX_NEW_PER_SESSION,
  LEITNER_BOX_FREQUENCY,
  INTERVAL_INTRODUCTION_ORDER,
  SRS_UNLOCK_THRESHOLDS,
} from '../config/constants.js'

// ── 6.1 Half-Life Regression ─────────────────────────────────────────────────

/**
 * Recall probability at time Δ (days) given half-life h.
 */
export function recallProbability(delta, halfLife) {
  if (halfLife <= 0) return 0
  return Math.pow(2, -delta / halfLife)
}

/**
 * Estimate half-life from HLR feature vector.
 * x = [sqrt(correct_count), sqrt(wrong_count), sqrt(exposures)]
 * ĥ = 2^(Θ · x)
 */
export function estimateHalfLife(correctCount, wrongCount, exposures, weights = HLR_WEIGHTS_INIT) {
  const x = [Math.sqrt(correctCount), Math.sqrt(wrongCount), Math.sqrt(exposures)]
  const dot = weights.reduce((acc, w, i) => acc + w * x[i], 0)
  return Math.pow(2, dot)
}

/**
 * Update HLR weights via gradient step (online learning).
 * Simple gradient descent on squared-loss: L = (p_hat - p_target)^2
 *
 * Returns updated weights array (does not mutate input).
 */
export function updateHLRWeights(weights, correctCount, wrongCount, exposures, pTarget, learningRate = 0.01) {
  const x = [Math.sqrt(correctCount), Math.sqrt(wrongCount), Math.sqrt(exposures)]
  const h = estimateHalfLife(correctCount, wrongCount, exposures, weights)
  const delta = 0   // just-reviewed → Δ=0, p_hat = 1
  const pHat = recallProbability(delta, h)
  const error = pHat - pTarget
  // gradient ∂L/∂w_i  ≈ 2 * error * pHat * ln(2) * x_i  (chain rule through 2^(Θ·x))
  return weights.map((w, i) => w - learningRate * 2 * error * pHat * Math.LN2 * x[i])
}

// ── 6.2 Leitner Queue Network ────────────────────────────────────────────────

/**
 * Advance or demote a Leitner box based on correctness.
 */
export function updateLeitnerBox(currentBox, correct) {
  if (correct) return Math.min(5, currentBox + 1)
  return 1
}

/**
 * Check whether a given item is due for review in this session.
 * sessionCount: total sessions completed by the user (0-based count).
 */
export function isLeitnerDue(leitnerBox, sessionCount) {
  const freq = LEITNER_BOX_FREQUENCY[leitnerBox] ?? 1
  return sessionCount % freq === 0
}

// ── 6.3 MEMORIZE ─────────────────────────────────────────────────────────────

/**
 * Optimal review intensity u*(t).
 * Returns a priority score — higher = more urgent.
 */
export function memorizeIntensity(recallProb, q = MEMORIZE_Q) {
  return Math.pow(q, -0.5) * (1 - recallProb)
}

// ── Session scheduling ────────────────────────────────────────────────────────

/**
 * Select intervals to include in the next session.
 *
 * @param {object[]} srsItems    - rows from the srs_items table
 * @param {number}   sessionCount - how many sessions the user has completed
 * @param {Date}     now
 * @param {number}   currentIDM  - user's current IDM (used for unlock thresholds)
 * @returns {{ due: object[], newItems: object[] }}
 */
export function selectSessionIntervals(srsItems, sessionCount, now = new Date(), currentIDM = 1.0) {
  const nowMs = now.getTime()

  // Items the user has already seen
  const knownItems = srsItems.filter(item => item.exposures > 0)

  // Items not yet introduced — filtered by introduction order AND IDM unlock threshold
  const unseenIntervals = INTERVAL_INTRODUCTION_ORDER.filter(intro => {
    // Skip if already introduced
    if (srsItems.some(
      item => item.interval_type === intro.interval && item.direction === intro.direction
    )) return false

    // Skip if current IDM hasn't reached the unlock threshold for this interval
    const threshold = SRS_UNLOCK_THRESHOLDS.find(
      t => t.interval === intro.interval && t.direction === intro.direction
    )
    return !threshold || currentIDM >= threshold.minIDM
  })

  // Filter known items that are due per Leitner schedule or overdue per HLR
  const due = knownItems.filter(item => {
    const leitnerDue = isLeitnerDue(item.leitner_box, sessionCount)
    if (!leitnerDue) return false

    const lastSeen = item.last_seen ? new Date(item.last_seen).getTime() : 0
    const deltaMs = nowMs - lastSeen
    const deltaDays = deltaMs / (1000 * 60 * 60 * 24)
    const h = estimateHalfLife(item.correct_count, item.wrong_count, item.exposures)
    const p = recallProbability(deltaDays, h)
    return p < SRS_RECALL_THRESHOLD
  })

  // Limit new intervals to max per session
  const newItems = unseenIntervals.slice(0, SRS_MAX_NEW_PER_SESSION)

  // Sort due items by urgency (lowest recall probability first)
  const nowDays = nowMs / (1000 * 60 * 60 * 24)
  due.sort((a, b) => {
    const deltaA = (nowMs - new Date(a.last_seen || 0).getTime()) / (1000 * 60 * 60 * 24)
    const deltaB = (nowMs - new Date(b.last_seen || 0).getTime()) / (1000 * 60 * 60 * 24)
    const hA = estimateHalfLife(a.correct_count, a.wrong_count, a.exposures)
    const hB = estimateHalfLife(b.correct_count, b.wrong_count, b.exposures)
    const pA = recallProbability(deltaA, hA)
    const pB = recallProbability(deltaB, hB)
    return pA - pB   // ascending: most forgotten first
  })

  return { due, newItems }
}

/**
 * Update an SRS item after a review.
 *
 * @param {object} item      - current srs_items row
 * @param {boolean} correct
 * @param {Date}   now
 * @returns {object} fields to update (partial row)
 */
export function updateSRSItem(item, correct, now = new Date()) {
  const newExposures    = (item.exposures    ?? 0) + 1
  const newCorrect      = (item.correct_count ?? 0) + (correct ? 1 : 0)
  const newWrong        = (item.wrong_count   ?? 0) + (correct ? 0 : 1)
  const newBox          = updateLeitnerBox(item.leitner_box ?? 1, correct)
  const newWeights      = updateHLRWeights(
    item.hlr_weights ?? HLR_WEIGHTS_INIT,
    newCorrect, newWrong, newExposures,
    correct ? 1 : 0
  )
  const newHalfLife     = estimateHalfLife(newCorrect, newWrong, newExposures, newWeights)

  // Schedule next review: nextReview = now + halfLife days
  const nextReview = new Date(now.getTime() + newHalfLife * 24 * 60 * 60 * 1000)

  return {
    exposures:     newExposures,
    correct_count: newCorrect,
    wrong_count:   newWrong,
    leitner_box:   newBox,
    half_life:     newHalfLife,
    last_seen:     now.toISOString(),
    next_review:   nextReview.toISOString(),
  }
}

/**
 * Build an initial srs_items row for a newly introduced interval.
 */
export function buildInitialSRSItem(userId, intervalType, direction) {
  return {
    user_id:       userId,
    interval_type: intervalType,
    direction,
    exposures:     0,
    correct_count: 0,
    wrong_count:   0,
    half_life:     1.0,
    last_seen:     null,
    next_review:   null,
    leitner_box:   1,
  }
}
