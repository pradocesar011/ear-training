import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase.js'
import { estimateHalfLife } from '../engines/srs.js'
import { INTERVAL_INTRODUCTION_ORDER } from '../config/constants.js'
import { Section } from './AdminDashboard.jsx'

export default function AdminIntervals() {
  const [srsItems, setSrsItems] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [sortCol,  setSortCol]  = useState('error_rate')
  const [sortDir,  setSortDir]  = useState('desc')

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const { data } = await supabase
      .from('srs_items')
      .select('interval_type, direction, correct_count, wrong_count, exposures, last_seen')
    setSrsItems(data ?? [])
    setLoading(false)
  }

  // Aggregate per interval + direction
  const rows = useMemo(() => {
    const map = {}

    srsItems.forEach(item => {
      const key = `${item.interval_type}|${item.direction}`
      if (!map[key]) {
        map[key] = {
          interval:   item.interval_type,
          direction:  item.direction,
          totalCorrect:   0,
          totalWrong:     0,
          totalExposures: 0,
          halfLives:      [],
          userCount:      0,
        }
      }
      const row = map[key]
      row.totalCorrect   += item.correct_count ?? 0
      row.totalWrong     += item.wrong_count ?? 0
      row.totalExposures += item.exposures ?? 0
      row.userCount      += 1

      const h = estimateHalfLife(item.correct_count, item.wrong_count, item.exposures)
      row.halfLives.push(h)
    })

    return Object.values(map).map(row => {
      const total      = row.totalCorrect + row.totalWrong
      const errorRate  = total > 0 ? row.totalWrong / total : 0
      const meanHL     = row.halfLives.length
        ? row.halfLives.reduce((a, b) => a + b, 0) / row.halfLives.length
        : 0
      const meanExp    = row.userCount > 0 ? row.totalExposures / row.userCount : 0

      return {
        interval:   row.interval,
        direction:  row.direction,
        error_rate: errorRate,
        total_attempts: total,
        mean_half_life: meanHL,
        mean_exposures: meanExp,
        user_count: row.userCount,
      }
    })
  }, [srsItems])

  // Collect all (interval, direction) pairs from the introduction order
  // so we can show items not yet introduced across any user
  const allPairs = INTERVAL_INTRODUCTION_ORDER.map(({ interval, direction }) => ({
    interval, direction,
  }))

  const presentKeys = new Set(rows.map(r => `${r.interval}|${r.direction}`))
  const notIntroduced = allPairs.filter(
    p => !presentKeys.has(`${p.interval}|${p.direction}`)
  )

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      let va = a[sortCol], vb = b[sortCol]
      return sortDir === 'asc' ? va - vb : vb - va
    })
  }, [rows, sortCol, sortDir])

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
  }

  const COLS = [
    { key: 'interval',       label: 'Interval'        },
    { key: 'direction',      label: 'Direction'       },
    { key: 'error_rate',     label: 'Error rate'      },
    { key: 'total_attempts', label: 'Attempts'        },
    { key: 'mean_half_life', label: 'Mean half-life'  },
    { key: 'mean_exposures', label: 'Mean exposures'  },
    { key: 'user_count',     label: 'Users'           },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64 text-slate-400">
        Loading…
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-white" style={{ paddingTop: '20px' }}>Global Intervals Analysis</h1>
      <p className="text-slate-500 text-sm -mt-4" style={{ paddingTop: '10px' }}>
        Aggregated SRS data across all users. Default sort: highest error rate first.
      </p>

      <Section title={`Active intervals — ${sorted.length}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 border-b border-slate-700 text-xs uppercase tracking-wide">
                {COLS.map(col => (
                  <th
                    key={col.key}
                    onClick={() => col.key !== 'interval' && col.key !== 'direction' && toggleSort(col.key)}
                    className={`text-left py-3 px-3 font-medium whitespace-nowrap
                      ${col.key !== 'interval' && col.key !== 'direction' ? 'cursor-pointer hover:text-white select-none' : ''}`}
                  >
                    {col.label}
                    {sortCol === col.key && (
                      <span className="ml-1 text-indigo-400">{sortDir === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(row => {
                const errPct = Math.round(row.error_rate * 100)
                const errColor = errPct >= 60 ? '#ef4444'
                  : errPct >= 35 ? '#f59e0b' : '#22c55e'
                return (
                  <tr key={`${row.interval}-${row.direction}`}
                    className="border-b border-slate-800/60 text-slate-300 hover:bg-slate-700/20">
                    <td className="py-3 px-3 font-mono font-bold text-indigo-300">{row.interval}</td>
                    <td className="py-3 px-3 capitalize text-slate-400">{row.direction}</td>
                    <td className="py-3 px-3 font-mono">
                      <span style={{ color: errColor }}>{errPct}%</span>
                    </td>
                    <td className="py-3 px-3 text-slate-400">{row.total_attempts}</td>
                    <td className="py-3 px-3 font-mono">{row.mean_half_life.toFixed(1)}d</td>
                    <td className="py-3 px-3 font-mono">{row.mean_exposures.toFixed(1)}</td>
                    <td className="py-3 px-3 text-slate-500">{row.user_count}</td>
                  </tr>
                )
              })}
              {!sorted.length && (
                <tr><td colSpan={7} className="py-10 text-center text-slate-500">No SRS data yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      {notIntroduced.length > 0 && (
        <Section title={`Not yet introduced by any user — ${notIntroduced.length}`}>
          <div className="flex flex-wrap gap-2">
            {notIntroduced.map(({ interval, direction }) => (
              <span
                key={`${interval}-${direction}`}
                className="text-xs px-2 py-1 bg-slate-700/50 text-slate-500 rounded-lg font-mono"
              >
                {interval} <span className="opacity-60 capitalize">{direction}</span>
              </span>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}
