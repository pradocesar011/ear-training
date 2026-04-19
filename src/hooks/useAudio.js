/**
 * useAudio — Tone.js Salamander piano sampler.
 *
 * Exposes:
 *   playNote(note, duration?)   — play a single note immediately
 *   playSequence(notes, tempo)  — play an array of note strings at BPM
 *   playScale(notes, tempo)     — alias for playSequence (tonal context)
 *   stopAll()                   — cancel any scheduled notes
 *   ready                       — boolean, true once sampler is loaded
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import * as Tone from 'tone'

export function useAudio() {
  const samplerRef  = useRef(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const sampler = new Tone.Sampler({
      urls: {
        C4:   'C4.mp3',
        'D#4': 'Ds4.mp3',
        'F#4': 'Fs4.mp3',
        A4:   'A4.mp3',
      },
      baseUrl:  'https://tonejs.github.io/audio/salamander/',
      onload:   () => setReady(true),
      onerror:  (e) => console.error('Sampler load error:', e),
    }).toDestination()

    samplerRef.current = sampler

    return () => {
      sampler.dispose()
    }
  }, [])

  const ensureStarted = useCallback(async () => {
    if (Tone.getContext().state !== 'running') {
      await Tone.start()
    }
  }, [])

  const playNote = useCallback(async (note, duration = '4n') => {
    await ensureStarted()
    if (!samplerRef.current || !ready) return
    samplerRef.current.triggerAttackRelease(note, duration, Tone.now())
  }, [ready, ensureStarted])

  /**
   * Play a sequence of notes at the given tempo (BPM).
   *
   * When chunkSize > 1 and silenceBeats > 0, a half-beat pause is inserted
   * between each group of chunkSize notes.
   *
   * Returns total playback duration in seconds.
   */
  const playSequence = useCallback(async (notes, tempo, chunkSize = 0, silenceBeats = 0) => {
    await ensureStarted()
    if (!samplerRef.current || !ready) return

    const secondsPerBeat = 60 / tempo
    const now = Tone.now()

    if (chunkSize > 1 && silenceBeats > 0) {
      // Schedule notes with inter-chunk silence
      notes.forEach((note, i) => {
        const chunkIdx = Math.floor(i / chunkSize)
        const t = now + (i + chunkIdx * silenceBeats) * secondsPerBeat
        samplerRef.current.triggerAttackRelease(note, '4n', t)
      })
      const numChunks = Math.ceil(notes.length / chunkSize)
      return (notes.length + (numChunks - 1) * silenceBeats) * secondsPerBeat
    } else {
      // Play continuously
      notes.forEach((note, i) => {
        samplerRef.current.triggerAttackRelease(note, '4n', now + i * secondsPerBeat)
      })
      return notes.length * secondsPerBeat
    }
  }, [ready, ensureStarted])

  const playTriad = useCallback(async (notes) => {
    await ensureStarted()
    if (!samplerRef.current || !ready) return
    const now = Tone.now()
    // Play all notes simultaneously
    notes.forEach(note => {
      samplerRef.current.triggerAttackRelease(note, '2n', now)
    })
    return Tone.Time('2n').toSeconds()
  }, [ready, ensureStarted])

  const stopAll = useCallback(() => {
    if (samplerRef.current) {
      try { samplerRef.current.releaseAll() } catch {}
    }
    Tone.getTransport().stop()
    Tone.getTransport().cancel()
  }, [])

  return { playNote, playSequence, playTriad, stopAll, ready }
}
