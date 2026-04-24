import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { supabase } from '../lib/supabase.js'
import { useAppContext } from '../context/AppContext.jsx'
import { formatDuration, formatPrecision } from '../lib/utils.js'
import { recallProbability, estimateHalfLife } from '../engines/srs.js'

export default function ProgressScreen() {
  const { t } = useTranslation()
  const { user, session } = useAppContext()
  const currentIDM = session?.idmCurrent ?? null

  const [sessions,     setSessions]     = useState([])
  const [srsItems,     setSrsItems]     = useState([])
  const [accuracyData, setAccuracyData] = useState([])
  const [loading,      setLoading]      = useState(true)

  useEffect(() => {
    if (user.userId) fetchData()
  }, [user.userId])

  async function fetchData() {
    setLoading(true)
    const [{ data: sess }, { data: srs }] = await Promise.all([
      supabase.from('sessions')
        .select('id, started_at, ended_at, exercises_count, idm_start, idm_end')
        .eq('user_id', user.userId)
        .not('ended_at', 'is', null)
        .order('started_at'),
      supabase.from('srs_items')
        .select('interval_type, direction, leitner_box, correct_count, wrong_count, exposures, last_seen')
        .eq('user_id', user.userId),
    ])
    const sessList = sess ?? []
    setSessions(sessList)
    setSrsItems(srs ?? [])

    if (sessList.length) {
      const { data: exRows } = await supabase
        .from('exercises')
        .select('session_id, precision')
        .eq('user_id', user.userId)

      if (exRows) {
        const bySession = {}
        exRows.forEach(ex => {
          if (!bySession[ex.session_id]) bySession[ex.session_id] = []
          bySession[ex.session_id].push(ex.precision ?? 0)
        })
        setAccuracyData(sessList.map((s, i) => {
          const precs = bySession[s.id] ?? []
          const mean  = precs.length ? precs.reduce((a, b) => a + b, 0) / precs.length : null
          return { n: i + 1, accuracy: mean != null ? Math.round(mean * 100) : null }
        }))
      }
    }

    setLoading(false)
  }

  // ── Derived data ─────────────────────────────────────────────────────────

  const idmChartData = sessions.map((s, i) => ({
    n:   i + 1,
    idm: +(s.idm_end ?? 0).toFixed(2),
  }))

  const totalSessions  = sessions.length
  const totalExercises = sessions.reduce((a, s) => a + (s.exercises_count ?? 0), 0)
  const meanPrecision  = accuracyData.length
    ? accuracyData.filter(d => d.accuracy != null).reduce((a, d) => a + d.accuracy, 0) /
      (accuracyData.filter(d => d.accuracy != null).length || 1)
    : null

  // ── SRS mastery ──────────────────────────────────────────────────────────

  const now = new Date()
  const enrichedItems = srsItems.map(item => {
    const h = estimateHalfLife(item.correct_count, item.wrong_count, item.exposures)
    const lastSeen = item.last_seen ? new Date(item.last_seen) : null
    const deltaDays = lastSeen ? (now - lastSeen) / (1000 * 60 * 60 * 24) : 0
    const recall = recallProbability(deltaDays, h)
    return { ...item, recall }
  })

  const mastered    = enrichedItems.filter(it => it.leitner_box >= 4)
  const challenging = enrichedItems.filter(it => it.leitner_box < 4 && it.exposures >= 3 && it.recall < 0.5)

  // ── Session table rows ────────────────────────────────────────────────────

  const sessionRows = sessions.map((s, i) => {
    const durationSec = s.ended_at
      ? Math.floor((new Date(s.ended_at) - new Date(s.started_at)) / 1000)
      : null
    const acc = accuracyData[i]?.accuracy
    const idmProgress = (s.idm_start != null && s.idm_end != null)
      ? s.idm_end - s.idm_start
      : null
    return {
      n:           i + 1,
      date:        new Date(s.started_at).toLocaleDateString(),
      duration:    durationSec != null ? formatDuration(durationSec) : '—',
      exercises:   s.exercises_count ?? 0,
      accuracy:    acc != null ? `${acc}%` : '—',
      idmProgress,
    }
  }).reverse()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-full text-zinc-400">
        {t('common.loading')}
      </div>
    )
  }

  return (
    <div className="screen-enter flex flex-col items-center min-h-full px-4 pt-8 pb-24 gap-7">
      <h1 className="text-2xl font-bold text-white text-center w-full max-w-2xl" style={{ paddingTop: '20px' }}>{t('progress.heading')}</h1>

      <div className="w-full max-w-2xl flex flex-col gap-6">

      {/* ── Stat cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          value={currentIDM != null ? currentIDM.toFixed(1) : '—'}
          label={t('progress.current_idm')}
          color="text-cyan-400"
        />
        <StatCard
          value={totalSessions}
          label={t('profile.total_sessions')}
          color="text-zinc-100"
        />
        <StatCard
          value={totalExercises}
          label={t('profile.total_exercises')}
          color="text-zinc-100"
        />
        <StatCard
          value={meanPrecision != null ? `${Math.round(meanPrecision)}%` : '—'}
          label={t('session.mean_precision')}
          color="text-emerald-400"
        />
      </div>

      {/* ── Charts ───────────────────────────────────────────────────────── */}
      {totalSessions > 1 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Section title={t('progress.idm_chart')}>
            <Chart data={idmChartData} dataKey="idm" color="#06b6d4" />
          </Section>
          <Section title={t('progress.accuracy_chart')}>
            <Chart
              data={accuracyData.filter(d => d.accuracy != null)}
              dataKey="accuracy"
              color="#10b981"
              formatter={v => `${v}%`}
              domain={[0, 100]}
            />
          </Section>
        </div>
      )}

      {/* ── Mastered / Challenging ────────────────────────────────────────── */}
      {srsItems.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <IntervalCard
            title={t('progress.mastered')}
            items={mastered}
            color="emerald"
            emptyText={t('progress.not_started')}
            t={t}
          />
          <IntervalCard
            title={t('progress.difficult')}
            items={challenging}
            color="orange"
            emptyText="—"
            t={t}
          />
        </div>
      )}

      {/* ── Session history ───────────────────────────────────────────────── */}
      {sessionRows.length > 0 && (
        <Section title={t('progress.session_history')}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-zinc-500 text-xs border-b border-zinc-800">
                  <th className="text-left py-3 px-3 font-medium">#</th>
                  <th className="text-left py-3 px-3 font-medium">{t('progress.col_date')}</th>
                  <th className="text-left py-3 px-3 font-medium">{t('progress.col_duration')}</th>
                  <th className="text-left py-3 px-3 font-medium">{t('progress.col_exercises')}</th>
                  <th className="text-left py-3 px-3 font-medium">{t('progress.col_accuracy')}</th>
                  <th className="text-left py-3 px-3 font-medium">IDM</th>
                </tr>
              </thead>
              <tbody>
                {sessionRows.map(row => (
                  <tr key={row.n} className="border-b border-zinc-900 text-zinc-300">
                    <td className="py-3 px-3 text-zinc-500">{row.n}</td>
                    <td className="py-3 px-3">{row.date}</td>
                    <td className="py-3 px-3 font-mono">{row.duration}</td>
                    <td className="py-3 px-3">{row.exercises}</td>
                    <td className="py-3 px-3 font-mono">{row.accuracy}</td>
                    <td className="py-3 px-3 font-mono">
                      {row.idmProgress != null ? (
                        <span className={row.idmProgress > 0 ? 'text-emerald-400' : row.idmProgress < 0 ? 'text-rose-500' : 'text-zinc-500'}>
                          {row.idmProgress > 0 ? '+' : ''}{row.idmProgress.toFixed(1)}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {!totalSessions && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <p className="text-zinc-400 text-center">{t('common.no_data')}</p>
          <p className="text-zinc-500 text-sm text-center">{t('train.no_sessions_yet')}</p>
        </div>
      )}

      </div>{/* /max-w-2xl */}
      <div style={{ height: 100 }} />
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ value, label, color }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 text-center" style={{ padding: '10px' }}>
      <div className={`text-2xl font-bold font-mono ${color}`}>{value}</div>
      <div className="text-zinc-500 text-xs mt-1.5 leading-tight">{label}</div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6" style={{ padding: '10px' }}>
      <h3 className="text-zinc-400 text-xs font-medium uppercase tracking-widest mb-5" style={{ paddingBottom: '10px' }}>
        {title}
      </h3>
      {children}
    </div>
  )
}

function Chart({ data, dataKey, color, formatter, domain }) {
  return (
    <div className="h-40">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis dataKey="n" stroke="#3f3f46" tick={{ fill: '#71717a', fontSize: 11 }} />
          <YAxis
            domain={domain}
            stroke="#3f3f46"
            tick={{ fill: '#71717a', fontSize: 11 }}
            tickFormatter={formatter}
          />
          <Tooltip
            contentStyle={{ background: '#09090b', border: '1px solid #3f3f46', borderRadius: 8 }}
            labelStyle={{ color: '#71717a', fontSize: 12 }}
            itemStyle={{ color }}
            formatter={formatter ? (v) => [formatter(v), ''] : undefined}
          />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            dot={{ fill: color, r: 3 }}
            activeDot={{ r: 5 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function IntervalCard({ title, items, color, emptyText, t }) {
  const borderColor = color === 'emerald' ? 'border-emerald-800/50' : 'border-orange-800/50'
  const titleColor  = color === 'emerald' ? 'text-emerald-400' : 'text-orange-400'
  const tagBg       = color === 'emerald' ? 'bg-emerald-900/30 text-emerald-300' : 'bg-orange-900/30 text-orange-300'

  return (
    <div className={`bg-zinc-900 border ${borderColor} rounded-2xl p-5`} style={{ padding: '10px' }}>
      <h3 className={`text-xs font-medium uppercase tracking-widest mb-3 ${titleColor}`}>
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="text-zinc-500 text-sm">{emptyText}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map(item => (
            <span
              key={`${item.interval_type}-${item.direction}`}
              className={`text-xs px-2 py-1 rounded-lg font-medium ${tagBg}`}
            >
              {t(`intervals.${item.interval_type}`)}
              <span className="opacity-60 ml-1">{t(`intervals.${item.direction}`)}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
