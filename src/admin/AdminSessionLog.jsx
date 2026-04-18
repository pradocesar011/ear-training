import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase.js'
import { formatDuration, formatPrecision, objectsToCSV, downloadCSV } from '../lib/utils.js'
import { Section } from './AdminDashboard.jsx'

const PAGE_SIZE = 30

export default function AdminSessionLog() {
  const [sessions,  setSessions]  = useState([])
  const [userMap,   setUserMap]   = useState({})  // userId → code
  const [precMap,   setPrecMap]   = useState({})  // sessionId → meanPrecision
  const [loading,   setLoading]   = useState(true)
  const [page,      setPage]      = useState(1)

  // Filters
  const [filterCode,    setFilterCode]    = useState('')
  const [filterFrom,    setFilterFrom]    = useState('')
  const [filterTo,      setFilterTo]      = useState('')
  const [filterMinDur,  setFilterMinDur]  = useState('')
  const [filterIDMMin,  setFilterIDMMin]  = useState('')
  const [filterIDMMax,  setFilterIDMMax]  = useState('')

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)

    const [
      { data: sess },
      { data: users },
      { data: exRows },
    ] = await Promise.all([
      supabase.from('sessions')
        .select('id, user_id, started_at, ended_at, exercises_count, idm_start, idm_end')
        .not('ended_at', 'is', null)
        .order('started_at', { ascending: false }),
      supabase.from('users').select('id, code'),
      supabase.from('exercises').select('session_id, precision'),
    ])

    // Build user code lookup
    const uMap = {}
    ;(users ?? []).forEach(u => { uMap[u.id] = u.code })
    setUserMap(uMap)

    // Build precision per session
    const pMap = {}
    ;(exRows ?? []).forEach(e => {
      if (e.precision == null) return
      if (!pMap[e.session_id]) pMap[e.session_id] = []
      pMap[e.session_id].push(e.precision)
    })
    const meanMap = {}
    Object.keys(pMap).forEach(sid => {
      const arr = pMap[sid]
      meanMap[sid] = arr.reduce((a, b) => a + b, 0) / arr.length
    })
    setPrecMap(meanMap)

    setSessions(sess ?? [])
    setLoading(false)
  }

  // Apply filters
  const filtered = useMemo(() => {
    return sessions.filter(s => {
      const code = userMap[s.user_id] ?? ''
      if (filterCode && !code.toLowerCase().includes(filterCode.toLowerCase())) return false

      if (filterFrom && new Date(s.started_at) < new Date(filterFrom)) return false
      if (filterTo   && new Date(s.started_at) > new Date(filterTo + 'T23:59:59Z')) return false

      const durationSec = s.ended_at
        ? Math.floor((new Date(s.ended_at) - new Date(s.started_at)) / 1000) : 0
      if (filterMinDur && durationSec < Number(filterMinDur) * 60) return false

      if (filterIDMMin && (s.idm_end ?? 0) < Number(filterIDMMin)) return false
      if (filterIDMMax && (s.idm_end ?? 0) > Number(filterIDMMax)) return false

      return true
    })
  }, [sessions, userMap, filterCode, filterFrom, filterTo, filterMinDur, filterIDMMin, filterIDMMax])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged      = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function resetFilters() {
    setFilterCode(''); setFilterFrom(''); setFilterTo('')
    setFilterMinDur(''); setFilterIDMMin(''); setFilterIDMMax('')
    setPage(1)
  }

  function handleExport() {
    const csv = objectsToCSV(filtered.map(s => {
      const durationSec = s.ended_at
        ? Math.floor((new Date(s.ended_at) - new Date(s.started_at)) / 1000) : null
      return {
        user_code:       userMap[s.user_id] ?? s.user_id,
        date:            s.started_at,
        duration_sec:    durationSec,
        exercises:       s.exercises_count,
        mean_precision:  precMap[s.id] != null ? formatPrecision(precMap[s.id]) : '',
        idm_start:       s.idm_start,
        idm_end:         s.idm_end,
      }
    }))
    downloadCSV('sessions_export.csv', csv)
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-64 text-slate-400">Loading…</div>
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-white" style={{ paddingTop: '20px' }}>Session Log</h1>

      {/* ── Filters ──────────────────────────────────────────────── */}
      <Section title="Filters">
        <div className="flex flex-wrap gap-3 items-end">
          <FilterInput label="User code" value={filterCode}
            onChange={e => { setFilterCode(e.target.value.toUpperCase()); setPage(1) }}
            placeholder="e.g. AB3X7K" className="w-36" />

          <FilterInput label="From" type="date" value={filterFrom}
            onChange={e => { setFilterFrom(e.target.value); setPage(1) }} />

          <FilterInput label="To" type="date" value={filterTo}
            onChange={e => { setFilterTo(e.target.value); setPage(1) }} />

          <FilterInput label="Min duration (min)" type="number" value={filterMinDur}
            onChange={e => { setFilterMinDur(e.target.value); setPage(1) }}
            placeholder="e.g. 5" className="w-36" />

          <FilterInput label="IDM min" type="number" value={filterIDMMin}
            onChange={e => { setFilterIDMMin(e.target.value); setPage(1) }}
            placeholder="e.g. 2" className="w-24" />

          <FilterInput label="IDM max" type="number" value={filterIDMMax}
            onChange={e => { setFilterIDMMax(e.target.value); setPage(1) }}
            placeholder="e.g. 8" className="w-24" />

          <button
            onClick={resetFilters}
            className="px-3 py-2 bg-slate-700 text-slate-400 rounded-lg text-sm hover:bg-slate-600 transition-colors"
            style={{ paddingTop: '10px', paddingBottom: '10px' }}
          >
            Clear
          </button>
        </div>
      </Section>

      {/* ── Table ─────────────────────────────────────────────────── */}
      <Section
        title={`${filtered.length} sessions`}
        action={
          <button
            onClick={handleExport}
            className="px-3 py-1 bg-slate-700 text-slate-400 rounded text-xs hover:bg-slate-600 transition-colors"
            style={{ paddingTop: '10px', paddingBottom: '10px' }}
          >
            Export CSV
          </button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 border-b border-slate-700 text-xs uppercase tracking-wide">
                {['User', 'Date', 'Duration', 'Exercises', 'Precision', 'IDM start', 'IDM end'].map(col => (
                  <th key={col} className="text-left py-3 px-3 font-medium whitespace-nowrap">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.map(s => {
                const durationSec = s.ended_at
                  ? Math.floor((new Date(s.ended_at) - new Date(s.started_at)) / 1000) : null
                const prec        = precMap[s.id]
                const idmDelta    = s.idm_start != null && s.idm_end != null
                  ? s.idm_end - s.idm_start : null
                return (
                  <tr key={s.id}
                    className="border-b border-slate-800/60 text-slate-300 hover:bg-slate-700/20">
                    <td className="py-3 px-3 font-mono text-indigo-400 font-bold">
                      {userMap[s.user_id] ?? '—'}
                    </td>
                    <td className="py-3 px-3 text-slate-400 whitespace-nowrap">
                      {new Date(s.started_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 font-mono">
                      {durationSec != null ? formatDuration(durationSec) : '—'}
                    </td>
                    <td className="py-3 px-3">{s.exercises_count ?? '—'}</td>
                    <td className="py-3 px-3 font-mono">
                      {prec != null ? (
                        <span style={{
                          color: prec >= 0.7 ? '#22c55e' : prec >= 0.4 ? '#f59e0b' : '#ef4444',
                        }}>
                          {formatPrecision(prec)}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-400">
                      {s.idm_start?.toFixed(1) ?? '—'}
                    </td>
                    <td className="py-3 px-3 font-mono">
                      {s.idm_end != null ? (
                        <span>
                          {s.idm_end.toFixed(1)}
                          {idmDelta != null && (
                            <span className={`ml-1.5 text-xs ${idmDelta > 0 ? 'text-emerald-400' : idmDelta < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                              {idmDelta > 0 ? '+' : ''}{idmDelta.toFixed(1)}
                            </span>
                          )}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                )
              })}
              {!paged.length && (
                <tr><td colSpan={7} className="py-10 text-center text-slate-500">No sessions match filters</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-700">
            <span className="text-slate-500 text-xs">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 bg-slate-700 text-slate-300 rounded text-xs hover:bg-slate-600
                  disabled:opacity-40 transition-colors"
                style={{ paddingTop: '10px', paddingBottom: '10px' }}
              >
                ← Prev
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 bg-slate-700 text-slate-300 rounded text-xs hover:bg-slate-600
                  disabled:opacity-40 transition-colors"
                style={{ paddingTop: '10px', paddingBottom: '10px' }}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </Section>
    </div>
  )
}

function FilterInput({ label, value, onChange, placeholder, type = 'text', className = '' }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-slate-500 text-xs">{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white
          placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${className}`}
      />
    </div>
  )
}
