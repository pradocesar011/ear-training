/**
 * General utilities — no React, no audio dependencies.
 */

// ── User code generation ──────────────────────────────────────────────────────

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'  // no I, O, 0, 1 to avoid confusion

export function generateUserCode(length = 6) {
  return Array.from({ length }, () =>
    CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  ).join('')
}

// ── localStorage helpers ──────────────────────────────────────────────────────

const LS_KEY            = 'ear_training_user_code'
const LS_IDM_KEY        = 'ear_training_current_idm'
const LS_LANG_KEY       = 'ear_training_language'
const LS_TONAL_MODE_KEY = 'ear_training_tonal_mode'

export const TONAL_MODES = {
  SCALE_AND_CHORDS: 'scale_and_chords',
  SCALE_ONLY:       'scale_only',
  CHORDS_ONLY:      'chords_only',
}

export function getStoredTonalMode() {
  try { return localStorage.getItem(LS_TONAL_MODE_KEY) ?? TONAL_MODES.CHORDS_ONLY } catch { return TONAL_MODES.CHORDS_ONLY }
}
export function storeTonalMode(mode) {
  try { localStorage.setItem(LS_TONAL_MODE_KEY, mode) } catch {}
}

const LS_EXTRA_HEARINGS_KEY = 'ear_extra_hearings'
export function getStoredExtraHearings() {
  try { return Math.max(0, parseInt(localStorage.getItem(LS_EXTRA_HEARINGS_KEY) ?? '0')) } catch { return 0 }
}
export function storeExtraHearings(n) {
  try { localStorage.setItem(LS_EXTRA_HEARINGS_KEY, String(Math.max(0, n))) } catch {}
}

const LS_CHEAT_MODE_KEY     = 'ear_cheat_mode'
export function getStoredCheatMode() {
  try { return localStorage.getItem(LS_CHEAT_MODE_KEY) === 'true' } catch { return false }
}
export function storeCheatMode(enabled) {
  try { localStorage.setItem(LS_CHEAT_MODE_KEY, String(enabled)) } catch {}
}

const LS_ACTIVE_OCTAVES_KEY = 'ear_active_octaves'
export function getStoredActiveOctaves() {
  try {
    const s = localStorage.getItem(LS_ACTIVE_OCTAVES_KEY)
    if (s) return JSON.parse(s)
  } catch {}
  return [3, 4]
}
export function storeActiveOctaves(octaves) {
  try { localStorage.setItem(LS_ACTIVE_OCTAVES_KEY, JSON.stringify(octaves)) } catch {}
}

export function getStoredCode() {
  try { return localStorage.getItem(LS_KEY) } catch { return null }
}

export function storeCode(code) {
  try { localStorage.setItem(LS_KEY, code) } catch {}
}

export function clearStoredCode() {
  try { localStorage.removeItem(LS_KEY) } catch {}
}

export function getStoredIDM() {
  try {
    const v = localStorage.getItem(LS_IDM_KEY)
    return v ? parseFloat(v) : null
  } catch { return null }
}

export function storeIDM(idm) {
  try { localStorage.setItem(LS_IDM_KEY, String(idm)) } catch {}
}

export function getStoredLanguage() {
  try { return localStorage.getItem(LS_LANG_KEY) } catch { return null }
}

export function storeLanguage(lang) {
  try { localStorage.setItem(LS_LANG_KEY, lang) } catch {}
}

// ── Formatting ────────────────────────────────────────────────────────────────

export function formatDuration(seconds) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function formatPrecision(value) {
  return `${Math.round(value * 100)}%`
}

// ── Note display helpers ──────────────────────────────────────────────────────

// Map from English note names to solfège (for Spanish locale)
export const SOLFEGE_MAP = {
  'C': 'Do', 'C#': 'Do#', 'Db': 'Reb',
  'D': 'Re', 'D#': 'Re#', 'Eb': 'Mib',
  'E': 'Mi',
  'F': 'Fa', 'F#': 'Fa#', 'Gb': 'Solb',
  'G': 'Sol', 'G#': 'Sol#', 'Ab': 'Lab',
  'A': 'La', 'A#': 'La#', 'Bb': 'Sib',
  'B': 'Si',
}

/**
 * Get display label for a note name based on locale.
 * noteBase: e.g. 'C', 'C#', 'Bb'
 * locale: 'es' | 'en'
 */
export function noteLabel(noteBase, locale) {
  if (locale === 'es') return SOLFEGE_MAP[noteBase] ?? noteBase
  return noteBase
}

/**
 * Strip octave from a note string: 'C#4' → 'C#'
 */
export function noteBase(noteStr) {
  return noteStr.replace(/\d$/, '')
}

// ── CSV export ────────────────────────────────────────────────────────────────

export function objectsToCSV(rows) {
  if (!rows.length) return ''
  const headers = Object.keys(rows[0])
  const lines = [
    headers.join(','),
    ...rows.map(row =>
      headers.map(h => {
        const v = row[h]
        if (v === null || v === undefined) return ''
        const str = typeof v === 'object' ? JSON.stringify(v) : String(v)
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"` : str
      }).join(',')
    ),
  ]
  return lines.join('\n')
}

export function downloadCSV(filename, csvString) {
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href     = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
