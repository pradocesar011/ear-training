// ── Fish catalogues ───────────────────────────────────────────────────────────

export const FISH_LISTS = {
  Common: [
    'anchovy', 'angelfish', 'arowana', 'blue_tang', 'carp', 'clownfish',
    'coelacanth', 'crucian', 'dark_sleeper', 'flatfish', 'garra_rufa', 'goby',
    'goldfish', 'goldribbon_soapfish', 'guppy', 'herring', 'kumgang_fat_minnow',
    'largemouth_bass', 'leatherjacket', 'mackerel', 'mandarin', 'mylodon',
    'orange_roughy', 'pacific_saury', 'pale_chub', 'pomfret', 'rock_bream',
    'rockfish', 'sea_bass', 'sea_bream', 'shad', 'snakehead', 'splendidus',
    'tadpole', 'trevally',
  ],
  Rare: [
    'alligator_gaa', 'angler_fish', 'betta', 'blowfish', 'bluefin_tuna',
    'catfish', 'flying_fish', 'harisenbon', 'longhorn_cowfish', 'mola_mola',
    'moray_eel', 'napoleon_fish', 'olive_flounder', 'panther_grouper',
    'picasso_triggerfish', 'piranha', 'pirarucu', 'redfin_velvetfish',
    'remora', 'sailfish', 'sturgeon', 'unicornfish',
  ],
  Legendary: [
    'great_white_shark', 'hammerhead', 'humpback_whale', 'killer_whale',
    'leopoldi', 'lionfish', 'mahi-mahi', 'oarfish', 'octopus', 'seahorse',
    'squid', 'stingray', 'whale_shark',
  ],
}

// Cumulative weights: Common 65%, Rare 30%, Legendary 5%
export const RARITY_WEIGHTS = { Common: 65, Rare: 95, Legendary: 100 }

export const HATCH_MS = {
  Common:    20 * 60 * 1000,          // 20 minutes
  Rare:       2 * 60 * 60 * 1000,     // 2 hours
  Legendary:  8 * 60 * 60 * 1000,     // 8 hours
}

// ── Economy constants ─────────────────────────────────────────────────────────

export const PEARL_RATE_PER_HOUR = { Common: 2, Rare: 6, Legendary: 18 }

export const MAX_FISH       = 10
export const HUNGER_MS      = 24 * 60 * 60 * 1000   // 24 hours
export const MAX_LEVEL      = 10
export const FEEDINGS_PER_LEVEL = 7
export const STARTER_ALGAE  = 5

export const EGG_BASE_PRICE = 50
export const EGG_MULTIPLIER = 1.55

// Pearl reward on release: level × this base
export const RELEASE_BASE = { Common: 8, Rare: 25, Legendary: 80 }

// ── Visual ────────────────────────────────────────────────────────────────────

export const FISH_SIZE_PX = { Common: 72, Rare: 88, Legendary: 108 }

export const RARITY_COLORS = {
  Common:    { label: '#94a3b8', bg: '#1e293b', border: '#334155' },
  Rare:      { label: '#60a5fa', bg: '#1e3a5f', border: '#3b82f6' },
  Legendary: { label: '#fbbf24', bg: '#451a03', border: '#d97706' },
}

// Static asset paths (files in public/reef/)
export const ICONS = {
  algae:              '/Reef/Icons/Algae.png',
  pearl:              '/Reef/Icons/Pearl.png',
  egg:                '/Reef/Icons/Egg.png',
  eggHatching:        '/Reef/Icons/Egg%20Hatching.png',
  mysteryEgg:         '/Reef/Icons/Mystery%20Egg.png',
  mysteryEggHatching: '/Reef/Icons/Mystery%20Egg%20Hatching.png',
}

export function fishImagePath(rarity, name) {
  return `/Reef/Fish/${rarity}/${name}.png`
}
