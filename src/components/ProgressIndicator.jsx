import { useTranslation } from 'react-i18next'

export default function ProgressIndicator({ current, total }) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-slate-400 text-sm">
        {t('exercise.note_progress', { current: current + 1, total })}
      </span>
      <div className="flex gap-1.5">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={`w-2.5 h-2.5 rounded-full transition-colors ${
              i < current  ? 'bg-green-500' :
              i === current ? 'bg-indigo-400 animate-pulse' :
              'bg-slate-600'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
