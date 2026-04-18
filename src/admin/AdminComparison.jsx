import { useEffect, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { supabase } from '../lib/supabase.js'
import { Section } from './AdminDashboard.jsx'

const USER_COLORS = ['#818cf8', '#22c55e', '#f59e0b', '#f472b6']
const MAX_USERS   = 4

export default function AdminComparison() {
  const [allUsers,      setAllUsers]      = useState([])
  const [selected,      setSelected]      = useState([])   // [{id, code}]
  const [userData,      setUserData]      = useState({})   // id → {sessions, exercises}
  const [search,        setSearch]        = useState('')
  const [loading,       setLoading]       = useState(true)
  const [loadingUser,   setLoadingUser]   = useState(null)

  useEffect(() => { fetchUsers() }, [])

  async function fetchUsers() {
    const { data } = await supabase.from('users').select('id, code').order('code')
    setAllUsers(data ?? [])
    setLoading(false)
  }

  async function addUser(user) {
    if (selected.find(u => u.id === user.id)) return
    if (selected.length >= MAX_USERS) return

    setSelected(prev => [...prev, user])
    setLoadingUser(user.id)

    const [{ data: sessions }, { data: exercises }] = await Promise.all([
      supabase.from('sessions').select('id, started_at, idm_end').eq('user_id', user.id)
        .not('ended_at', 'is', null).order('started_at'),
      supabase.from('exercises').select('session_id, precision').eq('user_id', user.id),
    ])

    const exercisesBySess = {}
    ;(exercises ?? []).forEach(e => {
      if (!exercisesBySess[e.session_id]) exercisesBySess[e.session_id] = []
      exercisesBySess[e.session_id].push(e)
    })

    const chartData = (sessions ?? []).map((s, i) => {
      const exs  = (exercisesBySess[s.id] ?? []).filter(e => e.precision != null)
      const mean = exs.length ? exs.reduce((a, e) => a + e.precision, 0) / exs.length : null
      return {
        n:         i + 1,
        idm:       s.idm_end ?? null,
        precision: mean != null ? Math.round(mean * 100) : null,
      }
    })

    setUserData(prev => ({ ...prev, [user.id]: chartData }))
    setLoadingUser(null)
  }

  function removeUser(userId) {
    setSelected(prev => prev.filter(u => u.id !== userId))
  }

  // Build overlay chart datasets
  // Each series needs a unique key per user; we build a merged array by session index
  function buildOverlayData(dataKey) {
    const maxLen = Math.max(...selected.map(u => (userData[u.id] ?? []).length), 0)
    return Array.from({ length: maxLen }, (_, i) => {
      const point = { n: i + 1 }
      selected.forEach(u => {
        const series = userData[u.id] ?? []
        point[u.code] = series[i]?.[dataKey] ?? null
      })
      return point
    })
  }

  const idmData  = buildOverlayData('idm')
  const precData = buildOverlayData('precision')

  const filtered = search
    ? allUsers.filter(u =>
        u.code.toLowerCase().includes(search.toLowerCase()) &&
        !selected.find(s => s.id === u.id)
      )
    : allUsers.filter(u => !selected.find(s => s.id === u.id))

  const tooltipStyle = {
    contentStyle: { background: '#1e293b', border: '1px solid #334155', borderRadius: 6 },
    labelStyle:   { color: '#64748b', fontSize: 11 },
  }

  if (loading) {
    return <div className="text-slate-400 text-sm">Loading…</div>
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-white" style={{ paddingTop: '20px' }}>User Comparison</h1>

      {/* ── User selector ─────────────────────────────────────────── */}
      <Section title="Select users (up to 4)">
        {/* Selected chips */}
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {selected.map((u, i) => (
              <div
                key={u.id}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-mono font-bold"
                style={{ backgroundColor: `${USER_COLORS[i]}22`, border: `1px solid ${USER_COLORS[i]}55`, color: USER_COLORS[i] }}
              >
                {u.code}
                {loadingUser === u.id
                  ? <span className="text-xs opacity-60 font-normal">loading…</span>
                  : <button onClick={() => removeUser(u.id)} className="opacity-60 hover:opacity-100 text-xs ml-1" style={{ paddingTop: '10px', paddingBottom: '10px' }}>×</button>
                }
              </div>
            ))}
          </div>
        )}

        {/* Search + list */}
        {selected.length < MAX_USERS && (
          <>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by code…"
              className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white
                placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full max-w-xs mb-2"
            />
            {search && (
              <div className="flex flex-wrap gap-2 mt-2">
                {filtered.slice(0, 12).map(u => (
                  <button
                    key={u.id}
                    onClick={() => addUser(u)}
                    className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded-lg text-sm font-mono
                      hover:bg-slate-600 transition-colors"
                    style={{ paddingTop: '10px', paddingBottom: '10px' }}
                  >
                    {u.code}
                  </button>
                ))}
                {!filtered.length && (
                  <span className="text-slate-500 text-sm">No users found</span>
                )}
              </div>
            )}
          </>
        )}
      </Section>

      {/* ── Overlay charts ────────────────────────────────────────── */}
      {selected.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          <Section title="IDM progression">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={idmData} margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="n" stroke="#334155" tick={{ fill: '#475569', fontSize: 10 }} />
                  <YAxis stroke="#334155" tick={{ fill: '#475569', fontSize: 10 }} />
                  <Tooltip {...tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                  {selected.map((u, i) => (
                    <Line
                      key={u.id}
                      type="monotone"
                      dataKey={u.code}
                      stroke={USER_COLORS[i]}
                      strokeWidth={2}
                      dot={{ fill: USER_COLORS[i], r: 3 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Section>

          <Section title="Precision progression">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={precData} margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="n" stroke="#334155" tick={{ fill: '#475569', fontSize: 10 }} />
                  <YAxis domain={[0, 100]} stroke="#334155" tick={{ fill: '#475569', fontSize: 10 }}
                    tickFormatter={v => `${v}%`} />
                  <Tooltip {...tooltipStyle} formatter={(v, name) => [`${v}%`, name]} />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                  {selected.map((u, i) => (
                    <Line
                      key={u.id}
                      type="monotone"
                      dataKey={u.code}
                      stroke={USER_COLORS[i]}
                      strokeWidth={2}
                      dot={{ fill: USER_COLORS[i], r: 3 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Section>
        </div>
      )}

      {selected.length === 0 && (
        <p className="text-slate-500 text-sm text-center py-12">
          Search and select users above to compare their learning curves.
        </p>
      )}
    </div>
  )
}
