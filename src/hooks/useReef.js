/**
 * useReef — manages all reef state via Supabase.
 *
 * On first load for a new user: creates reef_state with starter algae
 * and inserts a free Common egg that is already ready to hatch.
 *
 * All mutations are optimistic (update local state first, then Supabase).
 */

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import {
  calcLevel, calcAlgaeFeedCost, calcPendingPearls, calcEggCost,
  calcReleaseReward, rollRarity, rollFishName, isHungry,
} from '../lib/reefUtils.js'
import { STARTER_ALGAE, HATCH_MS, MAX_FISH } from '../config/reefConstants.js'

export function useReef(userId) {
  const [loaded,        setLoaded]        = useState(false)
  const [pearls,        setPearls]        = useState(0)
  const [algae,         setAlgae]         = useState(0)
  const [eggsPurchased, setEggsPurchased] = useState(0)
  const [fish,          setFish]          = useState([])
  const [eggs,          setEggs]          = useState([])

  useEffect(() => {
    if (userId) loadReef()
  }, [userId])

  // ── Initial load ──────────────────────────────────────────────────────────

  async function loadReef() {
    let { data: state } = await supabase
      .from('reef_state')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (!state) {
      // First visit — bootstrap reef state and a free starter egg
      const { data: newState } = await supabase
        .from('reef_state')
        .insert({ user_id: userId, pearls: 0, algae: STARTER_ALGAE, eggs_purchased: 0 })
        .select()
        .single()
      state = newState ?? { pearls: 0, algae: STARTER_ALGAE, eggs_purchased: 0 }

      // Free egg — already ready to hatch (hatches_at = now)
      const starterName = rollFishName('Common')
      const { data: starterEgg } = await supabase
        .from('reef_eggs')
        .insert({
          user_id:    userId,
          rarity:     'Common',
          name:       starterName,
          hatches_at: new Date().toISOString(),
        })
        .select()
        .single()
      if (starterEgg) setEggs([starterEgg])
    } else {
      const { data: eggData } = await supabase
        .from('reef_eggs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at')
      setEggs(eggData ?? [])
    }

    setPearls(state.pearls ?? 0)
    setAlgae(state.algae ?? 0)
    setEggsPurchased(state.eggs_purchased ?? 0)

    const { data: fishData } = await supabase
      .from('reef_fish')
      .select('*')
      .eq('user_id', userId)
      .order('created_at')
    setFish(fishData ?? [])

    setLoaded(true)
  }

  // ── Algae management ──────────────────────────────────────────────────────

  async function addAlgae(amount) {
    if (!userId || !loaded || amount <= 0) return
    const { data } = await supabase
      .from('reef_state')
      .select('algae')
      .eq('user_id', userId)
      .single()
    const current = data?.algae ?? algae
    const next = current + amount
    setAlgae(next)
    await supabase.from('reef_state').update({ algae: next }).eq('user_id', userId)
  }

  async function addPearls(amount) {
    if (!userId || !loaded || amount <= 0) return
    const { data } = await supabase
      .from('reef_state')
      .select('pearls')
      .eq('user_id', userId)
      .single()
    const current = data?.pearls ?? pearls
    const next = current + amount
    setPearls(next)
    await supabase.from('reef_state').update({ pearls: next }).eq('user_id', userId)
  }

  // ── Fish actions ──────────────────────────────────────────────────────────

  async function feedFish(fishId) {
    const f = fish.find(f => f.id === fishId)
    if (!f) return false

    const level = f.level ?? calcLevel(f.feedings_count ?? 0)
    const cost  = calcAlgaeFeedCost(f.rarity, level)
    if (algae < cost) return false

    const now             = new Date().toISOString()
    const newFeedingsCount = (f.feedings_count ?? 0) + 1
    const newLevel        = Math.min(10, Math.floor(newFeedingsCount / 7) + 1)
    const newAlgae        = algae - cost

    setAlgae(newAlgae)
    setFish(prev => prev.map(fi =>
      fi.id === fishId
        ? { ...fi, last_fed_at: now, feedings_count: newFeedingsCount, level: newLevel }
        : fi
    ))

    await Promise.all([
      supabase.from('reef_fish').update({
        last_fed_at:    now,
        feedings_count: newFeedingsCount,
        level:          newLevel,
      }).eq('id', fishId),
      supabase.from('reef_state').update({ algae: newAlgae }).eq('user_id', userId),
    ])
    return true
  }

  async function collectFromFish(fishId) {
    const f = fish.find(f => f.id === fishId)
    if (!f) return 0

    const earned = calcPendingPearls(f)
    if (earned <= 0) return 0

    const now       = new Date().toISOString()
    const newPearls = pearls + earned

    setPearls(newPearls)
    setFish(prev => prev.map(fi =>
      fi.id === fishId ? { ...fi, last_collected_at: now } : fi
    ))

    await Promise.all([
      supabase.from('reef_fish').update({ last_collected_at: now }).eq('id', fishId),
      supabase.from('reef_state').update({ pearls: newPearls }).eq('user_id', userId),
    ])
    return earned
  }

  async function releaseFish(fishId) {
    const f = fish.find(f => f.id === fishId)
    if (!f) return 0

    const level   = f.level ?? calcLevel(f.feedings_count ?? 0)
    const reward  = calcReleaseReward(f.rarity, level)
    const newPearls = pearls + reward

    setPearls(newPearls)
    setFish(prev => prev.filter(fi => fi.id !== fishId))

    await Promise.all([
      supabase.from('reef_fish').delete().eq('id', fishId),
      supabase.from('reef_state').update({ pearls: newPearls }).eq('user_id', userId),
    ])
    return reward
  }

  // ── Egg actions ───────────────────────────────────────────────────────────

  async function buyEgg() {
    const tankCount = fish.length + eggs.length
    if (tankCount >= MAX_FISH) return false

    const cost = calcEggCost(eggsPurchased)
    if (pearls < cost) return false

    const rarity    = rollRarity()
    const name      = rollFishName(rarity)
    const hatchesAt = new Date(Date.now() + HATCH_MS[rarity]).toISOString()
    const newPearls = pearls - cost
    const newCount  = eggsPurchased + 1

    setPearls(newPearls)
    setEggsPurchased(newCount)

    const { data: newEgg } = await supabase
      .from('reef_eggs')
      .insert({ user_id: userId, rarity, name, hatches_at: hatchesAt })
      .select()
      .single()
    if (newEgg) setEggs(prev => [...prev, newEgg])

    await supabase.from('reef_state').update({
      pearls:         newPearls,
      eggs_purchased: newCount,
    }).eq('user_id', userId)

    return true
  }

  async function claimEgg(eggId) {
    const egg = eggs.find(e => e.id === eggId)
    if (!egg) return false
    if (new Date(egg.hatches_at) > new Date()) return false
    if (fish.length >= MAX_FISH) return false

    const now  = new Date().toISOString()
    const xPos = 0.1 + Math.random() * 0.8
    const yPos = 0.3 + Math.random() * 0.4

    const { data: newFish } = await supabase
      .from('reef_fish')
      .insert({
        user_id:          userId,
        name:             egg.name,
        rarity:           egg.rarity,
        level:            1,
        feedings_count:   0,
        last_fed_at:      now,
        last_collected_at: now,
        x_pos:            xPos,
        y_pos:            yPos,
      })
      .select()
      .single()

    await supabase.from('reef_eggs').delete().eq('id', eggId)

    setEggs(prev => prev.filter(e => e.id !== eggId))
    if (newFish) setFish(prev => [...prev, newFish])
    return true
  }

  return {
    loaded,
    pearls,
    algae,
    eggsPurchased,
    fish,
    eggs,
    addAlgae,
    addPearls,
    feedFish,
    collectFromFish,
    releaseFish,
    buyEgg,
    claimEgg,
  }
}
