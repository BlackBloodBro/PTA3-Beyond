// [[Feature - GM Custom - Type]]: split out of actions.ts -- a 'use server' file can only export
// async functions, not plain constants/types.
export const MATCHUP_CHOICES = ['immune', 'resisted', 'neutral', 'effective'] as const
export type MatchupChoice = (typeof MATCHUP_CHOICES)[number]

export function isMatchupChoice(value: unknown): value is MatchupChoice {
  return typeof value === 'string' && (MATCHUP_CHOICES as readonly string[]).includes(value)
}
