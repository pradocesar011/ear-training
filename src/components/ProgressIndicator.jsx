import { useTranslation } from 'react-i18next'

export default function ProgressIndicator({ current, total, chunkSize = 0 }) {
  const { t } = useTranslation()

  const dots = []
  for (let i = 0; i < total; i++) {
    // Insert grey separator before this note if it starts a new chunk (not the first)
    if (chunkSize > 0 && i > 0 && i % chunkSize === 0) {
      dots.push(
        <div
          key={`sep-${i}`}
          className="w-1.5 h-1.5 rounded-full bg-zinc-700 flex-shrink-0"
        />
      )
    }
    dots.push(
      <div
        key={i}
        className={`w-3.5 h-3.5 rounded-full transition-colors flex-shrink-0 ${
          i < current  ? 'bg-emerald-500' :
          i === current ? 'bg-cyan-400 animate-pulse' :
          'bg-zinc-800'
        }`}
      />
    )
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-zinc-400 text-sm">
        {t('exercise.note_progress', { current: current + 1, total })}
      </span>
      <div className="flex items-center gap-1.5 flex-wrap justify-center">
        {dots}
      </div>
    </div>
  )
}
