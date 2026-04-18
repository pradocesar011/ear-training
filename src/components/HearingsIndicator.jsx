import { useTranslation } from 'react-i18next'

export default function HearingsIndicator({ used, total }) {
  const { t } = useTranslation()
  const remaining = total - used

  return (
    <div className="flex items-center gap-2">
      <span className="text-slate-400 text-sm">{t('exercise.hearings_label')}</span>
      <div className="flex gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full ${i < remaining ? 'bg-indigo-400' : 'bg-slate-600'}`}
          />
        ))}
      </div>
      <span className="text-slate-300 text-sm font-mono">{remaining} / {total}</span>
    </div>
  )
}
