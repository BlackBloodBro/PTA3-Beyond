// Parses moves.frequency ("1/day", "3/day", "At will", "Special"...) into a trackable use cap +
// reset cadence. Only "N/day" produces a tracked cap -- "At will" and anything unrecognized (the
// one "Special" move, Struggle, isn't learnable through the normal flow at all) are unlimited,
// nothing to track or reset. Shared by learnMove (sets the initial cap), restSleep (resets it),
// and the Pokemon page (displays it) so the parsing rule can't drift between the three.
export function parseMoveFrequency(frequency: string): { maxUses: number | null; resetsOn: 'rest' | null } {
  const match = frequency.match(/^(\d+)\/day$/i)
  if (!match) return { maxUses: null, resetsOn: null }
  return { maxUses: Number(match[1]), resetsOn: 'rest' }
}
