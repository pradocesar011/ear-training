import { useTranslation } from 'react-i18next'
import IDMTrendBadge from '../components/IDMTrendBadge.jsx'
import PianoKeyboard from '../components/PianoKeyboard.jsx'
import { formatPrecision } from '../lib/utils.js'
import { COLORS } from '../config/constants.js'

export default function ResultScreen({ result, isLastExercise, onNext, onEnd }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language?.slice(0, 2) ?? 'es'

  const { precision, correct, userSequence, expectedSequence, trend } = result

  // Build highlight arrays
  const correctHighlight = []
  const wrongHighlight   = []

  expectedSequence.forEach((note, i) => {
    if (correct[i]) {
      correctHighlight.push(note)
    } else {
      wrongHighlight.push(note)
      if (userSequence[i] && userSequence[i] !== note) {
        wrongHighlight.push(userSequence[i])
      }
    }
  })

  const precisionPct = Math.round(precision * 100)
  const precisionColor =
    precisionPct >= 80 ? '#22c55e' :
    precisionPct >= 51 ? '#f59e0b' :
    '#ef4444'

  return (
    <div className="screen-enter flex flex-col items-center justify-start min-h-screen px-4 py-8 gap-6">
      <h2 className="text-slate-400 text-sm font-medium uppercase tracking-widest">
        {t('result.heading')}
      </h2>

      {/* Precision */}
      <div className="text-center">
        <div
          className="text-6xl font-bold font-mono"
          style={{ color: precisionColor }}
        >
          {formatPrecision(precision)}
        </div>
        <div className="text-slate-400 text-sm mt-1">{t('result.precision')}</div>
      </div>

      {/* Trend badge */}
      <IDMTrendBadge trend={trend} />

      {/* Keyboard visualization */}
      <div className="w-full max-w-2xl">
        <p className="text-slate-400 text-xs mb-3 text-center">{t('result.correct_answer')}</p>
        <PianoKeyboard
          onNote={() => {}}
          highlightCorrect={correctHighlight}
          highlightWrong={wrongHighlight}
          disabled={true}
          language={lang}
        />
      </div>

      {/* Note-by-note comparison */}
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-1.5">
          {expectedSequence.map((note, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-2 bg-slate-800 rounded-lg" style={{ padding: '10px' }}>
              <span className="text-slate-400 text-sm w-6">{i + 1}</span>
              <span className="text-slate-300 text-sm font-mono flex-1 text-center">{note}</span>
              <span
                className="text-sm font-mono flex-1 text-center"
                style={{ color: correct[i] ? COLORS.CORRECT : COLORS.WRONG }}
              >
                {userSequence[i] ?? '—'}
              </span>
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: correct[i] ? COLORS.CORRECT : COLORS.WRONG }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
        {!isLastExercise && (
          <button
            onClick={onNext}
            className="flex-1 py-4 px-6 bg-indigo-600 text-white rounded-xl font-semibold
              hover:bg-indigo-500 transition-colors" style={{ padding: '20px' }}
          >
            {t('common.next_exercise')}
          </button>
        )}
        <button
          onClick={onEnd}
          className="flex-1 py-4 px-6 bg-slate-700 text-slate-300 rounded-xl font-semibold
            hover:bg-slate-600 transition-colors" style={{ padding: '20px' }}
        >
          {isLastExercise ? t('session.summary_heading') : t('common.end_session')}
        </button>
      </div>
    </div>
  )
}
