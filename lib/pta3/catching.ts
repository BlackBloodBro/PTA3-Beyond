// [[Feature - Create Pokemon catching mechanic]]: the catch odds, as pure functions so the server action and
// any display agree. The player rolls a physical d100 and types it in; success is `roll <= targetPercent`.

// catch_modifiers_hp rows, by seeded id (the table has no machine-readable key beyond its name).
export const CATCH_HP_MODIFIER_ID = { max: 1, notMax: 2, belowHalf: 3, below10: 4, fainted: 5 } as const

// The first tier that applies, most favourable-to-the-catcher first: fainted > below 10 HP (an absolute 10,
// not 10%) > below half > not at max > at max.
export function catchHpTierId(currentHp: number, maxHp: number): number {
  if (currentHp <= 0) return CATCH_HP_MODIFIER_ID.fainted
  if (currentHp < 10) return CATCH_HP_MODIFIER_ID.below10
  if (currentHp * 2 < maxHp) return CATCH_HP_MODIFIER_ID.belowHalf
  if (currentHp < maxHp) return CATCH_HP_MODIFIER_ID.notMax
  return CATCH_HP_MODIFIER_ID.max
}

// pokeball_catch_modifiers stores each Ball's modifier with the opposite sign to the catch_modifiers_* tables
// (Master Ball -100 there, +100 here: lower = easier). The odds use the catch_modifiers_* convention, where a
// higher number helps the catcher, so a Ball's bonus is the negation of its stored modifier.
export function ballBonusFromStoredModifier(storedModifier: number): number {
  return storedModifier === 0 ? 0 : -storedModifier
}

// Timer Ball's text: -10 once the encounter has lasted a minute, -25 instead after two. The thrower picks the
// tier (0 = under a minute, 1 = a minute or more, 2 = two minutes or more).
export const TIMER_BALL_NAME = 'Timer Ball'
export const TIMER_BALL_BONUS_BY_TIER = [0, 10, 25] as const

export type CatchOddsInput = {
  catchRate: number
  hpModifier: number
  battleStartModifier: number
  ballBonus: number
  afflictionModifier: number
}

export function computeCatchTarget(input: CatchOddsInput): { basePercent: number; targetPercent: number } {
  const basePercent = (input.catchRate / 255) * 100
  const raw = basePercent + input.hpModifier + input.battleStartModifier + input.ballBonus + input.afflictionModifier
  return { basePercent, targetPercent: Math.max(0, Math.min(100, raw)) }
}
