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

import { useEffect, useRef, useCallback, useState } from 'react'
import { noteLabel } from '../lib/utils.js'
import { COLORS } from '../config/constants.js'

const WHITE_KEY_W = 36
const WHITE_KEY_H = 120
const BLACK_KEY_W = 22
const BLACK_KEY_H = 74
const OCTAVE_W    = 7 * WHITE_KEY_W   // 252px
const TOTAL_W     = 6 * OCTAVE_W      // 1512px

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
  if (!active) return null
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
  const pressedRef       = useRef(new Set())
  const containerRef     = useRef(null)
  const trackRef         = useRef(null)
  const lastTouchTimeRef = useRef(0)
  const [scrollLeft,     setScrollLeft]     = useState(0)
  const [containerWidth, setContainerWidth] = useState(0)

  // Track container width for scrollbar thumb sizing
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setContainerWidth(el.clientWidth))
    ro.observe(el)
    setContainerWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  // Sync scrollLeft state from container scroll events
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onScroll = () => setScrollLeft(el.scrollLeft)
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  // Scroll to center the active octaves on mount / when activeOctaves changes
  useEffect(() => {
    if (!containerRef.current || !activeOctaves.length) return
    const minOct = Math.min(...activeOctaves)
    const maxOct = Math.max(...activeOctaves)
    const leftPx = (minOct - 1) * OCTAVE_W
    const rightPx = maxOct * OCTAVE_W
    const center = (leftPx + rightPx) / 2
    const cw = containerRef.current.clientWidth
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
    if (e?.type === 'touchstart') {
      lastTouchTimeRef.current = Date.now()
    } else if (e?.type === 'mousedown') {
      // Suppress the synthetic mousedown the browser fires ~300ms after touchstart
      if (Date.now() - lastTouchTimeRef.current < 500) return
    }
    if (!disabled && activeOctaves.includes(octave)) onNote?.(note)
  }, [disabled, onNote, activeOctaves])

  // ── Scrollbar thumb drag ──────────────────────────────────────────────────
  const maxScroll     = Math.max(0, TOTAL_W - containerWidth)
  const thumbWidthPct = containerWidth > 0 ? Math.min(100, (containerWidth / TOTAL_W) * 100) : 100
  const thumbLeftPct  = maxScroll > 0 ? (scrollLeft / maxScroll) * (100 - thumbWidthPct) : 0

  function onThumbPointerDown(e) {
    e.preventDefault()
    const startX = e.clientX
    const startScrollLeft = containerRef.current.scrollLeft
    const trackWidth = trackRef.current?.clientWidth ?? 1
    const thumbWidthPx = (containerWidth / TOTAL_W) * trackWidth
    const maxThumbLeft = trackWidth - thumbWidthPx

    function onMove(e2) {
      const dx = e2.clientX - startX
      const ratio = maxThumbLeft > 0 ? dx / maxThumbLeft : 0
      containerRef.current.scrollLeft = Math.max(0, Math.min(maxScroll, startScrollLeft + ratio * maxScroll))
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // Click on track (outside thumb) — jump to that position
  function onTrackPointerDown(e) {
    if (e.target !== trackRef.current) return  // only the track itself, not thumb
    const rect = trackRef.current.getBoundingClientRect()
    const clickPct = (e.clientX - rect.left) / rect.width
    containerRef.current.scrollLeft = clickPct * maxScroll
  }

  return (
    <div className="w-full flex flex-col gap-2">
      {/* ── Custom scrollbar ───────────────────────────────────────────────── */}
      <div
        ref={trackRef}
        onPointerDown={onTrackPointerDown}
        style={{
          position:     'relative',
          width:        '100%',
          height:       20,
          background:   '#27272a',
          borderRadius: 10,
          cursor:       'pointer',
          userSelect:   'none',
        }}
      >
        <div
          onPointerDown={onThumbPointerDown}
          style={{
            position:     'absolute',
            top:          2,
            bottom:       2,
            left:         `${thumbLeftPct}%`,
            width:        `${thumbWidthPct}%`,
            background:   '#52525b',
            borderRadius: 8,
            cursor:       'grab',
            touchAction:  'none',
            transition:   'background 0.1s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#71717a' }}
          onMouseLeave={e => { e.currentTarget.style.background = '#52525b' }}
        />
      </div>

      {/* ── Piano keys ────────────────────────────────────────────────────── */}
      <div
        ref={containerRef}
        className="overflow-x-auto w-full"
        style={{ scrollBehavior: 'smooth' }}
      >
        <div
          className="flex"
          style={{ width: TOTAL_W, height: WHITE_KEY_H }}
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
    </div>
  )
}
