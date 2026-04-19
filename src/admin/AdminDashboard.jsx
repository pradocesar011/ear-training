import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { supabase } from '../lib/supabase.js'
import { formatPrecision, formatDuration } from '../lib/utils.js'

const TIME_RANGES = ['7d', '30d', 'all']

export default function AdminDashboard() {
  const navigate = useNavigate()

  const [users,            setUsers]            = useState([])
  const [globalStats,      setGlobalStats]      = useState(null)
  const [newUsersData,     setNewUsersData]     = useState([])
  const [precTrendData,    setPrecTrendData]    = useState([])
  const [idmDistData,      setIdmDistData]      = useState([])
  const [loading,          setLoading]          = useState(true)
  const [timeRange,        setTimeRange]        = useState('30d')
  const [sortCol,          setSortCol]          = useState('created_at')
  const [sortDir,          setSortDir]          = useState('desc')
  const [search,           setSearch]           = useState('')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)

    const [
      { data: allUsers },
      { data: allSessions },
      { data: allExercises },
    ] = await Promise.all([
      supabase.from('users').select('id, code, created_at, language').order('created_at'),
      supabase.from('sessions')
        .select('id, user_id, started_at, ended_at, idm_end, exercises_count')
        .not('ended_at', 'is', null),
      supabase.from('exercises').select('id, session_id, user_id, precision'),
    ])

    if (!allUsers) { setLoading(false); return }

    // Index sessions and exercises by user
    const sessionsByUser = {}
    const exercisesByUser = {}
    ;(allSessions ?? []).forEach(s => {
      if (!sessionsByUser[s.user_id]) sessionsByUser[s.user_id] = []
      sessionsByUser[s.user_id].push(s)
    })
    ;(allExercises ?? []).forEach(e => {
      if (!exercisesByUser[e.user_id]) exercisesByUser[e.user_id] = []
      exercisesByUser[e.user_id].push(e)
    })

    // Enrich users
    const enriched = allUsers.map(u => {
      const userSessions  = (sessionsByUser[u.id] ?? [])
        .sort((a, b) => new Date(a.started_at) - new Date(b.started_at))
      const userExercises = exercisesByUser[u.id] ?? []
      const lastSess      = userSessions[userSessions.length - 1]

      const totalSec = userSessions.reduce((acc, s) =>
        acc + Math.floor((new Date(s.ended_at) - new Date(s.started_at)) / 1000), 0)

      const validPrecs = userExercises.filter(e => e.precision != null)
      const meanPrec   = validPrecs.length
        ? validPrecs.reduce((a, e) => a + e.precision, 0) / validPrecs.length
        : null

      return {
        ...u,
        sessions_count: userSessions.length,
        last_session:   lastSess?.started_at ?? null,
        current_idm:    lastSess?.idm_end ?? null,
        mean_precision: meanPrec,
        total_time:     totalSec,
      }
    })
    setUsers(enriched)

    // ── Global stats ──────────────────────────────────────────────
    const sessions  = allSessions ?? []
    const exercises = allExercises ?? []
    const totalSec  = sessions.reduce((acc, s) =>
      acc + Math.floor((new Date(s.ended_at) - new Date(s.started_at)) / 1000), 0)
    const allPrecs  = exercises.filter(e => e.precision != null)
    const meanPrec  = allPrecs.length
      ? allPrecs.reduce((a, e) => a + e.precision, 0) / allPrecs.length : null
    const withIDM   = enriched.filter(u => u.current_idm != null)
    const meanIDM   = withIDM.length
      ? withIDM.reduce((a, u) => a + u.current_idm, 0) / withIDM.length : null

    setGlobalStats({
      totalUsers:     allUsers.length,
      totalSessions:  sessions.length,
      totalExercises: exercises.length,
      totalHours:     (totalSec / 3600).toFixed(1),
      meanPrecision:  meanPrec,
      meanIDM,
    })

    // ── New users per day ─────────────────────────────────────────
    const dayMap = {}
    allUsers.forEach(u => {
      const day = new Date(u.created_at).toISOString().slice(0, 10)
      dayMap[day] = (dayMap[day] ?? 0) + 1
    })
    setNewUsersData(Object.keys(dayMap).sort().map(d => ({ date: d, users: dayMap[d] })))

    // ── Global mean precision per session (chronological) ─────────
    const exercisesBySess = {}
    exercises.forEach(e => {
      if (!exercisesBySess[e.session_id]) exercisesBySess[e.session_id] = []
      exercisesBySess[e.session_id].push(e)
    })
    const precTrend = sessions
      .sort((a, b) => new Date(a.started_at) - new Date(b.started_at))
      .map((s, i) => {
        const precs = (exercisesBySess[s.id] ?? []).filter(e => e.precision != null)
        const mean  = precs.length ? precs.reduce((a, e) => a + e.precision, 0) / precs.length : null
        return { n: i + 1, precision: mean != null ? Math.round(mean * 100) : null }
      })
      .filter(d => d.precision != null)
    setPrecTrendData(precTrend)

    // ── IDM distribution histogram ────────────────────────────────
    const buckets = {}
    enriched.filter(u => u.current_idm != null).forEach(u => {
      const b = Math.floor(u.current_idm)
      buckets[b] = (buckets[b] ?? 0) + 1
    })
    setIdmDistData(
      Object.keys(buckets).sort((a, b) => +a - +b).map(k => ({ idm: +k, users: buckets[k] }))
    )

    setLoading(false)
  }

  // Filter new-users chart by time range
  const filteredNewUsers = useMemo(() => {
    if (timeRange === 'all') return newUsersData
    const days   = timeRange === '7d' ? 7 : 30
    const cutoff = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10)
    return newUsersData.filter(d => d.date >= cutoff)
  }, [newUsersData, timeRange])

  // Sort + search users table
  const sortedUsers = useMemo(() => {
    let list = search
      ? users.filter(u => u.code.toLowerCase().includes(search.toLowerCase()))
      : users
    return [...list].sort((a, b) => {
      let va = a[sortCol], vb = b[sortCol]
      if (va == null) return 1
      if (vb == null) return -1
      if (typeof va === 'string') { va = va.toLowerCase(); vb = vb.toLowerCase() }
      return sortDir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1)
    })
  }, [users, sortCol, sortDir, search])

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const COLS = [
    { key: 'code',           label: 'Code'         },
    { key: 'created_at',     label: 'Registered'   },
    { key: 'sessions_count', label: 'Sessions'      },
    { key: 'last_session',   label: 'Last session'  },
    { key: 'current_idm',    label: 'IDM'           },
    { key: 'mean_precision', label: 'Precision'     },
    { key: 'total_time',     label: 'Time'          },
    { key: 'language',       label: 'Lang'          },
  ]

  if (loading) return <LoadingSkeleton />

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-white" style={{ paddingTop: '20px' }}>Global Overview</h1>

      {/* ── Metric cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Users"          value={globalStats?.totalUsers ?? '—'}  color="text-cyan-400" />
        <StatCard label="Sessions"       value={globalStats?.totalSessions ?? '—'} />
        <StatCard label="Exercises"      value={globalStats?.totalExercises ?? '—'} />
        <StatCard label="Practice hrs"   value={globalStats?.totalHours ?? '—'} />
        <StatCard
          label="Mean precision"
          value={globalStats?.meanPrecision != null ? formatPrecision(globalStats.meanPrecision) : '—'}
          color="text-emerald-400"
        />
        <StatCard
          label="Mean IDM"
          value={globalStats?.meanIDM != null ? globalStats.meanIDM.toFixed(1) : '—'}
          color="text-orange-400"
        />
      </div>

      {/* ── Charts ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* New users */}
        <Section title="New users">
          <div className="flex gap-1 mb-3">
            {TIME_RANGES.map(r => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  timeRange === r
                    ? 'bg-cyan-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-800'
                }`} style={{ paddingTop: '10px', paddingBottom: '10px' }}
              >
                {r}
              </button>
            ))}
          </div>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={filteredNewUsers} margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="date" stroke="#3f3f46" tick={{ fill: '#71717a', fontSize: 9 }}
                  tickFormatter={d => d.slice(5)} />
                <YAxis stroke="#3f3f46" tick={{ fill: '#71717a', fontSize: 10 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: '#27272a', border: '1px solid #3f3f46', borderRadius: 6 }}
                  labelStyle={{ color: '#71717a', fontSize: 11 }}
                  itemStyle={{ color: '#06b6d4' }}
                />
                <Bar dataKey="users" fill="#06b6d4" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>

        {/* Global precision trend */}
        <Section title="Mean precision per session">
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={precTrendData} margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
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
                  dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Section>

        {/* IDM distribution */}
        <Section title="IDM distribution">
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={idmDistData} margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="idm" stroke="#3f3f46" tick={{ fill: '#71717a', fontSize: 10 }} />
                <YAxis stroke="#3f3f46" tick={{ fill: '#71717a', fontSize: 10 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: '#27272a', border: '1px solid #3f3f46', borderRadius: 6 }}
                  labelStyle={{ color: '#71717a', fontSize: 11 }}
                  itemStyle={{ color: '#f97316' }}
                />
                <Bar dataKey="users" fill="#f97316" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
      </div>

      {/* ── Users table ──────────────────────────────────────────── */}
      <Section title={`Users — ${sortedUsers.length}`}>
        <div className="mb-4">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by code…"
            className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white
              placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 w-full max-w-xs"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-zinc-500 border-b border-zinc-800 text-xs uppercase tracking-wide">
                {COLS.map(col => (
                  <th
                    key={col.key}
                    onClick={() => toggleSort(col.key)}
                    className="text-left py-3 px-3 font-medium cursor-pointer hover:text-white select-none whitespace-nowrap"
                  >
                    {col.label}
                    {sortCol === col.key && (
                      <span className="ml-1 text-cyan-400">{sortDir === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedUsers.map(u => (
                <tr
                  key={u.id}
                  onClick={() => navigate(`/admin/user/${u.id}`)}
                  className="border-b border-zinc-900 hover:bg-zinc-800/40 cursor-pointer transition-colors"
                >
                  <td className="py-3 px-3 font-mono text-cyan-400 font-bold">{u.code}</td>
                  <td className="py-3 px-3 text-zinc-400 whitespace-nowrap">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="py-3 px-3 text-zinc-300">{u.sessions_count}</td>
                  <td className="py-3 px-3 text-zinc-400 whitespace-nowrap">
                    {u.last_session ? new Date(u.last_session).toLocaleDateString() : '—'}
                  </td>
                  <td className="py-3 px-3 text-zinc-300 font-mono">
                    {u.current_idm != null ? u.current_idm.toFixed(1) : '—'}
                  </td>
                  <td className="py-3 px-3 font-mono">
                    {u.mean_precision != null ? (
                      <span style={{
                        color: u.mean_precision >= 0.7 ? '#10b981'
                          : u.mean_precision >= 0.4 ? '#f97316' : '#ef4444',
                      }}>
                        {formatPrecision(u.mean_precision)}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="py-3 px-3 text-zinc-400 font-mono">
                    {u.total_time ? formatDuration(u.total_time) : '—'}
                  </td>
                  <td className="py-3 px-3 text-zinc-500 uppercase text-xs">{u.language ?? '—'}</td>
                </tr>
              ))}
              {!sortedUsers.length && (
                <tr><td colSpan={8} className="py-10 text-center text-zinc-500">No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  )
}

// ── Shared sub-components ─────────────────────────────────────────────────────

export function Section({ title, children, action }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl" style={{ padding: '20px' }}>
      <div className="flex items-center justify-between" style={{ paddingBottom: '10px' }}>
        <h3 className="text-zinc-400 text-xs font-medium uppercase tracking-widest">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  )
}

export function StatCard({ label, value, color = 'text-zinc-100' }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl text-center" style={{ padding: '5px' }}>
      <div className={`text-2xl font-bold font-mono ${color}`}>{value}</div>
      <div className="text-zinc-500 text-xs mt-1 leading-tight">{label}</div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      <div className="h-8 w-48 bg-zinc-800 rounded-lg" />
      <div className="grid grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 bg-zinc-900 border border-zinc-800 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-56 bg-zinc-900 border border-zinc-800 rounded-xl" />
        ))}
      </div>
      <div className="h-64 bg-zinc-900 border border-zinc-800 rounded-xl" />
    </div>
  )
}
