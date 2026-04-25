import {
  FISH_LISTS, RARITY_WEIGHTS,
  PEARL_RATE_PER_HOUR, MAX_LEVEL, FEEDINGS_PER_LEVEL,
  HUNGER_MS, HUNGER_LEVEL_FACTOR, EGG_BASE_PRICE, EGG_MULTIPLIER, RELEASE_BASE,
} from '../config/reefConstants.js'

// ── Fish state ────────────────────────────────────────────────────────────────

export function calcLevel(feedingsCount) {
  return Math.min(MAX_LEVEL, Math.floor(feedingsCount / FEEDINGS_PER_LEVEL) + 1)
}

// Hunger window grows +12% per level: Common 8h→17h, Rare 16h→34h, Legendary 32h→67h (Lv1→10)
export function calcHungerMs(rarity, level) {
  const base = HUNGER_MS[rarity] ?? HUNGER_MS.Common
  return base * (1 + HUNGER_LEVEL_FACTOR * (level - 1))
}

// Fixed feed cost per rarity — level affects hunger duration, not cost
export function calcAlgaeFeedCost(rarity) {
  const costs = { Common: 1, Rare: 2, Legendary: 4 }
  return costs[rarity] ?? 1
}

export function calcPearlRate(rarity, level) {
  const base = PEARL_RATE_PER_HOUR[rarity] ?? 2
  return base * (1 + 0.15 * (level - 1))  // per hour
}

export function calcPendingPearls(fish) {
  const now           = Date.now()
  const lastCollected = new Date(fish.last_collected_at).getTime()
  const lastFed       = new Date(fish.last_fed_at).getTime()
  const level         = fish.level ?? calcLevel(fish.feedings_count ?? 0)
  const hungryAt      = lastFed + calcHungerMs(fish.rarity, level)

  const from  = Math.max(lastCollected, lastFed)
  const until = Math.min(now, hungryAt)
  if (until <= from) return 0

  const hours = (until - from) / (60 * 60 * 1000)
  return Math.floor(hours * calcPearlRate(fish.rarity, level))
}

export function isHungry(fish) {
  const level = fish.level ?? calcLevel(fish.feedings_count ?? 0)
  return Date.now() > new Date(fish.last_fed_at).getTime() + calcHungerMs(fish.rarity, level)
}

export function hungerRemainingMs(fish) {
  const level    = fish.level ?? calcLevel(fish.feedings_count ?? 0)
  const hungryAt = new Date(fish.last_fed_at).getTime() + calcHungerMs(fish.rarity, level)
  return Math.max(0, hungryAt - Date.now())
}

// ── Economy ───────────────────────────────────────────────────────────────────

export function calcEggCost(eggsPurchased) {
  return Math.round(EGG_BASE_PRICE * Math.pow(EGG_MULTIPLIER, eggsPurchased))
}

export function calcAlgaeEarned(idm) {
  return Math.max(1, Math.floor(idm))
}

export function calcReleaseReward(rarity, level) {
  return level * (RELEASE_BASE[rarity] ?? 8)
}

// ── Random rolls ──────────────────────────────────────────────────────────────

export function rollRarity() {
  const roll = Math.random() * 100
  if (roll < RARITY_WEIGHTS.Common)    return 'Common'
  if (roll < RARITY_WEIGHTS.Rare)      return 'Rare'
  return 'Legendary'
}

export function rollFishName(rarity) {
  const list = FISH_LISTS[rarity]
  return list[Math.floor(Math.random() * list.length)]
}

// ── Display helpers ───────────────────────────────────────────────────────────

export function fishDisplayName(name) {
  return name.split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

export function formatCountdown(ms) {
  if (ms <= 0) return null
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}
