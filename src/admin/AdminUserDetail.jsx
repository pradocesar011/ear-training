import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { supabase } from '../lib/supabase.js'
import { formatPrecision, formatDuration, objectsToCSV, downloadCSV } from '../lib/utils.js'
import { recallProbability, estimateHalfLife } from '../engines/srs.js'
import { INTERVAL_INTRODUCTION_ORDER } from '../config/constants.js'
import { Section } from './AdminDashboard.jsx'

const PAGE_SIZE = 20

export default function AdminUserDetail() {
  const { userId } = useParams()
  const navigate   = useNavigate()

  const [user,           setUser]           = useState(null)
  const [sessions,       setSessions]       = useState([])
  const [exercises,      setExercises]      = useState([])
  const [srsItems,       setSrsItems]       = useState([])
  const [reviewAttempts, setReviewAttempts] = useState([])
  const [loading,        setLoading]        = useState(true)
  const [exPage,         setExPage]         = useState(1)

  useEffect(() => { fetchData() }, [userId])

  async function fetchData() {
    setLoading(true)
    const [uRes, sRes, eRes, rRes, raRes] = await Promise.all([
      supabase.from('users').select('*').eq('id', userId).single(),
      supabase.from('sessions').select('*').eq('user_id', userId).order('started_at'),
      supabase.from('exercises').select('*').eq('user_id', userId).order('created_at'),
      supabase.from('srs_items').select('*').eq('user_id', userId),
      supabase.from('review_attempts').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(100),
    ])
    setUser(uRes.data)
    setSessions(sRes.data ?? [])
    setExercises(eRes.data ?? [])
    setSrsItems(rRes.data ?? [])
    setReviewAttempts(raRes.data ?? [])
    setLoading(false)
  }

  // ── Derived data ──────────────────────────────────────────────────────────

  const completedSessions = sessions.filter(s => s.ended_at)

  const totalTimeSec = completedSessions.reduce((acc, s) =>
    acc + Math.floor((new Date(s.ended_at) - new Date(s.started_at)) / 1000), 0)

  const exercisesBySession = {}
  exercises.forEach(e => {
    if (!exercisesBySession[e.session_id]) exercisesBySession[e.session_id] = []
    exercisesBySession[e.session_id].push(e)
  })

  const allPrecs   = exercises.filter(e => e.precision != null)
  const meanPrec   = allPrecs.length
    ? allPrecs.reduce((a, e) => a + e.precision, 0) / allPrecs.length : null

  const idmValues  = completedSessions.map(s => s.idm_end).filter(v => v != null)
  const currentIDM = idmValues[idmValues.length - 1] ?? null
  const minIDM     = idmValues.length ? Math.min(...idmValues) : null
  const maxIDM     = idmValues.length ? Math.max(...idmValues) : null

  // Trend from last 3 sessions
  const last3 = completedSessions.slice(-3)
  let trend = null
  if (last3.length >= 2) {
    const sessionMeans = last3.map(s => {
      const exs = (exercisesBySession[s.id] ?? []).filter(e => e.precision != null)
      return exs.length ? exs.reduce((a, e) => a + e.precision, 0) / exs.length : null
    }).filter(v => v != null)
    if (sessionMeans.length >= 2) {
      const first = sessionMeans[0], last = sessionMeans[sessionMeans.length - 1]
      const diff = last - first
      trend = diff > 0.03 ? 'improving' : diff < -0.03 ? 'declining' : 'stable'
    }
  }

  const TREND_STYLE = {
    improving: { label: 'Improving', color: 'text-emerald-400 bg-emerald-900/30' },
    stable:    { label: 'Stable',    color: 'text-zinc-400  bg-zinc-800/50'    },
    declining: { label: 'Declining', color: 'text-orange-400  bg-orange-950/30'    },
  }

  // ── Chart data ────────────────────────────────────────────────────────────

  const idmChartData = completedSessions.map((s, i) => ({
    n:   i + 1,
    idm: s.idm_end ?? null,
  }))

  const precChartData = completedSessions.map((s, i) => {
    const exs  = (exercisesBySession[s.id] ?? []).filter(e => e.precision != null)
    const mean = exs.length ? exs.reduce((a, e) => a + e.precision, 0) / exs.length : null
    return { n: i + 1, precision: mean != null ? Math.round(mean * 100) : null }
  })

  const durationChartData = completedSessions.map((s, i) => ({
    n:    i + 1,
    mins: Math.round((new Date(s.ended_at) - new Date(s.started_at)) / 60000),
  }))

  // ── Pagination ────────────────────────────────────────────────────────────

  const totalPages  = Math.ceil(exercises.length / PAGE_SIZE)
  const pagedEx     = exercises.slice((exPage - 1) * PAGE_SIZE, exPage * PAGE_SIZE)

  // ── Locked intervals ──────────────────────────────────────────────────────

  const now = new Date()
  const lockedIntervals = INTERVAL_INTRODUCTION_ORDER.filter(
    intro => !srsItems.some(
      item => item.interval_type === intro.interval && item.direction === intro.direction
    )
  )

  // ── Exports ───────────────────────────────────────────────────────────────

  function exportExercises() {
    const csv = objectsToCSV(exercises.map(ex => ({
      date:          ex.created_at,
      session_id:    ex.session_id,
      idm:           ex.idm,
      d_bar:         ex.d_bar,
      s:             ex.s,
      c:             ex.c,
      x:             ex.x,
      n_chunks:      ex.n_chunks,
      d_density:     ex.d_density,
      r:             ex.r,
      h:             ex.h,
      auditions_used: ex.auditions_used,
      precision:     ex.precision,
      response_time: ex.response_time,
    })))
    downloadCSV(`user_${user?.code}_exercises.csv`, csv)
  }

  function exportReviewAttempts() {
    const csv = objectsToCSV(reviewAttempts.map(ra => ({
      date:           ra.created_at,
      exercise_id:    ra.exercise_id?.slice(0, 8),
      attempt_number: ra.attempt_number,
      precision:      ra.precision,
      completed:      ra.completed,
    })))
    downloadCSV(`user_${user?.code}_review_attempts.csv`, csv)
  }

  function exportSRS() {
    const csv = objectsToCSV(srsItems.map(item => {
      const h = estimateHalfLife(item.correct_count, item.wrong_count, item.exposures)
      const lastSeen   = item.last_seen ? new Date(item.last_seen) : null
      const deltaDays  = lastSeen ? (now - lastSeen) / 86400000 : 0
      const p          = recallProbability(deltaDays, h)
      return {
        interval:     item.interval_type,
        direction:    item.direction,
        leitner_box:  item.leitner_box,
        exposures:    item.exposures,
        correct:      item.correct_count,
        wrong:        item.wrong_count,
        half_life:    h.toFixed(2),
        next_review:  item.next_review,
        recall_prob:  p.toFixed(3),
      }
    }))
    downloadCSV(`user_${user?.code}_srs.csv`, csv)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64 text-zinc-400">
        Loading…
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
    <div className="flex-1 flex justify-center">
    <div className="w-full max-w-6xl px-6 py-6 flex flex-col gap-6">

      {/* Back */}
      <button
        onClick={() => navigate('/admin')}
        className="flex items-center gap-1.5 text-zinc-400 hover:text-white text-sm transition-colors w-fit"
        style={{ paddingTop: '20px' }}
      >
        ← Back to Global
      </button>

      {/* ── Block 1: User summary ─────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">User detail</h1>
        <div className="flex items-center gap-3">
          <span className="font-mono text-cyan-400 text-2xl font-bold">{user?.code}</span>
          {trend && (
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${TREND_STYLE[trend].color}`}>
              {TREND_STYLE[trend].label}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <SummaryCard label="Registered"
          value={user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—'} />
        <SummaryCard label="Language"    value={user?.language?.toUpperCase() ?? '—'} />
        <SummaryCard label="Sessions"    value={completedSessions.length} />
        <SummaryCard label="Practice time" value={totalTimeSec ? formatDuration(totalTimeSec) : '—'} />
        <SummaryCard label="Current IDM"
          value={currentIDM != null ? currentIDM.toFixed(1) : '—'} color="text-cyan-400" />
        <SummaryCard label="Min IDM"
          value={minIDM != null ? minIDM.toFixed(1) : '—'} color="text-zinc-400" />
        <SummaryCard label="Max IDM"
          value={maxIDM != null ? maxIDM.toFixed(1) : '—'} color="text-orange-400" />
        <SummaryCard label="Mean precision"
          value={meanPrec != null ? formatPrecision(meanPrec) : '—'} color="text-emerald-400" />
      </div>

      {/* ── Block 2: Evolution charts ─────────────────────────────── */}
      {completedSessions.length > 1 && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Section title="IDM per session">
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={idmChartData} margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="n" stroke="#3f3f46" tick={{ fill: '#71717a', fontSize: 10 }} />
                    <YAxis stroke="#3f3f46" tick={{ fill: '#71717a', fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ background: '#27272a', border: '1px solid #3f3f46', borderRadius: 6 }}
                      labelStyle={{ color: '#71717a', fontSize: 11 }}
                      itemStyle={{ color: '#06b6d4' }}
                    />
                    <Line type="monotone" dataKey="idm" stroke="#06b6d4" strokeWidth={2}
                      dot={{ fill: '#06b6d4', r: 3 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Section>

            <Section title="Precision per session">
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={precChartData} margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="n" stroke="#3f3f46" tick={{ fill: '#71717a', fontSize: 10 }} />
                    <YAxis domain={[0, 100]} stroke="#3f3f46" tick={{ fill: '#71717a', fontSize: 10 }}
                      tickFormatter={v => `${v}%`} />
                    <Tooltip
                      contentStyle={{ background: '#27272a', border: '1px solid #3f3f46', borderRadius: 6 }}
                      labelStyle={{ color: '#71717a', fontSize: 11 }}
                      itemStyle={{ color: '#10b981' }}
                      formatter={v => [`${v}%`, 'Precision']}
                    />
                    <Line type="monotone" dataKey="precision" stroke="#10b981" strokeWidth={2}
                      dot={{ fill: '#10b981', r: 3 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Section>
          </div>

          <Section title="Session duration (minutes)">
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={durationChartData} margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="n" stroke="#3f3f46" tick={{ fill: '#71717a', fontSize: 10 }} />
                  <YAxis stroke="#3f3f46" tick={{ fill: '#71717a', fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ background: '#27272a', border: '1px solid #3f3f46', borderRadius: 6 }}
                    labelStyle={{ color: '#71717a', fontSize: 11 }}
                    itemStyle={{ color: '#71717a' }}
                    formatter={v => [`${v} min`, 'Duration']}
                  />
                  <Bar dataKey="mins" fill="#3f3f46" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Section>
        </div>
      )}

      {/* ── Block 3: Exercises table ──────────────────────────────── */}
      <Section
        title={`Exercises — ${exercises.length} total`}
        action={
          <button
            onClick={exportExercises}
            className="px-3 py-1 bg-zinc-800 text-zinc-400 rounded text-xs hover:bg-zinc-800 transition-colors"
          >
            Export CSV
          </button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-zinc-500 border-b border-zinc-800 text-xs uppercase tracking-wide">
                {['Date', 'Session', 'IDM', 'dbar', 'S', 'C', 'X', 'N', 'D/Dref', 'R', 'H',
                  'Auditions', 'Precision', 'Resp. time'].map(col => (
                  <th key={col} className="text-left py-2 px-3 font-medium whitespace-nowrap">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagedEx.map(ex => (
                <tr key={ex.id} className="border-b border-zinc-900/60 text-zinc-300 hover:bg-zinc-800/20">
                  <td className="py-2 px-3 whitespace-nowrap text-zinc-500">
                    {ex.created_at ? new Date(ex.created_at).toLocaleString() : '—'}
                  </td>
                  <td className="py-2 px-3 text-zinc-500 font-mono text-xs truncate max-w-16">
                    {ex.session_id?.slice(0, 8)}
                  </td>
                  <td className="py-2 px-3 font-mono text-cyan-300">{ex.idm?.toFixed(2) ?? '—'}</td>
                  <td className="py-2 px-3">{ex.d_bar?.toFixed(2) ?? '—'}</td>
                  <td className="py-2 px-3">{ex.s ?? '—'}</td>
                  <td className="py-2 px-3">{ex.c?.toFixed(2) ?? '—'}</td>
                  <td className="py-2 px-3">{ex.x?.toFixed(2) ?? '—'}</td>
                  <td className="py-2 px-3">{ex.n_chunks ?? '—'}</td>
                  <td className="py-2 px-3">{ex.d_density?.toFixed(2) ?? '—'}</td>
                  <td className="py-2 px-3">{ex.r?.toFixed(2) ?? '—'}</td>
                  <td className="py-2 px-3">{ex.h ?? '—'}</td>
                  <td className="py-2 px-3">{ex.auditions_used ?? '—'}</td>
                  <td className="py-2 px-3 font-mono">
                    {ex.precision != null ? (
                      <span style={{
                        color: ex.precision >= 0.8 ? '#10b981'
                          : ex.precision >= 0.5 ? '#f97316' : '#ef4444',
                      }}>
                        {formatPrecision(ex.precision)}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="py-2 px-3">{ex.response_time?.toFixed(1) ?? '—'}s</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-zinc-800">
            <span className="text-zinc-500 text-xs">
              Page {exPage} of {totalPages} — {exercises.length} exercises
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setExPage(p => Math.max(1, p - 1))}
                disabled={exPage === 1}
                className="px-3 py-1 bg-zinc-800 text-zinc-300 rounded text-xs hover:bg-zinc-800
                  disabled:opacity-40 transition-colors"
              >
                ← Prev
              </button>
              <button
                onClick={() => setExPage(p => Math.min(totalPages, p + 1))}
                disabled={exPage === totalPages}
                className="px-3 py-1 bg-zinc-800 text-zinc-300 rounded text-xs hover:bg-zinc-800
                  disabled:opacity-40 transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </Section>

      {/* ── Block 4: SRS status ───────────────────────────────────── */}
      <Section
        title={`SRS status — ${srsItems.length} active, ${lockedIntervals.length} pending`}
        action={
          <button
            onClick={exportSRS}
            className="px-3 py-1 bg-zinc-800 text-zinc-400 rounded text-xs hover:bg-zinc-800 transition-colors"
          >
            Export CSV
          </button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-zinc-500 border-b border-zinc-800 text-xs uppercase tracking-wide">
                {['Interval', 'Direction', 'Box', 'Exposures', 'Correct', 'Wrong',
                  'Half-life (d)', 'Recall', 'Last seen', 'Next review'].map(col => (
                  <th key={col} className="text-left py-2 px-3 font-medium whitespace-nowrap">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {srsItems.map(item => {
                const h        = estimateHalfLife(item.correct_count, item.wrong_count, item.exposures)
                const lastSeen = item.last_seen ? new Date(item.last_seen) : null
                const delta    = lastSeen ? (now - lastSeen) / 86400000 : 0
                const p        = recallProbability(delta, h)
                return (
                  <tr key={item.id} className="border-b border-zinc-900/60 text-zinc-300 hover:bg-zinc-800/20">
                    <td className="py-2 px-3 font-mono font-bold">{item.interval_type}</td>
                    <td className="py-2 px-3 capitalize">{item.direction}</td>
                    <td className="py-2 px-3">{item.leitner_box}</td>
                    <td className="py-2 px-3">{item.exposures}</td>
                    <td className="py-2 px-3 text-emerald-400">{item.correct_count}</td>
                    <td className="py-2 px-3 text-rose-500">{item.wrong_count}</td>
                    <td className="py-2 px-3 font-mono">{h.toFixed(1)}</td>
                    <td className="py-2 px-3 font-mono">
                      <span style={{ color: p >= 0.7 ? '#10b981' : p >= 0.4 ? '#f97316' : '#ef4444' }}>
                        {Math.round(p * 100)}%
                      </span>
                    </td>
                    <td className="py-2 px-3 text-zinc-500 whitespace-nowrap">
                      {lastSeen ? lastSeen.toLocaleDateString() : '—'}
                    </td>
                    <td className="py-2 px-3 text-zinc-500 whitespace-nowrap">
                      {item.next_review ? new Date(item.next_review).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                )
              })}

              {/* Locked intervals */}
              {lockedIntervals.map(({ interval, direction }) => (
                <tr key={`${interval}-${direction}`}
                  className="border-b border-zinc-900/30 opacity-40">
                  <td className="py-2 px-3 font-mono font-bold">{interval}</td>
                  <td className="py-2 px-3 capitalize">{direction}</td>
                  <td className="py-2 px-3" colSpan={8}>
                    <span className="text-xs px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded">
                      Pending
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      {/* ── Block 5: Review attempts ──────────────────────────────── */}
      {reviewAttempts.length > 0 && (
        <Section
          title={`Review attempts — ${reviewAttempts.length} total`}
          action={
            <button
              onClick={exportReviewAttempts}
              className="px-3 py-1 bg-zinc-800 text-zinc-400 rounded text-xs hover:bg-zinc-800 transition-colors"
            >
              Export CSV
            </button>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-zinc-500 border-b border-zinc-800 text-xs uppercase tracking-wide">
                  {['Date', 'Exercise', 'Attempt #', 'Precision', 'Completed'].map(col => (
                    <th key={col} className="text-left py-2 px-3 font-medium whitespace-nowrap">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reviewAttempts.map(ra => (
                  <tr key={ra.id} className="border-b border-zinc-900/60 text-zinc-300 hover:bg-zinc-800/20">
                    <td className="py-2 px-3 whitespace-nowrap text-zinc-500">
                      {ra.created_at ? new Date(ra.created_at).toLocaleString() : '—'}
                    </td>
                    <td className="py-2 px-3 text-zinc-500 font-mono text-xs">
                      {ra.exercise_id?.slice(0, 8)}
                    </td>
                    <td className="py-2 px-3">{ra.attempt_number}</td>
                    <td className="py-2 px-3 font-mono">
                      {ra.precision != null ? (
                        <span style={{
                          color: ra.precision >= 0.8 ? '#10b981'
                            : ra.precision >= 0.5 ? '#f97316' : '#ef4444',
                        }}>
                          {Math.round(ra.precision * 100)}%
                        </span>
                      ) : '—'}
                    </td>
                    <td className="py-2 px-3">
                      {ra.completed
                        ? <span className="text-emerald-400">✓</span>
                        : <span className="text-zinc-600">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

    </div>
    </div>
    </div>
  )
}

function SummaryCard({ label, value, color = 'text-zinc-100' }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl text-center" style={{ padding: '5px' }}>
      <div className={`text-xl font-bold font-mono ${color}`}>{value}</div>
      <div className="text-zinc-500 text-xs mt-1 leading-tight">{label}</div>
    </div>
  )
}
