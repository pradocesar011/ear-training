import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { supabase } from '../lib/supabase.js'
import { objectsToCSV, downloadCSV } from '../lib/utils.js'
import { Section, StatCard } from './AdminDashboard.jsx'

// ── Label maps ────────────────────────────────────────────────────────────────

const AGE_LABELS = {
  under_18: 'Under 18',
  '18_25':  '18–25',
  '26_35':  '26–35',
  '36_45':  '36–45',
  '46_plus': '46+',
}

const GOAL_LABELS = {
  learn_scratch: 'Learn from scratch',
  improve:       'Improve skills',
  music_school:  'Music school',
  fun:           'Just for fun',
}

const AGE_ORDER  = ['under_18', '18_25', '26_35', '36_45', '46_plus']
const GOAL_ORDER = ['learn_scratch', 'improve', 'music_school', 'fun']

const C = {
  cyan:   '#06b6d4',
  green:  '#10b981',
  amber:  '#f59e0b',
  orange: '#f97316',
  purple: '#a78bfa',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pct(n, total) {
  if (!total) return '—'
  return `${Math.round((n / total) * 100)}%`
}

function countBy(rows, key, valueFilter) {
  const counts = {}
  rows.forEach(r => {
    if (valueFilter !== undefined && r[valueFilter.key] !== valueFilter.val) return
    const v = r[key]
    if (v == null) return
    counts[v] = (counts[v] ?? 0) + 1
  })
  return counts
}

function toBarData(counts, order, labels) {
  return order
    .filter(k => counts[k] != null)
    .map(k => ({ name: labels[k] ?? k, count: counts[k] }))
}

// ── Custom tooltip ─────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#09090b', border: '1px solid #3f3f46', borderRadius: 8, padding: '8px 12px' }}>
      <p style={{ color: '#71717a', fontSize: 12, marginBottom: 2 }}>{label}</p>
      <p style={{ color: '#e4f6f7', fontSize: 14, fontWeight: 700 }}>{payload[0].value} users</p>
    </div>
  )
}

// ── Chart wrapper ─────────────────────────────────────────────────────────────

function SimpleBarChart({ data, color }) {
  if (!data.length) return <p className="text-zinc-500 text-sm">No data yet.</p>
  return (
    <div style={{ height: 180 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis dataKey="name" stroke="#3f3f46" tick={{ fill: '#71717a', fontSize: 11 }} />
          <YAxis stroke="#3f3f46" tick={{ fill: '#71717a', fontSize: 11 }} allowDecimals={false} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.map((_, i) => <Cell key={i} fill={color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AdminSurvey() {
  const [rows,    setRows]    = useState([])
  const [total,   setTotal]   = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const [{ data: surveys }, { count }] = await Promise.all([
      supabase
        .from('onboarding_surveys')
        .select('*, users(code)')
        .order('created_at', { ascending: false }),
      supabase
        .from('users')
        .select('*', { count: 'exact', head: true }),
    ])
    setRows(surveys ?? [])
    setTotal(count ?? 0)
    setLoading(false)
  }

  // ── Derived stats ──────────────────────────────────────────────────────────

  const n = rows.length
  const withTraining  = rows.filter(r => r.has_formal_training === true).length
  const withInstrument = rows.filter(r => r.plays_instrument === true).length
  const withDictation  = rows.filter(r => r.practiced_dictation === true).length

  const ageCounts      = countBy(rows, 'age_range')
  const goalCounts     = countBy(rows, 'main_goal')
  const instrumentCounts = countBy(rows, 'main_instrument', { key: 'plays_instrument', val: true })
  const yearCounts     = countBy(rows, 'training_years',   { key: 'has_formal_training', val: true })

  const ageData    = toBarData(ageCounts,  AGE_ORDER,  AGE_LABELS)
  const goalData   = toBarData(goalCounts, GOAL_ORDER, GOAL_LABELS)

  const instrumentData = Object.entries(instrumentCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }))

  const yearData = Object.entries(yearCounts)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([yr, count]) => ({ name: yr === '10' ? '10+' : yr, count }))

  // ── CSV export ─────────────────────────────────────────────────────────────

  function exportCSV() {
    const csv = objectsToCSV(rows.map(r => ({
      user_code:           r.users?.code ?? r.user_id,
      has_formal_training: r.has_formal_training ?? '',
      training_years:      r.training_years ?? '',
      plays_instrument:    r.plays_instrument ?? '',
      main_instrument:     r.main_instrument ?? '',
      practiced_dictation: r.practiced_dictation ?? '',
      age_range:           r.age_range ?? '',
      main_goal:           r.main_goal ?? '',
      created_at:          r.created_at ?? '',
    })))
    downloadCSV('survey_responses.csv', csv)
  }

  if (loading) {
    return <p className="text-zinc-500 text-sm">Loading…</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-white text-xl font-bold">Onboarding Survey</h2>
        <button
          onClick={exportCSV}
          disabled={!n}
          className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg text-sm font-medium
            hover:bg-zinc-700 disabled:opacity-40 transition-colors"
        >
          Export CSV
        </button>
      </div>

      {/* ── Stat cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Responses"
          value={`${n} / ${total}`}
          color="text-cyan-400"
        />
        <StatCard
          label="Formal training"
          value={pct(withTraining, n)}
          color="text-green-400"
        />
        <StatCard
          label="Plays instrument"
          value={pct(withInstrument, n)}
          color="text-amber-400"
        />
        <StatCard
          label="Prior dictation"
          value={pct(withDictation, n)}
          color="text-purple-400"
        />
      </div>

      {/* ── Charts ─────────────────────────────────────────────────────────── */}
      {n > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Section title="Age range">
              <SimpleBarChart data={ageData} color={C.cyan} />
            </Section>
            <Section title="Main goal">
              <SimpleBarChart data={goalData} color={C.green} />
            </Section>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Section title={`Instruments (${withInstrument} players)`}>
              <SimpleBarChart data={instrumentData} color={C.amber} />
            </Section>
            <Section title={`Training years (${withTraining} with formal training)`}>
              <SimpleBarChart data={yearData} color={C.purple} />
            </Section>
          </div>

          {/* ── Raw data table ────────────────────────────────────────────── */}
          <Section title="All responses">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-zinc-500 text-xs border-b border-zinc-800">
                    {['Code', 'Formal', 'Yrs', 'Instrument', 'Dictation', 'Age', 'Goal', 'Date'].map(h => (
                      <th key={h} className="text-left py-2 px-3 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id} className="border-b border-zinc-900 text-zinc-300 hover:bg-zinc-800/30">
                      <td className="py-2 px-3 font-mono text-cyan-400 text-xs">{r.users?.code ?? '—'}</td>
                      <td className="py-2 px-3">
                        {r.has_formal_training === true ? '✓' : r.has_formal_training === false ? '✗' : '—'}
                      </td>
                      <td className="py-2 px-3 text-zinc-400">{r.training_years ?? '—'}</td>
                      <td className="py-2 px-3">{r.main_instrument ?? '—'}</td>
                      <td className="py-2 px-3">
                        {r.practiced_dictation === true ? '✓' : r.practiced_dictation === false ? '✗' : '—'}
                      </td>
                      <td className="py-2 px-3">{AGE_LABELS[r.age_range] ?? r.age_range ?? '—'}</td>
                      <td className="py-2 px-3">{GOAL_LABELS[r.main_goal] ?? r.main_goal ?? '—'}</td>
                      <td className="py-2 px-3 text-zinc-500 text-xs whitespace-nowrap">
                        {r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </>
      )}

      {n === 0 && (
        <p className="text-zinc-500 text-sm">No survey responses yet.</p>
      )}
    </div>
  )
}
