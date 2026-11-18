import { statModifier } from '@/lib/pta3/pointBuy'
import type { StatColumn } from '@/lib/pta3/trainerFeatures'

// [[Improvement - Show computed numbers on Class Features]]: a handful of Class Features state a distance or
// duration worked out from the Trainer's own modifiers ("X x 5 ft, where X is your Special Attack or Special
// Defense modifier"). This works that number out so the player doesn't have to. Display only -- nothing acts on
// the number (no movement, ranges or timers).
//
// `either` = the Feature lets the player pick one of two modifiers, so the label uses the higher one and the
// tooltip lists both. `sum` = the Feature adds the modifiers together.

type FeatureNumberRule = {
  mode: 'either' | 'sum'
  stats: [StatColumn, StatColumn]
  format: (x: number) => string
}

const STAT_LABEL: Record<StatColumn, string> = {
  attack: 'Attack',
  defense: 'Defense',
  special_attack: 'Special Attack',
  special_defense: 'Special Defense',
  speed: 'Speed',
}

const feet = (x: number) => `up to ${Math.max(0, x) * 5} ft`
const rounds = (x: number) => `${Math.max(0, x)} ${Math.max(0, x) === 1 ? 'round' : 'rounds'}`
const minutes = (x: number) => `${Math.max(0, x)} ${Math.max(0, x) === 1 ? 'minute' : 'minutes'}`

// Keyed by a normalized Feature name (see normalize) so seed casing and curly vs straight apostrophes
// ("Commander’s Rally") don't matter.
const RULES: Record<string, FeatureNumberRule> = {
  'game plan': { mode: 'either', stats: ['special_attack', 'special_defense'], format: feet },
  'strategic sabotage': { mode: 'either', stats: ['special_attack', 'special_defense'], format: feet },
  "commander's rally": { mode: 'either', stats: ['defense', 'speed'], format: rounds },
  'aid of the wild': { mode: 'either', stats: ['defense', 'speed'], format: rounds },
  'steal the show': { mode: 'sum', stats: ['special_defense', 'speed'], format: minutes },
}

function normalize(name: string): string {
  return name.trim().toLowerCase().replace(/[‘’]/g, "'")
}

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`)

export type FeatureNumber = { label: string; tooltip: string }

// `stats` are the Trainer's effective stats (base + milestone increases, i.e. computeEffectiveStats), not raw base.
export function computeFeatureNumber(featureName: string, stats: Record<StatColumn, number>): FeatureNumber | null {
  const rule = RULES[normalize(featureName)]
  if (!rule) return null
  const [a, b] = rule.stats
  const modA = statModifier(stats[a])
  const modB = statModifier(stats[b])
  const x = rule.mode === 'sum' ? modA + modB : Math.max(modA, modB)
  const label = rule.format(x)
  const parts = `${STAT_LABEL[a]} ${signed(modA)}, ${STAT_LABEL[b]} ${signed(modB)}`
  const tooltip = rule.mode === 'sum' ? `${parts} (added together) -> ${label}` : `${parts} -> ${label}`
  return { label, tooltip }
}
