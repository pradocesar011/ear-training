import { ICONS } from '../../config/reefConstants.js'

// Inline icon + number display used throughout the reef and training sections.

export function AlgaeIcon({ size = 20 }) {
  return (
    <img
      src={ICONS.algae}
      alt="Algae"
      style={{ width: size, height: size, objectFit: 'contain', display: 'inline-block', verticalAlign: 'middle' }}
    />
  )
}

export function PearlIcon({ size = 20 }) {
  return (
    <img
      src={ICONS.pearl}
      alt="Pearl"
      style={{ width: size, height: size, objectFit: 'contain', display: 'inline-block', verticalAlign: 'middle' }}
    />
  )
}

// Compact "N 🌿" or "N ⭐" display used in HUD and result screens.
export function AlgaeAmount({ amount, size = 18, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <AlgaeIcon size={size} />
      <span>{amount}</span>
    </span>
  )
}

export function PearlAmount({ amount, size = 18, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <PearlIcon size={size} />
      <span>{amount}</span>
    </span>
  )
}
