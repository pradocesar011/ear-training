import { useTranslation } from 'react-i18next'
import PrecisionChart from '../components/PrecisionChart.jsx'
import { formatDuration, formatPrecision } from '../lib/utils.js'

export default function SessionSummaryScreen({ summary, userCode, onNewSession }) {
  const { t } = useTranslation()
  const { duration, exercises, meanPrecision, idmStart, idmEnd, history } = summary

  const statItems = [
    { label: t('session.duration'),            value: formatDuration(duration) },
    { label: t('session.exercises_completed'), value: exercises },
    { label: t('session.mean_precision'),      value: formatPrecision(meanPrecision) },
  ]

  return (
    <div className="flex flex-col items-center justify-start min-h-screen px-4 py-10 gap-8">
      <h2 className="text-2xl font-bold text-white" style={{ paddingTop: '20px' }}>{t('session.summary_heading')}</h2>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-4 w-full max-w-xl">
        {statItems.map(({ label, value }) => (
          <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center" style={{ padding: '10px' }}>
            <div className="text-2xl font-bold text-white font-mono">{value}</div>
            <div className="text-zinc-400 text-xs mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Precision chart */}
      {history.length > 1 && (
        <div className="w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-xl p-5" style={{ padding: '10px' }}>
          <h3 className="text-zinc-400 text-sm mb-4" style={{ paddingBottom: '10px' }}>{t('session.precision_evolution')}</h3>
          <PrecisionChart history={history} />
        </div>
      )}

      {/* User code — prominent */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center w-full max-w-xs" style={{ padding: '20px' }}>
        <p className="text-zinc-400 text-xs uppercase tracking-widest mb-2" style={{ paddingBottom: '5px' }}>
          {t('common.your_code')}
        </p>
        <div className="font-mono text-3xl font-bold text-cyan-400 tracking-widest">
          {userCode}
        </div>
        <p className="text-zinc-500 text-xs mt-2">{t('common.save_code')}</p>
      </div>

      {/* New session */}
      <button
        onClick={onNewSession}
        className="px-10 py-4 bg-cyan-600 text-white text-lg font-semibold rounded-xl
          hover:bg-cyan-500 transition-colors shadow-lg shadow-indigo-900/30" style={{ padding: '20px' }}
      >
        {t('common.new_session')}
      </button>
    </div>
  )
}
