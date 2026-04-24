import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppContext } from '../context/AppContext.jsx'
import {
  fishDisplayName, calcPendingPearls, calcAlgaeFeedCost, calcLevel,
  isHungry, hungerRemainingMs, formatCountdown, calcEggCost,
  calcReleaseReward, calcPearlRate,
} from '../lib/reefUtils.js'
import {
  FISH_SIZE_PX, RARITY_COLORS, ICONS, fishImagePath, MAX_FISH,
} from '../config/reefConstants.js'
import { AlgaeIcon, PearlIcon, PearlAmount } from '../components/reef/ReefIcons.jsx'

// ── Swimming animation ────────────────────────────────────────────────────────

function useSwimPositions(fish) {
  const [positions, setPositions] = useState({})
  const posRef = useRef({})

  useEffect(() => {
    setPositions(prev => {
      const next = { ...prev }
      fish.forEach(f => {
        if (!next[f.id]) {
          const entry = {
            x:  10 + Math.random() * 75,
            y:  10 + Math.random() * 70,
            vx: (0.15 + Math.random() * 0.20) * (Math.random() > 0.5 ? 1 : -1),
            vy: (Math.random() * 0.08 - 0.04),
          }
          next[f.id] = entry
          posRef.current[f.id] = entry
        }
      })
      const ids = new Set(fish.map(f => f.id))
      Object.keys(next).forEach(id => { if (!ids.has(id)) delete next[id] })
      return next
    })
  }, [fish.map(f => f.id).join(',')])

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

// ── Fish sprite ───────────────────────────────────────────────────────────────

function FishSprite({ fish, pos, onTap, feedingMode, releaseMode }) {
  const [shaking, setShaking] = useState(false)
  const [hovered, setHovered] = useState(false)

  const hungry      = isHungry(fish)
  const pending     = calcPendingPearls(fish)
  const level       = fish.level ?? calcLevel(fish.feedings_count ?? 0)
  const size        = FISH_SIZE_PX[fish.rarity] ?? 72
  const facingRight = pos?.vx > 0
  const rate        = calcPearlRate(fish.rarity, level)
  const remainingMs = hungerRemainingMs(fish)

  const showAlgaeBadge = feedingMode && hungry
  const showPearlBadge = !feedingMode && !releaseMode && pending > 0
  const showPearlGlow  = !feedingMode && !releaseMode && pending > 0
  const dimmed         = feedingMode && !hungry

  function handleTap() {
    if (!releaseMode) {
      setShaking(true)
      setTimeout(() => setShaking(false), 500)
    }
    onTap(fish, pos)
  }

  let filterStyle = 'none'
  if (dimmed)         filterStyle = 'grayscale(60%) brightness(0.45)'
  else if (hungry)    filterStyle = 'grayscale(80%) brightness(0.55)'
  else if (showPearlGlow) filterStyle = 'brightness(1.12) drop-shadow(0 0 7px rgba(255,210,40,0.65))'

  return (
    <div
      onClick={handleTap}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
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
      {/* Hover tooltip — desktop only, normal mode */}
      {hovered && !feedingMode && !releaseMode && (
        <div
          className="absolute bottom-full mb-2 left-1/2 whitespace-nowrap
                     bg-zinc-900/95 border border-zinc-700 rounded-lg px-2.5 py-1.5
                     text-[11px] text-white leading-tight pointer-events-none"
          style={{ transform: `translateX(-50%) scaleX(${facingRight ? -1 : 1})`, zIndex: 20 }}
        >
          <div className="flex items-center gap-1 text-yellow-300">
            <img src={ICONS.pearl} alt="" style={{ width: 11, height: 11 }} />
            {rate.toFixed(1)}/hr
          </div>
          <div className={`mt-0.5 ${hungry ? 'text-orange-400' : 'text-zinc-400'}`}>
            {hungry ? 'Hungry!' : `Full: ${formatCountdown(remainingMs)}`}
          </div>
        </div>
      )}

      {/* Shake wrapper */}
      <div style={{
        animation: releaseMode
          ? 'fishShake 0.55s ease infinite'
          : shaking ? 'fishShake 0.5s ease' : 'none',
      }}>
        <div className="relative">
          {/* Algae badge in feeding mode */}
          {showAlgaeBadge && (
            <div
              className="absolute -top-7 left-1/2 animate-bounce"
              style={{ transform: `translateX(-50%) scaleX(${facingRight ? -1 : 1})`, zIndex: 10 }}
            >
              <img src={ICONS.algae} alt="feed" style={{ width: 22, height: 22 }} />
            </div>
          )}

          {/* Fish image */}
          <img
            src={fishImagePath(fish.rarity, fish.name)}
            alt={fishDisplayName(fish.name)}
            draggable={false}
            style={{
              width:      size,
              height:     size,
              objectFit:  'contain',
              filter:     filterStyle,
              transition: 'filter 0.4s ease',
            }}
          />

          {/* Pearl badge in normal mode */}
          {showPearlBadge && (
            <div
              className="absolute -top-3 -right-3 flex items-center gap-1
                         bg-zinc-900/95 rounded-full px-2 py-1
                         text-xs font-black text-yellow-300 border-2 border-yellow-400/80"
              style={{
                transform:  `scaleX(${facingRight ? -1 : 1})`,
                boxShadow:  '0 0 8px rgba(250,204,21,0.5)',
              }}
            >
              <img src={ICONS.pearl} alt="" style={{ width: 14, height: 14 }} />
              {pending}
            </div>
          )}
        </div>
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
          {t('reef.hatch')}
        </button>
      ) : (
        <span className="text-[10px] text-zinc-400 font-mono">{countdown}</span>
      )}
    </div>
  )
}

// ── Release confirmation modal ────────────────────────────────────────────────

function ReleaseConfirm({ fish, onConfirm, onCancel }) {
  const level  = fish.level ?? calcLevel(fish.feedings_count ?? 0)
  const reward = calcReleaseReward(fish.rarity, level)
  const col    = RARITY_COLORS[fish.rarity]

  return (
    <div
      className="absolute inset-0 flex items-center justify-center z-30"
      style={{ background: 'rgba(0,0,0,0.65)' }}
      onClick={onCancel}
    >
      <div
        className="bg-zinc-900 border rounded-2xl p-6 mx-6 text-center w-full max-w-xs"
        style={{ borderColor: col.border }}
        onClick={e => e.stopPropagation()}
      >
        <img
          src={fishImagePath(fish.rarity, fish.name)}
          alt={fishDisplayName(fish.name)}
          style={{ width: 72, height: 72, objectFit: 'contain', margin: '0 auto' }}
        />
        <p className="text-white font-bold mt-3 text-base">{fishDisplayName(fish.name)}</p>
        <p className="text-xs mt-0.5 font-medium" style={{ color: col.label }}>{fish.rarity} · Lv {level}</p>
        <div className="flex items-center justify-center gap-1.5 mt-3 text-zinc-300 text-sm">
          Release for
          <img src={ICONS.pearl} alt="" style={{ width: 14, height: 14 }} />
          <span className="font-bold text-yellow-300">{reward}</span>
          pearls?
        </div>
        <div className="flex gap-3 mt-5">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 bg-zinc-800 text-zinc-300 rounded-xl
                       font-semibold text-sm hover:bg-zinc-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 bg-rose-700 text-white rounded-xl
                       font-semibold text-sm hover:bg-rose-600 transition-colors"
          >
            Release
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ReefScreen() {
  const { t }    = useTranslation()
  const { reef } = useAppContext()
  const {
    loaded, pearls, algae, eggsPurchased,
    fish, eggs, feedFish, collectFromFish, releaseFish, buyEgg, claimEgg,
  } = reef

  const [feedingMode,  setFeedingMode]  = useState(false)
  const [releaseMode,  setReleaseMode]  = useState(false)
  const [releasingFish, setReleasingFish] = useState(null)
  const [floatLabels,  setFloatLabels]  = useState([])
  const [toast,        setToast]        = useState(null)
  const toastTimer = useRef(null)

  const positions   = useSwimPositions(fish)
  const hungryCount = fish.filter(isHungry).length
  const tankCount   = fish.length + eggs.length
  const nextEggCost = calcEggCost(eggsPurchased)
  const tankFull    = tankCount >= MAX_FISH

  // Exit release mode if releasing fish disappears
  useEffect(() => {
    if (releasingFish && !fish.find(f => f.id === releasingFish.id)) {
      setReleasingFish(null)
    }
  }, [fish])

  function showToast(msg) {
    clearTimeout(toastTimer.current)
    setToast({ msg, key: Date.now() })
    toastTimer.current = setTimeout(() => setToast(null), 2200)
  }

  function addFloat(label, x, y) {
    const id = Date.now() + Math.random()
    setFloatLabels(prev => [...prev, { id, label, x, y }])
    setTimeout(() => setFloatLabels(prev => prev.filter(f => f.id !== id)), 1300)
  }

  // ── Mode toggles ────────────────────────────────────────────────────────────

  function toggleFeedingMode() {
    setFeedingMode(prev => !prev)
    setReleaseMode(false)
    setReleasingFish(null)
  }

  function toggleReleaseMode() {
    setReleaseMode(prev => !prev)
    setFeedingMode(false)
    setReleasingFish(null)
  }

  // ── Fish tap handler ────────────────────────────────────────────────────────

  async function handleFishTap(f, pos) {
    if (releaseMode) {
      setReleasingFish(f)
      return
    }
    if (feedingMode) {
      if (!isHungry(f)) return
      const ok = await feedFish(f.id)
      if (!ok) {
        showToast('You ran out of algae')
        setFeedingMode(false)
      }
      return
    }
    // Normal mode: collect pending pearls
    const pending = calcPendingPearls(f)
    if (pending <= 0) return
    const earned = await collectFromFish(f.id)
    if (earned > 0 && pos) {
      addFloat(`+${earned}`, pos.x, pos.y)
    }
  }

  // ── Release confirmation ─────────────────────────────────────────────────────

  async function handleConfirmRelease() {
    if (!releasingFish) return
    const reward = await releaseFish(releasingFish.id)
    showToast(`+${reward} pearls`)
    setReleasingFish(null)
  }

  // ── Egg actions ──────────────────────────────────────────────────────────────

  async function handleBuyEgg() {
    if (tankFull) { showToast(t('reef.tank_full')); return }
    if (pearls < nextEggCost) { showToast(t('reef.not_enough_pearls')); return }
    await buyEgg()
    showToast(t('reef.toast_egg_bought'))
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
        backgroundImage: 'url("/Reef/Backgrounds/Reef%20Background.webp")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Dark overlay for readability */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'rgba(5,15,30,0.52)', zIndex: 0 }} />

      {/* ── Decorative bubbles ───────────────────────────────────────────── */}
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
        className="sticky top-0 z-10 flex items-center justify-between gap-2"
        style={{ background: 'rgba(7,21,40,0.88)', backdropFilter: 'blur(8px)', padding: '8px 16px' }}
      >
        {/* Left: fish count + release button */}
        <div className="flex items-center gap-1.5">
          <div
            className="flex items-center gap-1.5 bg-white/10 rounded-xl text-white text-sm font-semibold"
            style={{ padding: '8px 12px' }}
          >
            <svg className="w-4 h-4 opacity-70" viewBox="0 0 24 24" fill="currentColor">
              <ellipse cx="14" cy="12" rx="7" ry="4.5" />
              <polygon points="4,8 4,16 9,12" />
              <circle cx="18" cy="11" r="1" fill="#0c1e3c" />
            </svg>
            {fish.length}/{MAX_FISH}
          </div>
          <button
            onClick={toggleReleaseMode}
            className={`p-2 rounded-xl transition-colors ${
              releaseMode ? 'bg-rose-600 text-white' : 'bg-white/10 text-zinc-400 hover:text-zinc-200'
            }`}
            title="Release a fish"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>

        {/* Center: pearls + algae */}
        <div className="flex items-center gap-1.5">
          <div
            className="flex items-center gap-1.5 bg-white/10 rounded-xl text-white text-sm font-semibold"
            style={{ padding: '8px 14px' }}
          >
            <PearlIcon size={18} />
            {pearls}
          </div>
          <button
            onClick={toggleFeedingMode}
            className={`flex items-center gap-1.5 rounded-xl text-white text-sm font-semibold transition-colors ${
              feedingMode
                ? 'bg-emerald-600 ring-2 ring-emerald-400'
                : 'bg-white/10 hover:bg-white/15'
            }`}
            style={{ padding: '8px 14px' }}
          >
            <AlgaeIcon size={18} />
            {algae}
          </button>
        </div>

        {/* Right: hungry count */}
        <div className="flex items-center justify-end" style={{ minWidth: 44 }}>
          {hungryCount > 0 && (
            <div
              className={`flex items-center gap-1 rounded-xl text-white text-xs font-bold transition-colors ${
                feedingMode ? 'bg-emerald-600' : 'bg-orange-500'
              }`}
              style={{ padding: '8px 10px' }}
            >
              ⚠ {hungryCount}
            </div>
          )}
        </div>
      </div>

      {/* Mode banner — centered below HUD */}
      {(feedingMode || releaseMode) && (
        <div className="flex justify-center py-1.5" style={{ zIndex: 9 }}>
          {feedingMode && (
            <div className="bg-emerald-700/80 text-emerald-200 text-xs font-bold px-4 py-1 rounded-full animate-pulse">
              🌿 Feeding Mode — tap hungry fish
            </div>
          )}
          {releaseMode && (
            <div className="bg-rose-700/80 text-rose-200 text-xs font-bold px-4 py-1 rounded-full animate-pulse">
              ✕ Release Mode — tap a fish to release
            </div>
          )}
        </div>
      )}

      {/* ── Tank ─────────────────────────────────────────────────────────── */}
      <div
        className="relative flex-1"
        style={{ minHeight: '52vh', zIndex: 1 }}
      >
        {fish.length === 0 && eggs.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center px-8 text-center">
            <p className="text-zinc-500 text-sm">{t('reef.empty_tank')}</p>
          </div>
        )}

        {fish.map(f => (
          <FishSprite
            key={f.id}
            fish={f}
            pos={positions[f.id]}
            feedingMode={feedingMode}
            releaseMode={releaseMode}
            onTap={handleFishTap}
          />
        ))}

        {/* Float labels for pearl collection */}
        {floatLabels.map(fl => (
          <div
            key={fl.id}
            className="absolute pointer-events-none flex items-center gap-1.5
                       text-white text-xl font-black drop-shadow-xl"
            style={{
              left:       `${fl.x}%`,
              top:        `${fl.y}%`,
              transform:  'translate(-50%, -50%)',
              animation:  'floatUp 1.3s ease-out forwards',
              zIndex:     10,
              textShadow: '0 0 12px rgba(250,204,21,0.8), 0 2px 4px rgba(0,0,0,0.8)',
            }}
          >
            <img src={ICONS.pearl} alt="" style={{ width: 22, height: 22 }} />
            {fl.label}
          </div>
        ))}
      </div>

      {/* ── Bottom row: buy egg (left) + hatching eggs (right) ──────────── */}
      <div
        className="flex items-end gap-2 px-4 overflow-x-auto"
        style={{ paddingBottom: 88, paddingTop: 8, zIndex: 2 }}
      >
        {/* Buy egg button — always on left */}
        <button
          onClick={handleBuyEgg}
          disabled={tankFull}
          className="flex-shrink-0 flex items-center gap-3 rounded-2xl transition-all active:scale-95
                     disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: 'linear-gradient(135deg, #6d28d9, #9333ea)',
            border:     '1px solid rgba(167,139,250,0.4)',
            boxShadow:  '0 4px 20px rgba(109,40,217,0.4)',
            padding:    '20px',
          }}
        >
          <img src={ICONS.mysteryEgg} alt="egg" style={{ width: 40, height: 40, objectFit: 'contain' }} />
          <div className="text-left">
            <div className="text-purple-200 text-[10px]">{t('reef.mystery_egg')}</div>
            <div className="flex items-center gap-1 mt-0.5">
              <PearlIcon size={13} />
              <span className="text-white text-sm font-bold">{nextEggCost}</span>
            </div>
          </div>
        </button>

        {/* Hatching eggs extending to the right */}
        {eggs.map(egg => (
          <EggItem key={egg.id} egg={egg} onClaim={handleClaim} t={t} />
        ))}
      </div>

      {/* ── Release confirmation ─────────────────────────────────────────── */}
      {releasingFish && (
        <ReleaseConfirm
          fish={releasingFish}
          onConfirm={handleConfirmRelease}
          onCancel={() => setReleasingFish(null)}
        />
      )}

      {/* ── Toast ────────────────────────────────────────────────────────── */}
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

      {/* ── CSS keyframes ────────────────────────────────────────────────── */}
      <style>{`
        @keyframes floatBubble {
          from { transform: translateY(0); }
          to   { transform: translateY(-18px); }
        }
        @keyframes floatUp {
          0%   { opacity: 1; transform: translate(-50%, -50%) translateY(0); }
          100% { opacity: 0; transform: translate(-50%, -50%) translateY(-52px); }
        }
        @keyframes fadeInOut {
          0%   { opacity: 0; transform: translateX(-50%) translateY(-6px); }
          15%  { opacity: 1; transform: translateX(-50%) translateY(0); }
          75%  { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes fishShake {
          0%   { transform: translateX(0) rotate(0deg); }
          15%  { transform: translateX(-5px) rotate(-6deg); }
          30%  { transform: translateX(5px) rotate(6deg); }
          45%  { transform: translateX(-4px) rotate(-4deg); }
          60%  { transform: translateX(4px) rotate(4deg); }
          75%  { transform: translateX(-2px) rotate(-2deg); }
          100% { transform: translateX(0) rotate(0deg); }
        }
      `}</style>
    </div>
  )
}
