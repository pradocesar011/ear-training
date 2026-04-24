/**
 * ReefScreen — The Sound Reef.
 *
 * Layout:
 *   • Sticky HUD: fish count / pearls / algae / hungry alert
 *   • Tank area (60vh): animated fish, tap to collect, feed button when hungry
 *   • Eggs strip: hatching eggs with countdown / hatch button
 *   • Bottom bar: buy-egg card (bottom-left) + Dive to Train button (center)
 *   • Selected fish panel: shown when a fish is tapped
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../context/AppContext.jsx'
import {
  fishDisplayName, calcPendingPearls, calcAlgaeFeedCost, calcLevel,
  isHungry, formatCountdown, calcEggCost, calcReleaseReward,
} from '../lib/reefUtils.js'
import {
  FISH_SIZE_PX, RARITY_COLORS, ICONS, fishImagePath, MAX_FISH,
} from '../config/reefConstants.js'
import { AlgaeAmount, PearlAmount, AlgaeIcon, PearlIcon } from '../components/reef/ReefIcons.jsx'

// ── Swimming animation ────────────────────────────────────────────────────────

function useSwimPositions(fish) {
  const [positions, setPositions] = useState({})
  const posRef = useRef({})

  // Initialise a position entry for any fish not yet tracked
  useEffect(() => {
    setPositions(prev => {
      const next = { ...prev }
      fish.forEach(f => {
        if (!next[f.id]) {
          const entry = {
            x:  10 + Math.random() * 75,   // % across tank
            y:  10 + Math.random() * 70,   // % down tank
            vx: (0.15 + Math.random() * 0.20) * (Math.random() > 0.5 ? 1 : -1),
            vy: (Math.random() * 0.08 - 0.04),
          }
          next[f.id] = entry
          posRef.current[f.id] = entry
        }
      })
      // Remove positions for fish that left the tank
      const ids = new Set(fish.map(f => f.id))
      Object.keys(next).forEach(id => { if (!ids.has(id)) delete next[id] })
      return next
    })
  }, [fish.map(f => f.id).join(',')])

  // Animation loop — 100 ms ticks, CSS transition smooths the rest
  useEffect(() => {
    if (fish.length === 0) return
    const id = setInterval(() => {
      const updated = {}
      fish.forEach(f => {
        const p = posRef.current[f.id]
        if (!p) return
        let { x, y, vx, vy } = p

        x += vx
        y += vy

        if (x < 4  || x > 88) { vx = -vx; x = Math.max(4, Math.min(88, x)) }
        if (y < 5  || y > 82) { vy = -vy; y = Math.max(5, Math.min(82, y)) }

        // Small random vertical drift
        if (Math.random() < 0.04) vy += (Math.random() - 0.5) * 0.06
        vy = Math.max(-0.12, Math.min(0.12, vy))

        posRef.current[f.id] = { x, y, vx, vy }
        updated[f.id] = { x, y, vx, vy }
      })
      setPositions(prev => ({ ...prev, ...updated }))
    }, 120)
    return () => clearInterval(id)
  }, [fish.map(f => f.id).join(',')])

  return positions
}

// ── Floating +N animation ─────────────────────────────────────────────────────

function FloatLabel({ label, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1200)
    return () => clearTimeout(t)
  }, [])
  return (
    <div
      className="pointer-events-none absolute left-1/2 -top-8 -translate-x-1/2
                 text-sm font-bold text-white drop-shadow-lg animate-bounce"
      style={{ animation: 'floatUp 1.2s ease-out forwards' }}
    >
      {label}
    </div>
  )
}

// ── Single fish sprite ────────────────────────────────────────────────────────

function FishSprite({ fish, pos, onTap, isSelected, t }) {
  const [floats, setFloats] = useState([])
  const hungry   = isHungry(fish)
  const pending  = calcPendingPearls(fish)
  const level    = fish.level ?? calcLevel(fish.feedings_count ?? 0)
  const size     = FISH_SIZE_PX[fish.rarity] ?? 72
  const facingRight = pos?.vx > 0
  const rarityColor = RARITY_COLORS[fish.rarity]

  function handleTap() {
    onTap(fish)
  }

  return (
    <div
      onClick={handleTap}
      style={{
        position:   'absolute',
        left:       `${pos?.x ?? 50}%`,
        top:        `${pos?.y ?? 50}%`,
        transform:  `translate(-50%, -50%) scaleX(${facingRight ? -1 : 1})`,
        transition: 'left 130ms linear, top 130ms linear',
        width:      size,
        cursor:     'pointer',
        userSelect: 'none',
        zIndex:     5,
      }}
    >
      <div className="relative">
        {/* Fish image */}
        <img
          src={fishImagePath(fish.rarity, fish.name)}
          alt={fishDisplayName(fish.name)}
          draggable={false}
          style={{
            width:  size,
            height: size,
            objectFit: 'contain',
            filter: hungry
              ? 'grayscale(80%) brightness(0.55)'
              : isSelected ? 'brightness(1.25) drop-shadow(0 0 8px rgba(255,255,255,0.6))' : 'none',
            transition: 'filter 0.4s ease',
          }}
        />

        {/* Pending pearls badge */}
        {pending > 0 && !hungry && (
          <div
            className="absolute -top-2 -right-2 flex items-center gap-0.5
                       bg-zinc-900/90 rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white border border-yellow-500/60"
            style={{ transform: `scaleX(${facingRight ? -1 : 1})` }}
          >
            <img src={ICONS.pearl} alt="" style={{ width: 10, height: 10 }} />
            {pending}
          </div>
        )}

        {/* Feed button when hungry */}
        {hungry && (
          <div
            className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap
                       bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ transform: `translateX(-50%) scaleX(${facingRight ? -1 : 1})` }}
          >
            {t('reef.feed')}
          </div>
        )}

        {/* Floating collect labels */}
        {floats.map(f => (
          <FloatLabel key={f.id} label={f.label} onDone={() =>
            setFloats(prev => prev.filter(x => x.id !== f.id))
          } />
        ))}
      </div>
    </div>
  )
}

// ── Egg strip item ────────────────────────────────────────────────────────────

function EggItem({ egg, onClaim, t }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const hatchesAt  = new Date(egg.hatches_at).getTime()
  const remaining  = hatchesAt - now
  const ready      = remaining <= 0
  const countdown  = formatCountdown(remaining)
  const rarityColor = RARITY_COLORS[egg.rarity]

  return (
    <div
      className="flex flex-col items-center gap-1 bg-zinc-900/80 border rounded-xl p-2"
      style={{ borderColor: rarityColor.border, minWidth: 72 }}
    >
      <img
        src={ready ? ICONS.egg : ICONS.mysteryEggHatching}
        alt="egg"
        style={{ width: 44, height: 44, objectFit: 'contain' }}
      />
      <span className="text-[9px] font-medium" style={{ color: rarityColor.label }}>
        {egg.rarity}
      </span>
      {ready ? (
        <button
          onClick={() => onClaim(egg.id)}
          className="w-full text-[10px] font-bold bg-emerald-600 hover:bg-emerald-500
                     text-white rounded-lg py-1 transition-colors"
        >
          {t('reef.egg_ready')}
        </button>
      ) : (
        <span className="text-[10px] text-zinc-400 font-mono">{countdown}</span>
      )}
    </div>
  )
}

// ── Selected fish panel ───────────────────────────────────────────────────────

function FishPanel({ fish, algae, onFeed, onCollect, onRelease, onClose, t }) {
  const [releasing, setReleasing] = useState(false)
  const level     = fish.level ?? calcLevel(fish.feedings_count ?? 0)
  const feedCost  = calcAlgaeFeedCost(fish.rarity, level)
  const hungry    = isHungry(fish)
  const pending   = calcPendingPearls(fish)
  const reward    = calcReleaseReward(fish.rarity, level)
  const rarityCol = RARITY_COLORS[fish.rarity]

  return (
    <div
      className="absolute bottom-0 inset-x-0 z-20 bg-zinc-950/95 border-t rounded-t-2xl px-4 py-4"
      style={{ borderColor: rarityCol.border }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <img
            src={fishImagePath(fish.rarity, fish.name)}
            alt={fishDisplayName(fish.name)}
            style={{ width: 52, height: 52, objectFit: 'contain' }}
          />
          <div>
            <p className="text-white font-bold text-sm">{fishDisplayName(fish.name)}</p>
            <p className="text-xs font-medium" style={{ color: rarityCol.label }}>
              {fish.rarity} · {t('reef.level', { n: level })}
            </p>
          </div>
        </div>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 p-1">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex gap-2">
        {/* Collect */}
        <button
          onClick={onCollect}
          disabled={pending <= 0}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl
                     bg-yellow-600/20 border border-yellow-600/40 text-yellow-300 text-sm font-semibold
                     hover:bg-yellow-600/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <PearlIcon size={16} />
          {pending > 0 ? `+${pending}` : '0'}
        </button>

        {/* Feed */}
        <button
          onClick={onFeed}
          disabled={!hungry || algae < feedCost}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl
                     bg-emerald-600/20 border border-emerald-600/40 text-emerald-300 text-sm font-semibold
                     hover:bg-emerald-600/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <AlgaeIcon size={16} />
          {feedCost}
        </button>

        {/* Release */}
        {releasing ? (
          <button
            onClick={() => { onRelease(); setReleasing(false) }}
            className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl
                       bg-rose-700/30 border border-rose-600 text-rose-300 text-sm font-semibold
                       hover:bg-rose-700/50 transition-colors"
          >
            <PearlIcon size={14} />+{reward}?
          </button>
        ) : (
          <button
            onClick={() => setReleasing(true)}
            className="flex items-center justify-center px-3 py-2.5 rounded-xl
                       bg-zinc-800 border border-zinc-700 text-zinc-400 text-sm
                       hover:bg-zinc-700 transition-colors"
            title={t('reef.release')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        )}
      </div>

      {/* Hunger status */}
      {!hungry && (
        <p className="text-center text-[10px] text-zinc-500 mt-2">
          {t('reef.feed')} costs <AlgaeAmount amount={feedCost} size={12} /> · producing <PearlAmount amount={`${(calcPendingPearls(fish))}+`} size={12} />
        </p>
      )}
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ReefScreen() {
  const { t }    = useTranslation()
  const navigate = useNavigate()
  const { reef } = useAppContext()
  const {
    loaded, pearls, algae, eggsPurchased,
    fish, eggs, feedFish, collectFromFish, releaseFish, buyEgg, claimEgg,
  } = reef

  const [selectedFish, setSelectedFish] = useState(null)
  const [toast,        setToast]        = useState(null)   // { msg, key }
  const toastTimer = useRef(null)

  const positions    = useSwimPositions(fish)
  const hungryCount  = fish.filter(isHungry).length
  const tankCount    = fish.length + eggs.length
  const nextEggCost  = calcEggCost(eggsPurchased)
  const canBuyEgg    = tankCount < MAX_FISH && pearls >= nextEggCost
  const tankFull     = tankCount >= MAX_FISH

  // Dismiss selected fish if it's released or no longer exists
  useEffect(() => {
    if (selectedFish && !fish.find(f => f.id === selectedFish.id)) {
      setSelectedFish(null)
    }
  }, [fish])

  function showToast(msg) {
    clearTimeout(toastTimer.current)
    setToast({ msg, key: Date.now() })
    toastTimer.current = setTimeout(() => setToast(null), 2200)
  }

  async function handleTap(f) {
    // If another fish is selected, switch to this one
    if (selectedFish?.id === f.id) {
      setSelectedFish(null)
      return
    }
    setSelectedFish(f)
  }

  async function handleCollect() {
    if (!selectedFish) return
    const earned = await collectFromFish(selectedFish.id)
    if (earned > 0) showToast(`+${earned} ${t('reef.pearls')}`)
    else showToast(t('reef.nothing_yet'))
    // Refresh selected fish state from updated fish array
    setSelectedFish(prev => fish.find(f => f.id === prev?.id) ?? null)
  }

  async function handleFeed() {
    if (!selectedFish) return
    const ok = await feedFish(selectedFish.id)
    if (!ok) showToast(t('reef.not_enough_algae'))
    setSelectedFish(prev => fish.find(f => f.id === prev?.id) ?? null)
  }

  async function handleRelease() {
    if (!selectedFish) return
    const reward = await releaseFish(selectedFish.id)
    showToast(`+${reward} ${t('reef.pearls')}`)
    setSelectedFish(null)
  }

  async function handleBuyEgg() {
    if (!canBuyEgg) {
      if (tankFull)           showToast(t('reef.tank_full'))
      else if (pearls < nextEggCost) showToast(t('reef.not_enough_pearls'))
      return
    }
    await buyEgg()
  }

  async function handleClaim(eggId) {
    await claimEgg(eggId)
  }

  if (!loaded) {
    return (
      <div className="flex items-center justify-center min-h-full text-zinc-400">
        {t('reef.loading')}
      </div>
    )
  }

  return (
    <div
      className="relative flex flex-col"
      style={{
        minHeight: '100%',
        background: 'linear-gradient(180deg, #0c1e3c 0%, #0e2a50 40%, #0a1f3d 70%, #071528 100%)',
      }}
      onClick={() => setSelectedFish(null)}
    >
      {/* ── Decorative bubbles (pure CSS) ────────────────────────────────── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full border border-white/10"
            style={{
              width:     6 + (i % 4) * 4,
              height:    6 + (i % 4) * 4,
              left:      `${10 + i * 11}%`,
              bottom:    `${10 + (i * 7) % 60}%`,
              opacity:   0.15 + (i % 3) * 0.08,
              animation: `floatBubble ${4 + (i % 3)}s ease-in-out ${i * 0.7}s infinite alternate`,
            }}
          />
        ))}
      </div>

      {/* ── HUD ──────────────────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-10 flex items-center justify-between px-3 py-2.5 gap-2"
        style={{ background: 'rgba(7,21,40,0.85)', backdropFilter: 'blur(8px)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Fish count */}
        <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1.5 text-white text-sm font-semibold">
          <svg className="w-4 h-4 opacity-80" viewBox="0 0 24 24" fill="currentColor">
            <ellipse cx="14" cy="12" rx="7" ry="4.5" />
            <polygon points="4,8 4,16 9,12" />
            <circle cx="18" cy="11" r="1" fill="#0c1e3c" />
          </svg>
          {fish.length}/{MAX_FISH}
        </div>

        {/* Pearls */}
        <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1.5 text-white text-sm font-semibold">
          <PearlIcon size={18} />
          {pearls}
        </div>

        {/* Algae */}
        <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1.5 text-white text-sm font-semibold">
          <AlgaeIcon size={18} />
          {algae}
        </div>

        {/* Hungry alert */}
        {hungryCount > 0 && (
          <div className="flex items-center gap-1 bg-orange-500 rounded-full px-3 py-1.5 text-white text-xs font-bold">
            ⚠ {t('reef.hungry_alert', { count: hungryCount })}
          </div>
        )}
      </div>

      {/* ── Tank area — fish swim here ────────────────────────────────────── */}
      <div
        className="relative flex-1"
        style={{ minHeight: '52vh', zIndex: 1 }}
        onClick={e => { e.stopPropagation(); setSelectedFish(null) }}
      >
        {fish.length === 0 && eggs.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-zinc-500 text-sm">{t('reef.empty_tank')}</p>
          </div>
        )}

        {fish.map(f => (
          <FishSprite
            key={f.id}
            fish={f}
            pos={positions[f.id]}
            isSelected={selectedFish?.id === f.id}
            onTap={handleTap}
            t={t}
          />
        ))}
      </div>

      {/* ── Eggs strip ───────────────────────────────────────────────────── */}
      {eggs.length > 0 && (
        <div
          className="flex gap-2 px-3 py-2 overflow-x-auto"
          style={{ zIndex: 2 }}
          onClick={e => e.stopPropagation()}
        >
          {eggs.map(egg => (
            <EggItem key={egg.id} egg={egg} onClaim={handleClaim} t={t} />
          ))}
        </div>
      )}

      {/* ── Bottom controls ───────────────────────────────────────────────── */}
      <div
        className="flex items-end justify-between px-4 pb-4 pt-2 gap-3"
        style={{ zIndex: 2 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Buy egg card */}
        <button
          onClick={handleBuyEgg}
          disabled={tankFull}
          className="flex flex-col items-center rounded-2xl p-3 transition-all active:scale-95
                     disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background:   'linear-gradient(135deg, #6d28d9, #9333ea)',
            border:       '1px solid rgba(167,139,250,0.4)',
            minWidth:     80,
            boxShadow:    '0 4px 20px rgba(109,40,217,0.4)',
          }}
        >
          <img
            src={ICONS.mysteryEgg}
            alt="egg"
            style={{ width: 44, height: 44, objectFit: 'contain' }}
          />
          <div className="flex items-center gap-1 mt-1">
            <PearlIcon size={13} />
            <span className="text-white text-xs font-bold">{nextEggCost}</span>
          </div>
          <span className="text-purple-200 text-[9px] mt-0.5">{t('reef.mystery_egg')}</span>
        </button>

        {/* Dive to Train */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 px-6 py-3.5 rounded-2xl text-white font-bold text-base
                     transition-all active:scale-95"
          style={{
            background: 'linear-gradient(135deg, #0891b2, #0e7490)',
            boxShadow:  '0 4px 20px rgba(8,145,178,0.4)',
          }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 10c.5-.5 1-.8 2-1 2 0 2.5 2 4.5 2s2.5-2 4.5-2 2.5 2 4.5 2 2-1 2.5-1
                 M3 17c.5-.5 1-.8 2-1 2 0 2.5 2 4.5 2s2.5-2 4.5-2 2.5 2 4.5 2 2-1 2.5-1" />
          </svg>
          {t('reef.dive_to_train')}
        </button>
      </div>

      {/* ── Selected fish panel ───────────────────────────────────────────── */}
      {selectedFish && (
        <div onClick={e => e.stopPropagation()}>
          <FishPanel
            fish={fish.find(f => f.id === selectedFish.id) ?? selectedFish}
            algae={algae}
            onFeed={handleFeed}
            onCollect={handleCollect}
            onRelease={handleRelease}
            onClose={() => setSelectedFish(null)}
            t={t}
          />
        </div>
      )}

      {/* ── Toast ─────────────────────────────────────────────────────────── */}
      {toast && (
        <div
          key={toast.key}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50
                     bg-zinc-900/95 text-white text-sm font-semibold
                     px-4 py-2 rounded-full border border-zinc-700/60
                     pointer-events-none"
          style={{ animation: 'fadeInOut 2.2s ease-out forwards' }}
        >
          {toast.msg}
        </div>
      )}

      {/* ── CSS keyframes ─────────────────────────────────────────────────── */}
      <style>{`
        @keyframes floatBubble {
          from { transform: translateY(0); }
          to   { transform: translateY(-18px); }
        }
        @keyframes floatUp {
          0%   { opacity: 1; transform: translateX(-50%) translateY(0); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-40px); }
        }
        @keyframes fadeInOut {
          0%   { opacity: 0; transform: translateX(-50%) translateY(-6px); }
          15%  { opacity: 1; transform: translateX(-50%) translateY(0); }
          75%  { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}
