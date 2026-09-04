// [[Feature - Add Egg hatching logic]]

// Parses pokedex.egg_hatch_rate ("N days" -- a clean, fully-consistent format across all 13 distinct
// values in the data, confirmed directly) into a raw day count. Same parsing shape as
// parseMoveFrequency -- unrecognized input (shouldn't happen given the confirmed format, but this app
// never trusts a free-text field blindly) returns null rather than guessing.
export function parseEggHatchRate(rate: string): number | null {
  const match = rate.match(/^(\d+)\s*days?$/i)
  if (!match) return null
  return Number(match[1])
}

// Hatcher (Breeder, Level 1): "Your eggs in your care never take longer than 72 hours to hatch" -- a
// hard 3-day cap (one Sleep = one day), not a vague reduction. Applied once, at hatch-start -- an Egg
// already in progress keeps its original sleeps_required even if the Trainer's Hatcher status changes
// later (gained/lost via a class change), matching this app's existing "derive once at the triggering
// moment, don't retroactively recompute" convention for similar started-state mechanics.
export const HATCHER_MAX_SLEEPS = 3

export function computeSleepsRequired(rawDays: number, hasHatcher: boolean): number {
  return hasHatcher ? Math.min(HATCHER_MAX_SLEEPS, rawDays) : rawDays
}

// Natural Edge (Breeder, Level 1): "choose one of Attack, Defense, Special Attack, Special Defense, and
// Speed. That Pokémon's chosen stat is permanently raised X, where X is half of either your Defense or
// Special Defense modifier." No HP in the choice set -- a restricted 5-stat subset, same as every other
// Trainer stat.
export const NATURAL_EDGE_STAT_CHOICES = ['attack', 'defense', 'special_attack', 'special_defense', 'speed'] as const
export type NaturalEdgeStatChoice = (typeof NATURAL_EDGE_STAT_CHOICES)[number]

export const NATURAL_EDGE_STAT_LABELS: Record<NaturalEdgeStatChoice, string> = {
  attack: 'Attack',
  defense: 'Defense',
  special_attack: 'Special Attack',
  special_defense: 'Special Defense',
  speed: 'Speed',
}

// Floored at 0 rather than allowed to go negative -- "permanently raised" reads as a one-directional
// buff; a Trainer with a low/negative Defense or Special Defense modifier gets a no-op pick, not an
// actual reduction to the hatched Pokemon's stat. Flagged as an assumption in this FR's own Design
// (not explicitly confirmed), consistent with the sibling Breeder-stat-increase FR's own notes.
//
// Takes the HIGHER of the two raw modifiers, per the user (2026-09-04) -- "either your Defense or
// Special Defense modifier" read as a free choice worth always resolving in the player's favor, same
// spirit as this function's own floor-at-zero already erring toward the Trainer, rather than making
// the player track both numbers themselves. Correct to take the max before halving, not after: floor(x/2)
// is monotonic non-decreasing, so max(floor(a/2), floor(b/2)) == floor(max(a,b)/2) always.
export function naturalEdgeBonus(defenseModifier: number, specialDefenseModifier: number): number {
  return Math.max(0, Math.floor(Math.max(defenseModifier, specialDefenseModifier) / 2))
}

export type NaturalEdgeStatOption = {
  key: NaturalEdgeStatChoice
  label: string
  current: number
  withBonus: number
}

// Preview table for the Hatch screen's stat picker -- per the user (2026-09-04), needs to show the
// Pokémon's actual total for each candidate stat (base + Nature, matching computeStatRows'
// convention on the Pokémon page) both as-is and with the bonus applied, not just the bare bonus
// amount in isolation. A freshly hatched Pokémon always has 0 EVs, so "base + Nature" is the whole
// story here -- no EV/Passive/Affliction terms to account for yet.
export function computeNaturalEdgeStatOptions(
  speciesBase: Record<NaturalEdgeStatChoice, number>,
  natureIncreasedLabel: string | null,
  natureDecreasedLabel: string | null,
  bonusAmount: number,
): NaturalEdgeStatOption[] {
  return NATURAL_EDGE_STAT_CHOICES.map((key) => {
    const label = NATURAL_EDGE_STAT_LABELS[key]
    const natureAdjust = natureIncreasedLabel === label ? 1 : natureDecreasedLabel === label ? -1 : 0
    const current = speciesBase[key] + natureAdjust
    return { key, label, current, withBonus: current + bonusAmount }
  })
}
