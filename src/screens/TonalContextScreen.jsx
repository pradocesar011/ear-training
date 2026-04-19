import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getMajorScaleNotes, getTonicTriad } from '../engines/sequenceGenerator.js'
import { TONAL_CONTEXT_TEMPO } from '../config/constants.js'

export default function TonalContextScreen({ tonic, audio, onReady }) {
  const { t } = useTranslation()
  const [status, setStatus] = useState('idle')   // idle | playing_scale | playing_triad | done

  // Auto-play on mount
  useEffect(() => {
    if (audio.ready) playContext()
  }, [audio.ready, tonic])

  async function playContext() {
    setStatus('playing_scale')
    const { all: scaleNotes } = getMajorScaleNotes(tonic)
    const scaleDuration = await audio.playSequence(scaleNotes, TONAL_CONTEXT_TEMPO)

    await delay((scaleDuration ?? scaleNotes.length * (60 / TONAL_CONTEXT_TEMPO)) * 1000 + 500)

    setStatus('playing_triad')
    const triad = getTonicTriad(tonic)
    const triadDuration = await audio.playTriad(triad)

    await delay((triadDuration ?? 1) * 1000 + 300)
    setStatus('done')
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  const statusLabel = {
    idle:          '',
    playing_scale: t('tonal_context.playing_scale'),
    playing_triad: t('tonal_context.playing_triad'),
    done:          '',
  }[status]

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 gap-8">
      <div className="text-center">
        <p className="text-zinc-400 text-sm font-medium uppercase tracking-widest mb-2">
          {t('tonal_context.heading')}
        </p>
        <h2 className="text-3xl sm:text-4xl font-bold text-white">
          {t('tonal_context.tonality', { tonic })}
        </h2>
        <p className="text-zinc-400 mt-3 text-sm">
          {t('tonal_context.instruction')}
        </p>
      </div>

      {/* Playback indicator */}
      <div className="h-8 flex items-center gap-2">
        {status === 'playing_scale' || status === 'playing_triad' ? (
          <>
            <div className="flex gap-1">
              {[0,1,2].map(i => (
                <div
                  key={i}
                  className="w-1.5 h-6 bg-cyan-400 rounded-full animate-pulse"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </div>
            <span className="text-cyan-300 text-sm">{statusLabel}</span>
          </>
        ) : null}
      </div>

      {/* Replay button */}
      <button
        onClick={playContext}
        disabled={status === 'playing_scale' || status === 'playing_triad'}
        className="px-6 py-2 bg-zinc-800 text-zinc-300 rounded-lg text-sm
          hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {t('common.play')}
      </button>

      {/* Ready button — always visible so user can skip if needed */}
      <button
        onClick={onReady}
        className="px-10 py-4 bg-cyan-600 text-white text-lg font-semibold rounded-xl
          hover:bg-cyan-500 transition-colors shadow-lg shadow-indigo-900/30"
      >
        {t('common.ready')}
      </button>
    </div>
  )
}
