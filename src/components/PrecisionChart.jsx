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
          <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
          <XAxis
            dataKey="exercise"
            stroke="#71717a"
            tick={{ fill: '#94a3b8', fontSize: 12 }}
          />
          <YAxis
            domain={[0, 100]}
            stroke="#71717a"
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            tickFormatter={v => `${v}%`}
          />
          <Tooltip
            contentStyle={{ background: '#27272a', border: '1px solid #3f3f46', borderRadius: 6 }}
            labelStyle={{ color: '#94a3b8' }}
            itemStyle={{ color: '#06b6d4' }}
            formatter={v => [`${v}%`, t('session.mean_precision')]}
          />
          <Line
            type="monotone"
            dataKey="precision"
            stroke="#06b6d4"
            strokeWidth={2}
            dot={{ fill: '#06b6d4', r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
