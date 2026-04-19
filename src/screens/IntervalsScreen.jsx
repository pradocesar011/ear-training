import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase.js'
import { useAppContext } from '../context/AppContext.jsx'
import { estimateHalfLife, recallProbability } from '../engines/srs.js'
import { INTERVAL_INTRODUCTION_ORDER } from '../config/constants.js'

const BOX_DESCS = ['box_desc_1', 'box_desc_2', 'box_desc_3', 'box_desc_4', 'box_desc_5']

const BOX_COLORS = {
  1: { dot: 'bg-rose-400',     border: 'border-rose-900/40',     text: 'text-rose-500' },
  2: { dot: 'bg-orange-400',  border: 'border-orange-900/40',  text: 'text-orange-400' },
  3: { dot: 'bg-orange-400',  border: 'border-orange-900/40',  text: 'text-orange-400' },
  4: { dot: 'bg-emerald-400',   border: 'border-emerald-900/40',   text: 'text-emerald-400' },
  5: { dot: 'bg-emerald-400', border: 'border-emerald-900/40', text: 'text-emerald-400' },
}

export default function IntervalsScreen() {
  const { t } = useTranslation()
  const { user } = useAppContext()

  const [srsItems, setSrsItems] = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    if (user.userId) fetchItems()
  }, [user.userId])

  async function fetchItems() {
    setLoading(true)
    const { data } = await supabase
      .from('srs_items')
      .select('*')
      .eq('user_id', user.userId)
    setSrsItems(data ?? [])
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-full text-zinc-400">
        {t('common.loading')}
      </div>
    )
  }

  if (!srsItems.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full px-6 gap-3">
        <p className="text-zinc-400 text-center">{t('intervals_screen.no_intervals_yet')}</p>
      </div>
    )
  }

  // ── Enrich items ─────────────────────────────────────────────────────────
  const now = new Date()
  const enriched = srsItems.map(item => {
    const h = estimateHalfLife(item.correct_count, item.wrong_count, item.exposures)
    const lastSeen   = item.last_seen ? new Date(item.last_seen) : null
    const deltaDays  = lastSeen ? (now - lastSeen) / (1000 * 60 * 60 * 24) : 0
    const recall     = recallProbability(deltaDays, h)
    const nextReview = item.next_review ? new Date(item.next_review) : null
    const isOverdue  = nextReview ? nextReview < now : false
    const isDueToday = nextReview ? nextReview.toDateString() === now.toDateString() : false
    return { ...item, recall, nextReview, isOverdue, isDueToday }
  })

  const boxes = [1, 2, 3, 4, 5].map(box => ({
    box,
    items: enriched.filter(item => item.leitner_box === box),
  })).filter(b => b.items.length > 0)

  const lockedIntervals = INTERVAL_INTRODUCTION_ORDER.filter(
    intro => !srsItems.some(
      item => item.interval_type === intro.interval && item.direction === intro.direction
    )
  )

  return (
    <div className="screen-enter flex flex-col items-center min-h-full px-4 py-8 gap-8">
      <h1 className="text-2xl font-bold text-white text-center w-full max-w-2xl"style={{ paddingTop: '20px' }}>{t('intervals_screen.heading')}</h1>
      <div className="w-full max-w-2xl flex flex-col gap-8">

      {/* Leitner boxes */}
      {boxes.map(({ box, items }) => {
        const colors = BOX_COLORS[box] ?? BOX_COLORS[1]
        return (
          <div key={box}>
            {/* Box header */}
            <div className="flex items-center gap-2 mb-3" style={{ paddingBottom: '10px' }}>
              <div className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
              <span className={`text-sm font-semibold ${colors.text}`}>
                {t('intervals_screen.box_label', { n: box })}
              </span>
              <span className="text-zinc-500 text-xs">
                {t(`intervals_screen.${BOX_DESCS[box - 1]}`)}
              </span>
              <span className="text-zinc-500 text-xs ml-auto">{items.length}</span>
            </div>

            {/* Card grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {items.map(item => (
                <IntervalCard key={`${item.interval_type}-${item.direction}`} item={item} t={t} now={now} />
              ))}
            </div>
          </div>
        )
      })}

      {/* Locked */}
      {lockedIntervals.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3" style={{ padding: '10px' }}>
            <div className="w-2.5 h-2.5 rounded-full bg-zinc-800" />
            <span className="text-zinc-500 text-sm font-semibold">
              {t('intervals_screen.locked')}
            </span>
            <span className="text-zinc-500 text-xs">
              {t('intervals_screen.locked_desc')}
            </span>
            <span className="text-zinc-500 text-xs ml-auto">{lockedIntervals.length}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {lockedIntervals.slice(0, 9).map(({ interval, direction }) => (
              <div
                key={`${interval}-${direction}`}
                className="bg-zinc-900/40 border border-zinc-800/30 rounded-xl p-3 opacity-40" style={{ padding: '5px' }}
              >
                <div className="flex items-start justify-between mb-1">
                  <span className="text-zinc-400 text-sm font-medium leading-tight">
                    {t(`intervals.${interval}`)}
                  </span>
                  <svg className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </div>
                <span className="text-zinc-500 text-xs">{t(`intervals.${direction}`)}</span>
              </div>
            ))}
            {lockedIntervals.length > 9 && (
              <div className="bg-zinc-900/40 border border-zinc-800/30 rounded-xl p-3 opacity-40 flex items-center justify-center" style={{ padding: '5px' }}>
                <span className="text-zinc-500 text-sm">+{lockedIntervals.length - 9}</span>
              </div>
            )}
          </div>
        </div>
      )}

      </div>{/* /max-w-2xl */}
    </div>
  )
}

// ── Interval Card ─────────────────────────────────────────────────────────────

function IntervalCard({ item, t, now }) {
  const pct = Math.round(item.recall * 100)
  const recallColor  = pct >= 70 ? '#10b981' : pct >= 40 ? '#f97316' : '#ef4444'
  const borderClass  = pct >= 70 ? 'border-emerald-800/50'  : pct >= 40 ? 'border-orange-800/50'  : 'border-rose-800/50'
  const bgInline     = pct >= 70 ? 'rgba(20,83,45,0.12)'  : pct >= 40 ? 'rgba(92,55,5,0.12)'   : 'rgba(69,10,10,0.12)'

  let reviewLabel = '—'
  if (item.nextReview) {
    if (item.isOverdue)      reviewLabel = t('intervals_screen.overdue')
    else if (item.isDueToday) reviewLabel = t('intervals_screen.today')
    else                      reviewLabel = item.nextReview.toLocaleDateString()
  }
  const reviewColor = item.isOverdue ? 'text-rose-500' : item.isDueToday ? 'text-orange-400' : 'text-zinc-500'

  return (
    <div
      className={`border ${borderClass} bg-zinc-900 rounded-xl p-4 flex flex-col gap-2.5`}
      style={{ backgroundColor: bgInline, padding: '20px' }}
    >
      {/* Name + direction */}
      <div>
        <p className="text-zinc-100 text-sm font-semibold leading-tight">
          {t(`intervals.${item.interval_type}`)}
        </p>
        <p className="text-zinc-500 text-xs mt-0.5">{t(`intervals.${item.direction}`)}</p>
      </div>

      {/* Recall badge + bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, backgroundColor: recallColor }}
          />
        </div>
        <span className="text-xs font-mono font-bold flex-shrink-0" style={{ color: recallColor }}>
          {pct}%
        </span>
      </div>

      {/* Stats row */}
      <div className="flex justify-between text-xs text-zinc-500">
        <span>{item.exposures}× {t('intervals_screen.exposures').toLowerCase()}</span>
        <span className="text-emerald-500/70">{item.correct_count ?? 0}✓</span>
        <span className="text-rose-500/70">{item.wrong_count ?? 0}✗</span>
      </div>

      {/* Next review */}
      <p className={`text-xs ${reviewColor}`}>
        {t('intervals_screen.next_review')}: {reviewLabel}
      </p>
    </div>
  )
}
