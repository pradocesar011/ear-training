// ─────────────────────────────────────────────────────────────────────────────
// PROVISIONAL PARAMETERS — Section 13 of the spec.
// All values derived from academic literature. Must be validated via user testing.
// Change values here only; do not hardcode them elsewhere.
// ─────────────────────────────────────────────────────────────────────────────

// ── Interval definitions ─────────────────────────────────────────────────────

// Intrinsic interval difficulty (Samplaski, 2005)
// di: 1 = Low, 2 = Medium, 3 = High, 4 = Very High
export const INTERVAL_DI = {
  m2: 1,
  M2: 1,
  P4: 1,
  P5: 1,
  P8: 1,
  m3: 2,
  M3: 2,
  TT: 3,
  m7: 3,
  M7: 3,
  m6: 4,
  M6: 4,
}

// Difficulty groups for error weighting (Samplaski, 2005)
export const DIFFICULTY_GROUPS = {
  1: ['M2', 'm2', 'P5', 'P4', 'P8'],
  2: ['M3', 'm3'],
  3: ['TT', 'M7', 'm7'],
  4: ['M6', 'm6'],
}

// Group index for adjacency calculation (0-based)
export const GROUP_INDEX = {
  m2: 0, M2: 0, P4: 0, P5: 0, P8: 0,
  m3: 1, M3: 1,
  TT: 2, m7: 2, M7: 2,
  m6: 3, M6: 3,
}

// Direction factor fdi (Samplaski, 2005)
// Harmonic direction is not used in this prototype.
export const DIRECTION_FDI = {
  ascending:  1.00,
  descending: 1.25,
}

// Error penalty factors by group distance (Samplaski, 2005)
export const ERROR_PENALTY = {
  same:         0.5,   // same difficulty group
  adjacent:     1.0,   // 1 group apart
  non_adjacent: 2.0,   // 2+ groups apart
}

// ── DDA thresholds (Cornelius & Brown, 2020) ─────────────────────────────────

export const DDA = {
  MASTERY_PRECISION:         0.80,   // precision ≥ 80% triggers IDM +1
  MASTERY_CONSECUTIVE_WINS:  3,      // must hold for 3 consecutive sessions
  OVERLOAD_PRECISION:        0.50,   // precision ≤ 50% triggers IDM -1
  OVERLOAD_CONSECUTIVE_ERRORS: 3,    // 3 consecutive errors also trigger IDM -1
  IDM_MIN:                   1.0,
  IDM_MAX:                   12.0,
  IDM_STEP:                  1.0,
}

// ── Fixed system constants (tempo and rhythm are fixed) ───────────────────────

export const EXERCISE_TEMPO_BPM = 60       // all exercises at 60 BPM
export const D_REF = 1.0                   // 1 note/second (quarter note at 60 BPM)
export const D_DENSITY = EXERCISE_TEMPO_BPM / 60 / D_REF  // always 1.0 at 60 BPM
export const RHYTHMIC_COMPLEXITY = 0       // uniform quarter notes, R = 0
export const IDM_CONSTANT_K = D_DENSITY + RHYTHMIC_COMPLEXITY  // always 1.0

// ── Chunk system (Cornelius & Brown, 2020) ────────────────────────────────────

export const CHUNK = {
  MEMORY_LIMIT: 5,   // N / 5 denominator (musical working memory)
}

// Silence between chunks scales with IDM (more processing time at lower levels)
export const CHUNK_SILENCE_DURATIONS = [
  { maxIDM: 3.0,      beats: 1.00 },   // one quarter note
  { maxIDM: 6.0,      beats: 0.50 },   // one eighth note
  { maxIDM: Infinity, beats: 0.25 },   // one sixteenth note
]

// Notes per chunk increases as IDM rises
export const CHUNK_SIZE_BY_IDM = [
  { maxIDM: 3.0,      notesPerChunk: 2 },
  { maxIDM: 6.0,      notesPerChunk: 3 },
  { maxIDM: 9.0,      notesPerChunk: 4 },
  { maxIDM: Infinity, notesPerChunk: 5 },
]

// ── Allowed hearings per IDM range (Cornelius & Brown, 2020) ─────────────────
// Each entry: [maxIDM (exclusive upper bound), H]
// Read as: IDM < 3 → H=6, IDM 3–5 → H=3, IDM 6–8 → H=2, IDM > 8 → H=1
export const HEARINGS_TABLE = [
  { maxIDM: 3, H: 6 },
  { maxIDM: 5, H: 3 },
  { maxIDM: 8, H: 2 },
  { maxIDM: Infinity, H: 1 },
]

// ── Tonal context playback ────────────────────────────────────────────────────

export const TONAL_CONTEXT_TEMPO = 72   // BPM for scale + triad

// ── SRS parameters ───────────────────────────────────────────────────────────

// Half-Life Regression initial weights [w_plus, w_minus, w_n] (Settles & Meeder, 2016)
export const HLR_WEIGHTS_INIT = [0.5, -0.3, 0.1]

// MEMORIZE balance parameter (Tabibian et al., 2019)
export const MEMORIZE_Q = 0.5

// Recall probability threshold below which to schedule a review (Settles & Meeder, 2016)
export const SRS_RECALL_THRESHOLD = 0.5

// Maximum new intervals introduced per session (Reddy et al., 2016)
export const SRS_MAX_NEW_PER_SESSION = 2

// Leitner box review frequencies (sessions between reviews)
export const LEITNER_BOX_FREQUENCY = {
  1: 1,
  2: 2,
  3: 4,
  4: 8,
  5: 16,
}

// ── Interval introduction order (spec section 4.3) ───────────────────────────
// Ordered by difficulty group, ascending before descending within each group.
// Harmonic direction is not used in this prototype.

export const INTERVAL_INTRODUCTION_ORDER = [
  // Group 1 — Low difficulty, ascending first
  { interval: 'M2', direction: 'ascending'  },
  { interval: 'm2', direction: 'ascending'  },
  { interval: 'P5', direction: 'ascending'  },
  { interval: 'P4', direction: 'ascending'  },
  { interval: 'P8', direction: 'ascending'  },
  // Group 1 — Low difficulty, descending
  { interval: 'M2', direction: 'descending' },
  { interval: 'm2', direction: 'descending' },
  { interval: 'P5', direction: 'descending' },
  { interval: 'P4', direction: 'descending' },
  { interval: 'P8', direction: 'descending' },
  // Group 2 — Medium difficulty
  { interval: 'M3', direction: 'ascending'  },
  { interval: 'm3', direction: 'ascending'  },
  { interval: 'M3', direction: 'descending' },
  { interval: 'm3', direction: 'descending' },
  // Group 3 — High difficulty
  { interval: 'TT', direction: 'ascending'  },
  { interval: 'M7', direction: 'ascending'  },
  { interval: 'm7', direction: 'ascending'  },
  { interval: 'TT', direction: 'descending' },
  { interval: 'M7', direction: 'descending' },
  { interval: 'm7', direction: 'descending' },
  // Group 4 — Very high difficulty
  { interval: 'M6', direction: 'ascending'  },
  { interval: 'M6', direction: 'descending' },
  { interval: 'm6', direction: 'ascending'  },
  { interval: 'm6', direction: 'descending' },
]

// ── IDM progression ranges (spec section 5) ──────────────────────────────────
// Defines exact generation constraints per IDM range.
// chunksN and notesPerChunk may be a single number or an array of two options.

export const IDM_PROGRESSION = [
  {
    range: [1.0, 1.5],
    allowedIntervals:   ['M2', 'm2'],
    allowedDirections:  ['ascending'],
    maxSnorm: 0.2, maxC: 0.0, maxX: 0.0,
    chunksN: 2, notesPerChunk: 2,
  },
  {
    range: [1.5, 2.0],
    allowedIntervals:   ['M2', 'm2', 'P5'],
    allowedDirections:  ['ascending'],
    maxSnorm: 0.3, maxC: 0.0, maxX: 0.0,
    chunksN: 2, notesPerChunk: 2,
  },
  {
    range: [2.0, 2.5],
    allowedIntervals:   ['M2', 'm2', 'P5', 'P4', 'P8'],
    allowedDirections:  ['ascending'],
    maxSnorm: 0.4, maxC: 0.0, maxX: 0.0,
    chunksN: 2, notesPerChunk: 2,
  },
  {
    range: [2.5, 3.0],
    allowedIntervals:   ['M2', 'm2', 'P5', 'P4', 'P8'],
    allowedDirections:  ['ascending', 'descending'],
    maxSnorm: 0.4, maxC: 0.0, maxX: 0.0,
    chunksN: [2, 3], notesPerChunk: 2,
  },
  {
    range: [3.0, 4.0],
    allowedIntervals:   ['M2', 'm2', 'P5', 'P4', 'P8'],
    allowedDirections:  ['ascending', 'descending'],
    maxSnorm: 0.5, maxC: 0.25, maxX: 0.0,
    chunksN: 3, notesPerChunk: 2,
  },
  {
    range: [4.0, 5.0],
    allowedIntervals:   ['M2', 'm2', 'P5', 'P4', 'P8', 'M3'],
    allowedDirections:  ['ascending', 'descending'],
    maxSnorm: 0.6, maxC: 0.5, maxX: 0.0,
    chunksN: 3, notesPerChunk: 3,
  },
  {
    range: [5.0, 6.0],
    allowedIntervals:   ['M2', 'm2', 'P5', 'P4', 'P8', 'M3', 'm3'],
    allowedDirections:  ['ascending', 'descending'],
    maxSnorm: 0.7, maxC: 0.5, maxX: 0.0,
    chunksN: [3, 4], notesPerChunk: 3,
  },
  {
    range: [6.0, 8.0],
    allowedIntervals:   ['M2', 'm2', 'P5', 'P4', 'P8', 'M3', 'm3', 'TT', 'M7', 'm7'],
    allowedDirections:  ['ascending', 'descending'],
    maxSnorm: 0.8, maxC: 0.75, maxX: 0.4,
    chunksN: 4, notesPerChunk: [3, 4],
  },
  {
    range: [8.0, 10.0],
    allowedIntervals:   ['M2', 'm2', 'P5', 'P4', 'P8', 'M3', 'm3', 'TT', 'M7', 'm7', 'M6'],
    allowedDirections:  ['ascending', 'descending'],
    maxSnorm: 0.9, maxC: 1.0, maxX: 0.7,
    chunksN: [4, 5], notesPerChunk: 4,
  },
  {
    range: [10.0, 12.0],
    allowedIntervals:   ['M2', 'm2', 'P5', 'P4', 'P8', 'M3', 'm3', 'TT', 'M7', 'm7', 'M6', 'm6'],
    allowedDirections:  ['ascending', 'descending'],
    maxSnorm: 1.0, maxC: 1.0, maxX: 1.0,
    chunksN: 5, notesPerChunk: [4, 5],
  },
]

// ── SRS unlock thresholds (spec section 6) ────────────────────────────────────
// Each interval is locked until the user's current IDM reaches minIDM.
// Max 2 new intervals introduced per session.

export const SRS_UNLOCK_THRESHOLDS = [
  { interval: 'M2', direction: 'ascending',  minIDM: 1.0 },
  { interval: 'm2', direction: 'ascending',  minIDM: 1.1 },
  { interval: 'P5', direction: 'ascending',  minIDM: 1.3 },
  { interval: 'P4', direction: 'ascending',  minIDM: 1.5 },
  { interval: 'P8', direction: 'ascending',  minIDM: 1.7 },
  { interval: 'M2', direction: 'descending', minIDM: 2.0 },
  { interval: 'm2', direction: 'descending', minIDM: 2.1 },
  { interval: 'P5', direction: 'descending', minIDM: 2.3 },
  { interval: 'P4', direction: 'descending', minIDM: 2.5 },
  { interval: 'P8', direction: 'descending', minIDM: 2.7 },
  { interval: 'M3', direction: 'ascending',  minIDM: 3.5 },
  { interval: 'm3', direction: 'ascending',  minIDM: 3.8 },
  { interval: 'M3', direction: 'descending', minIDM: 4.5 },
  { interval: 'm3', direction: 'descending', minIDM: 4.8 },
  { interval: 'TT', direction: 'ascending',  minIDM: 6.0 },
  { interval: 'M7', direction: 'ascending',  minIDM: 6.3 },
  { interval: 'm7', direction: 'ascending',  minIDM: 6.6 },
  { interval: 'TT', direction: 'descending', minIDM: 7.0 },
  { interval: 'M7', direction: 'descending', minIDM: 7.3 },
  { interval: 'm7', direction: 'descending', minIDM: 7.6 },
  { interval: 'M6', direction: 'ascending',  minIDM: 8.0 },
  { interval: 'M6', direction: 'descending', minIDM: 8.5 },
  { interval: 'm6', direction: 'ascending',  minIDM: 9.5 },
  { interval: 'm6', direction: 'descending', minIDM: 10.0 },
]

// ── Color feedback (spec section 11) ─────────────────────────────────────────

export const COLORS = {
  CORRECT: '#22c55e',
  WRONG:   '#ef4444',
  NEUTRAL: '#6b7280',
}

// ── Session timing (spec section 11) ─────────────────────────────────────────

export const SESSION = {
  SOFT_LIMIT_MINUTES: 20,   // show gentle reminder, do not force end
}

// ── Piano keyboard range ──────────────────────────────────────────────────────

export const KEYBOARD = {
  LOW:          'C3',   // default active range
  HIGH:         'B4',
  DISPLAY_LOW:  'C1',   // full 6-octave visual range
  DISPLAY_HIGH: 'B6',
}
