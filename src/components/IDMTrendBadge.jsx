import { useTranslation } from 'react-i18next'

/**
 * Shows ↑ / → / ↓ only — numeric IDM value is NEVER displayed.
 */
export default function IDMTrendBadge({ trend }) {
  const { t } = useTranslation()

  const config = {
    up:     { icon: '↑', color: 'text-green-400',  label: t('result.trend_up') },
    stable: { icon: '→', color: 'text-slate-400',  label: t('result.trend_stable') },
    down:   { icon: '↓', color: 'text-orange-400', label: t('result.trend_down') },
  }

  const { icon, color, label } = config[trend] ?? config.stable

  return (
    <div className={`flex items-center gap-1.5 ${color}`}>
      <span className="text-xl font-bold">{icon}</span>
      <span className="text-sm">{label}</span>
    </div>
  )
}
