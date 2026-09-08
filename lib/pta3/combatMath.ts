import type { PokemonStatRows } from '@/lib/pta3/pokemonStats'

// [[Feature - Add attack resolution to combat encounters]]: extracted from PokemonInteractive.tsx's
// own page-local functions (stabBonus, effectivenessFor, adjustDiceCount) unchanged, plus a new
// resolveAccuracyStat, so the same move-math the Pokemon page already uses to *display* To hit/Damage
// can also be used to actually *resolve* an attack server-side, one source of truth for both.

export type TypeMatchupInfo = {
  attacking_type: string
  defending_type: string
  modifier: number
}

// [[Bug - Double check immunities in type effectiveness]]: presence-only pairs, deliberately not
// folded into TypeMatchupInfo/type_matchups -- see effectivenessFor's comment for why immunity can't
// be represented as just another modifier value in that additive system.
export type TypeImmunityInfo = {
  attacking_type: string
  defending_type: string
}

// Same rule as STAB elsewhere -- +4 damage when a move's type matches either of the Pokemon's own
// (effective, override-aware) types.
export function stabBonus(moveTypeName: string | undefined, type1?: string, type2?: string): number {
  return moveTypeName && (moveTypeName === type1 || moveTypeName === type2) ? 4 : 0
}

// Player's Handbook rule (page 122): NOT a mainline-style HP multiplier -- effectiveness adds or
// removes damage dice instead. Immunity is checked first and separately (a presence-only pair, not a
// modifier value) since an immune matchup has to always mean "0 damage," which an additive dice-count
// system can't represent on its own (two resisted-by-half matchups summing to "immune" would be a
// coincidence of the math, not the actual rule).
export function effectivenessFor(
  moveTypeName: string | undefined,
  defType1: string | undefined,
  defType2: string | undefined,
  typeMatchups: TypeMatchupInfo[],
  typeImmunities: TypeImmunityInfo[],
): { dice: number; label: string; immune: boolean } | null {
  if (!moveTypeName || moveTypeName === 'Special/Variable' || !defType1) return null
  const isImmune = (defType: string | undefined) =>
    !!defType && typeImmunities.some((i) => i.attacking_type === moveTypeName && i.defending_type === defType)
  if (isImmune(defType1) || isImmune(defType2)) {
    return { dice: 0, label: 'Immune', immune: true }
  }
  const scoreAgainst = (defType: string | undefined) => {
    if (!defType) return 0
    return typeMatchups.find((m) => m.attacking_type === moveTypeName && m.defending_type === defType)?.modifier ?? 0
  }
  const total = scoreAgainst(defType1) + scoreAgainst(defType2)
  const dice = Math.max(-2, Math.min(2, total))
  if (dice === 0) return null
  const label = dice === 2 ? 'Extremely effective' : dice === 1 ? 'Super effective' : dice === -1 ? 'Resisted' : 'Shielded'
  return { dice, label, immune: false }
}

// A move's damage_dice is always "<count>d<sides>" (e.g. "2d6"). Effectiveness changes the dice
// COUNT, not the modifier added to the roll -- floored at 0 ([[Bug - Effectiveness can remove all
// Dice from a Damage roll]]) rather than 1, so a move that's fully resisted can correctly show just
// its flat modifier with no dice at all.
export function adjustDiceCount(diceNotation: string, delta: number): string | null {
  const match = diceNotation.match(/^(\d+)d(\d+)$/)
  if (!match) return diceNotation
  if (delta === 0) return diceNotation
  const count = Math.max(0, parseInt(match[1], 10) + delta)
  return count === 0 ? null : `${count}d${match[2]}`
}

// [[Feature - Add attack resolution to combat encounters]]: `moves.damage_stat` ('physical' ->
// Attack, 'special' -> Special Attack, 'either' -> whichever of Attack/Special Attack is higher,
// 'effect' -> Speed, for status Moves with no damage_dice -- all confirmed with the user) already
// encodes exactly which stat pair an Accuracy Check uses on both sides: the attacker's modifier
// (this function's `modifier`, the same value already shown as "To hit"), and which of the target's
// own stats (`targetStatKey`) the target's raw value gets read from for the other half of the check
// (`hit = d20 + modifier >= target's raw stat value`, resolved by the caller).
export function resolveAccuracyStat(
  damageStat: string,
  attackerStatRows: PokemonStatRows,
): { modifier: number; targetStatKey: 'defense' | 'special_defense' | 'speed' } {
  const attackMod = attackerStatRows.find((s) => s.key === 'attack')!.modifier
  const spAtkMod = attackerStatRows.find((s) => s.key === 'special_attack')!.modifier
  const speedMod = attackerStatRows.find((s) => s.key === 'speed')!.modifier
  if (damageStat === 'physical') return { modifier: attackMod, targetStatKey: 'defense' }
  if (damageStat === 'special') return { modifier: spAtkMod, targetStatKey: 'special_defense' }
  if (damageStat === 'either') {
    return attackMod >= spAtkMod ? { modifier: attackMod, targetStatKey: 'defense' } : { modifier: spAtkMod, targetStatKey: 'special_defense' }
  }
  return { modifier: speedMod, targetStatKey: 'speed' }
}
