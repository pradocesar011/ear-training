import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { objectsToCSV, downloadCSV, formatPrecision, formatDuration } from '../lib/utils.js'
import { Section } from './AdminDashboard.jsx'

export default function AdminActions() {
  const [exportLoading,  setExportLoading]  = useState(false)
  const [dateFrom,       setDateFrom]       = useState('')
  const [dateTo,         setDateTo]         = useState('')
  const [anonymize,      setAnonymize]      = useState(false)
  const [resetCode,      setResetCode]      = useState('')
  const [resetConfirm,   setResetConfirm]   = useState('')
  const [resetPhase,     setResetPhase]     = useState('idle')  // idle | confirm | done | error
  const [resetMsg,       setResetMsg]       = useState('')

  // ── CSV Export ────────────────────────────────────────────────────────────

  async function handleExport() {
    setExportLoading(true)
    try {
      let usersQuery    = supabase.from('users').select('id, code, created_at, language')
      let sessionsQuery = supabase.from('sessions').select('*').not('ended_at', 'is', null)
      let exercisesQuery = supabase.from('exercises').select('*')
      let srsQuery      = supabase.from('srs_items').select('*')

      if (dateFrom) {
        sessionsQuery  = sessionsQuery.gte('started_at', dateFrom)
        exercisesQuery = exercisesQuery.gte('created_at', dateFrom)
      }
      if (dateTo) {
        const toEnd = dateTo + 'T23:59:59Z'
        sessionsQuery  = sessionsQuery.lte('started_at', toEnd)
        exercisesQuery = exercisesQuery.lte('created_at', toEnd)
      }

      const [
        { data: users },
        { data: sessions },
        { data: exercises },
        { data: srsItems },
      ] = await Promise.all([usersQuery, sessionsQuery, exercisesQuery, srsQuery])

      // Optionally anonymize: replace codes with sequential IDs
      const codeMap = {}
      if (anonymize) {
        ;(users ?? []).forEach((u, i) => { codeMap[u.id] = `USER${String(i + 1).padStart(3, '0')}` })
      }
      const resolveCode = (id, code) => anonymize ? (codeMap[id] ?? code) : code

      const usersCSV = objectsToCSV((users ?? []).map(u => ({
        code:       resolveCode(u.id, u.code),
        registered: u.created_at,
        language:   u.language,
      })))
      const sessionsCSV = objectsToCSV((sessions ?? []).map(s => ({
        user_code:       resolveCode(s.user_id, s.user_id),
        session_id:      s.id,
        started_at:      s.started_at,
        ended_at:        s.ended_at,
        exercises_count: s.exercises_count,
        idm_start:       s.idm_start,
        idm_end:         s.idm_end,
        duration_sec: s.ended_at
          ? Math.floor((new Date(s.ended_at) - new Date(s.started_at)) / 1000)
          : '',
      })))
      const exercisesCSV = objectsToCSV((exercises ?? []).map(ex => ({
        user_code:    resolveCode(ex.user_id, ex.user_id),
        session_id:   ex.session_id,
        created_at:   ex.created_at,
        idm:          ex.idm,
        d_bar:        ex.d_bar,
        s:            ex.s,
        c:            ex.c,
        x:            ex.x,
        n_chunks:     ex.n_chunks,
        d_density:    ex.d_density,
        r:            ex.r,
        h:            ex.h,
        auditions_used: ex.auditions_used,
        precision:    ex.precision,
        response_time: ex.response_time,
      })))
      const srsCSV = objectsToCSV((srsItems ?? []).map(item => ({
        user_code:     resolveCode(item.user_id, item.user_id),
        interval_type: item.interval_type,
        direction:     item.direction,
        leitner_box:   item.leitner_box,
        exposures:     item.exposures,
        correct_count: item.correct_count,
        wrong_count:   item.wrong_count,
        last_seen:     item.last_seen,
        next_review:   item.next_review,
      })))

      const suffix = anonymize ? '_anon' : ''
      downloadCSV(`users${suffix}.csv`, usersCSV)
      setTimeout(() => downloadCSV(`sessions${suffix}.csv`, sessionsCSV), 200)
      setTimeout(() => downloadCSV(`exercises${suffix}.csv`, exercisesCSV), 400)
      setTimeout(() => downloadCSV(`srs_items${suffix}.csv`, srsCSV), 600)
    } finally {
      setExportLoading(false)
    }
  }

  // ── Reset user ────────────────────────────────────────────────────────────

  async function handleResetSubmit(e) {
    e.preventDefault()
    if (!resetCode.trim()) return
    setResetPhase('confirm')
  }

  async function handleResetConfirm() {
    if (resetConfirm.trim().toUpperCase() !== resetCode.trim().toUpperCase()) {
      setResetMsg('Codes do not match.')
      return
    }

    // Look up user by code
    const { data: user } = await supabase
      .from('users').select('id').eq('code', resetCode.trim().toUpperCase()).single()

    if (!user) {
      setResetMsg(`No user found with code "${resetCode.trim().toUpperCase()}".`)
      setResetPhase('error')
      return
    }

    await Promise.all([
      supabase.from('srs_items').delete().eq('user_id', user.id),
      supabase.from('exercises').delete().eq('user_id', user.id),
      supabase.from('sessions').delete().eq('user_id', user.id),
    ])

    setResetMsg(`Progress for ${resetCode.trim().toUpperCase()} has been reset.`)
    setResetPhase('done')
    setResetCode('')
    setResetConfirm('')
    setTimeout(() => setResetPhase('idle'), 4000)
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-white" style={{ paddingTop: '20px' }}>Actions</h1>

      {/* ── CSV Export ────────────────────────────────────────────── */}
      <Section title="Export data as CSV">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-zinc-500 text-xs">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white
                focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-zinc-500 text-xs">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white
                focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          <label className="flex items-center gap-2 text-zinc-300 text-sm cursor-pointer select-none pb-2">
            <input
              type="checkbox"
              checked={anonymize}
              onChange={e => setAnonymize(e.target.checked)}
              className="accent-indigo-500"
            />
            Anonymize user codes
          </label>
          <button
            onClick={handleExport}
            disabled={exportLoading}
            className="px-5 py-2 bg-cyan-600 text-white rounded-lg text-sm font-medium
              hover:bg-cyan-500 disabled:opacity-40 transition-colors" style={{ paddingTop: '10px', paddingBottom: '10px' }}
          >
            {exportLoading ? 'Exporting…' : 'Export 4 CSV files'}
          </button>
        </div>
        <p className="text-zinc-500 text-xs" style={{ paddingTop: '10px' }}>
          Exports users, sessions, exercises, and SRS items as separate CSV files.
          Leave dates empty to export all data.
        </p>
      </Section>

      {/* ── Reset user ────────────────────────────────────────────── */}
      <div className="bg-rose-950/30 border border-rose-900/40 rounded-xl" style={{ padding: '20px' }}>
        <h3 className="text-rose-500 text-xs font-medium uppercase tracking-widest" style={{ paddingBottom: '10px' }}>
          Reset user progress
        </h3>

        {resetPhase === 'idle' && (
          <form onSubmit={handleResetSubmit} className="flex gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-zinc-500 text-xs">User code</label>
              <input
                value={resetCode}
                onChange={e => setResetCode(e.target.value.toUpperCase())}
                placeholder="e.g. AB3X7K"
                maxLength={6}
                className="bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white
                  font-mono tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-rose-500
                  w-40"
              />
            </div>
            <button
              type="submit"
              disabled={!resetCode.trim()}
              className="px-5 py-2 bg-rose-950/50 border border-rose-800/60 text-rose-400 rounded-lg text-sm
                hover:bg-rose-950/80 disabled:opacity-40 transition-colors" style={{ paddingTop: '10px', paddingBottom: '10px' }}
            >
              Reset…
            </button>
          </form>
        )}

        {resetPhase === 'confirm' && (
          <div className="flex flex-col gap-3 max-w-sm">
            <p className="text-rose-400 text-sm">
              This will permanently delete all sessions, exercises and SRS data for{' '}
              <span className="font-mono font-bold">{resetCode}</span>.
              Type the code again to confirm.
            </p>
            <input
              value={resetConfirm}
              onChange={e => { setResetConfirm(e.target.value.toUpperCase()); setResetMsg('') }}
              placeholder="Re-enter code"
              maxLength={6}
              className="bg-zinc-950 border border-rose-700 rounded-lg px-3 py-2 text-sm text-white
                font-mono tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-rose-500 w-40"
            />
            {resetMsg && <p className="text-rose-500 text-xs">{resetMsg}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => { setResetPhase('idle'); setResetConfirm(''); setResetMsg('') }}
                className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg text-sm hover:bg-zinc-800 transition-colors" style={{ paddingTop: '10px', paddingBottom: '10px' }}
              >
                Cancel
              </button>
              <button
                onClick={handleResetConfirm}
                className="px-4 py-2 bg-rose-700 text-white rounded-lg text-sm hover:bg-rose-600 transition-colors" style={{ paddingTop: '10px', paddingBottom: '10px' }}
              >
                Confirm reset
              </button>
            </div>
          </div>
        )}

        {(resetPhase === 'done' || resetPhase === 'error') && (
          <p className={`text-sm ${resetPhase === 'done' ? 'text-emerald-400' : 'text-rose-500'}`}>
            {resetMsg}
          </p>
        )}
      </div>

      {/* ── Error log ─────────────────────────────────────────────── */}
      <Section title="System error log">
        <p className="text-zinc-500 text-sm py-4 text-center">
          No error log table configured. Errors are currently not persisted server-side.
        </p>
      </Section>
    </div>
  )
}
