/**
 * PianoKeyboard — virtual piano showing octaves 1–6 (C1–B6).
 *
 * Active octaves are interactive; others are rendered greyed-out.
 *
 * White keys: 36px wide, 120px tall
 * Black keys: 22px wide, 74px tall, absolutely positioned
 *
 * Props:
 *   onNote(note: string)          — called when an active key is pressed
 *   highlightCorrect: string[]    — highlight green
 *   highlightWrong: string[]      — highlight red
 *   highlightTonic: string[]      — highlight indigo (tonic reference)
 *   activeOctaves: number[]       — which octaves respond to input (default [3,4])
 *   disabled: boolean             — lock all keys
 *   language: 'es' | 'en'
 */

import { useEffect, useRef, useCallback } from 'react'
import { noteLabel } from '../lib/utils.js'
import { COLORS } from '../config/constants.js'

const WHITE_KEY_W = 36
const WHITE_KEY_H = 120
const BLACK_KEY_W = 22
const BLACK_KEY_H = 74
const OCTAVE_W    = 7 * WHITE_KEY_W   // 252px

// Black key left offsets within one octave (from the octave's left edge).
// White key centers: C=18, D=54, E=90, F=126, G=162, A=198, B=234
const BLACK_OFFSETS = {
  'C#': Math.round((18 + 54)  / 2) - Math.floor(BLACK_KEY_W / 2),   // 25
  'D#': Math.round((54 + 90)  / 2) - Math.floor(BLACK_KEY_W / 2),   // 61
  'F#': Math.round((126 + 162) / 2) - Math.floor(BLACK_KEY_W / 2),  // 133
  'G#': Math.round((162 + 198) / 2) - Math.floor(BLACK_KEY_W / 2),  // 169
  'A#': Math.round((198 + 234) / 2) - Math.floor(BLACK_KEY_W / 2),  // 205
}

const ALL_OCTAVES   = [1, 2, 3, 4, 5, 6]
const WHITE_NOTES   = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
const BLACK_NOTES   = ['C#', 'D#', 'F#', 'G#', 'A#']

// Computer keyboard mapping — always covers octaves 3–4
const KEY_MAP = {
  'a': 'C3',  'w': 'C#3', 's': 'D3',  'e': 'D#3', 'd': 'E3',
  'f': 'F3',  't': 'F#3', 'g': 'G3',  'y': 'G#3', 'h': 'A3',
  'u': 'A#3', 'j': 'B3',
  'k': 'C4',  'o': 'C#4', 'l': 'D4',  'p': 'D#4', ';': 'E4',
}

function keyColor(noteStr, highlightCorrect, highlightWrong, highlightTonic, active) {
  if (!active) return null   // disabled octave — handled separately
  if (highlightCorrect?.includes(noteStr)) return COLORS.CORRECT
  if (highlightWrong?.includes(noteStr))   return COLORS.WRONG
  if (highlightTonic?.includes(noteStr))   return '#6366f1'
  return null
}

export default function PianoKeyboard({
  onNote,
  highlightCorrect = [],
  highlightWrong   = [],
  highlightTonic   = [],
  activeOctaves    = [3, 4],
  disabled         = false,
  language         = 'es',
}) {
  const pressedRef   = useRef(new Set())
  const containerRef = useRef(null)

  // Scroll to center the active octaves on mount / when activeOctaves changes
  useEffect(() => {
    if (!containerRef.current || !activeOctaves.length) return
    const minOct    = Math.min(...activeOctaves)
    const maxOct    = Math.max(...activeOctaves)
    // Octave n starts at (n - 1) * OCTAVE_W in our 1-indexed layout
    const leftPx    = (minOct - 1) * OCTAVE_W
    const rightPx   = maxOct * OCTAVE_W
    const center    = (leftPx + rightPx) / 2
    const cw        = containerRef.current.clientWidth
    containerRef.current.scrollLeft = Math.max(0, center - cw / 2)
  }, [activeOctaves.join(',')])

  // Computer keyboard events — only fire for active octaves
  useEffect(() => {
    function onKeyDown(e) {
      if (disabled || pressedRef.current.has(e.key)) return
      const note = KEY_MAP[e.key.toLowerCase()]
      if (note) {
        const octave = parseInt(note.slice(-1))
        if (!activeOctaves.includes(octave)) return
        pressedRef.current.add(e.key)
        onNote?.(note)
      }
    }
    function onKeyUp(e) { pressedRef.current.delete(e.key) }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup',   onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup',   onKeyUp)
    }
  }, [disabled, onNote, activeOctaves])

  const handlePress = useCallback((note, octave, e) => {
    e?.preventDefault()
    e?.stopPropagation()
    if (!disabled && activeOctaves.includes(octave)) onNote?.(note)
  }, [disabled, onNote, activeOctaves])

  return (
    <div
      ref={containerRef}
      className="overflow-x-auto w-full"
      style={{ scrollBehavior: 'smooth' }}
    >
      <div
        className="flex"
        style={{ width: ALL_OCTAVES.length * OCTAVE_W, height: WHITE_KEY_H }}
      >
        {ALL_OCTAVES.map(octave => {
          const isActive = activeOctaves.includes(octave)

          return (
            <div
              key={octave}
              className="relative flex-shrink-0"
              style={{
                width: OCTAVE_W,
                height: WHITE_KEY_H,
                opacity: isActive ? 1 : 0.35,
              }}
            >
              {/* White keys */}
              {WHITE_NOTES.map((name, i) => {
                const noteStr = `${name}${octave}`
                const color   = keyColor(noteStr, highlightCorrect, highlightWrong, highlightTonic, isActive)
                const bgColor = color ?? (isActive ? '#e2e8f0' : '#94a3b8')
                const txtColor = color ? '#fff' : (isActive ? '#27272a' : '#71717a')
                const canPress = isActive && !disabled

                return (
                  <div
                    key={noteStr}
                    onMouseDown={e => handlePress(noteStr, octave, e)}
                    onTouchStart={e => handlePress(noteStr, octave, e)}
                    style={{
                      position:        'absolute',
                      left:            i * WHITE_KEY_W,
                      top:             0,
                      width:           WHITE_KEY_W,
                      height:          WHITE_KEY_H,
                      background:      bgColor,
                      border:          '1px solid #71717a',
                      borderTop:       'none',
                      borderRadius:    '0 0 5px 5px',
                      display:         'flex',
                      alignItems:      'flex-end',
                      justifyContent:  'center',
                      paddingBottom:   5,
                      cursor:          canPress ? 'pointer' : 'default',
                      userSelect:      'none',
                      touchAction:     'none',
                      zIndex:          1,
                      boxSizing:       'border-box',
                      transition:      'background 0.08s ease',
                    }}
                  >
                    <span style={{ fontSize: 9, fontWeight: 600, color: txtColor, pointerEvents: 'none' }}>
                      {isActive ? noteLabel(name, language) : ''}
                    </span>
                  </div>
                )
              })}

              {/* Black keys */}
              {BLACK_NOTES.map(name => {
                const noteStr = `${name}${octave}`
                const leftPx  = BLACK_OFFSETS[name]
                const color   = keyColor(noteStr, highlightCorrect, highlightWrong, highlightTonic, isActive)
                const bgColor = color ?? (isActive ? '#27272a' : '#3f3f46')
                const txtColor = color ? '#fff' : (isActive ? '#94a3b8' : '#71717a')
                const canPress = isActive && !disabled

                return (
                  <div
                    key={noteStr}
                    onMouseDown={e => handlePress(noteStr, octave, e)}
                    onTouchStart={e => handlePress(noteStr, octave, e)}
                    style={{
                      position:       'absolute',
                      left:           leftPx,
                      top:            0,
                      width:          BLACK_KEY_W,
                      height:         BLACK_KEY_H,
                      background:     bgColor,
                      borderRadius:   '0 0 4px 4px',
                      display:        'flex',
                      alignItems:     'flex-end',
                      justifyContent: 'center',
                      paddingBottom:  4,
                      cursor:         canPress ? 'pointer' : 'default',
                      userSelect:     'none',
                      touchAction:    'none',
                      zIndex:         2,
                      boxSizing:      'border-box',
                      transition:     'background 0.08s ease',
                    }}
                  >
                    <span style={{ fontSize: 7, color: txtColor, pointerEvents: 'none' }}>
                      {isActive ? noteLabel(name, language) : ''}
                    </span>
                  </div>
                )
              })}

              {/* Octave label at bottom of inactive octaves */}
              {!isActive && (
                <div style={{
                  position:       'absolute',
                  bottom:         6,
                  left:           0,
                  right:          0,
                  textAlign:      'center',
                  fontSize:       9,
                  color:          '#71717a',
                  pointerEvents:  'none',
                  zIndex:         3,
                }}>
                  C{octave}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
