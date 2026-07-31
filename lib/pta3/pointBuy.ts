// Point-buy costs for trainer stat creation, per the Player's Handbook (page 8):
// "Use the following point costs to purchase starting stats, using a total of 25 points."
export const POINT_BUY_COSTS: Record<number, number> = {
  1: 1,
  2: 2,
  3: 3,
  4: 6,
  5: 8,
  6: 11,
};

export const POINT_BUY_BUDGET = 25;

export const STAT_KEYS = ['attack', 'defense', 'specialAttack', 'specialDefense', 'speed'] as const;
export type StatKey = (typeof STAT_KEYS)[number];

export function pointBuyCost(values: Record<StatKey, number>): number {
  return STAT_KEYS.reduce((sum, key) => sum + (POINT_BUY_COSTS[values[key]] ?? 0), 0);
}

export function statModifier(value: number): number {
  return Math.floor(value / 2);
}
