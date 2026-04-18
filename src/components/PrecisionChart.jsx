import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useTranslation } from 'react-i18next'

/**
 * history: Array<{ precision: number, idm: number }>
 */
export default function PrecisionChart({ history }) {
  const { t } = useTranslation()

  const data = history.map((h, i) => ({
    exercise: i + 1,
    precision: Math.round(h.precision * 100),
  }))

  return (
    <div className="w-full h-48">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="exercise"
            stroke="#64748b"
            tick={{ fill: '#94a3b8', fontSize: 12 }}
          />
          <YAxis
            domain={[0, 100]}
            stroke="#64748b"
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            tickFormatter={v => `${v}%`}
          />
          <Tooltip
            contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6 }}
            labelStyle={{ color: '#94a3b8' }}
            itemStyle={{ color: '#818cf8' }}
            formatter={v => [`${v}%`, t('session.mean_precision')]}
          />
          <Line
            type="monotone"
            dataKey="precision"
            stroke="#818cf8"
            strokeWidth={2}
            dot={{ fill: '#818cf8', r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
