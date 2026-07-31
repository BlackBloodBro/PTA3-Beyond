// Shared by the pokemon actions (assignPokemonEv/setPokemonEvs) and the Pokemon page (display +
// disabled state) -- kept out of actions.ts because a "use server" file may only export async
// functions, so a plain constant/type export there fails the build.
export const EV_STAT_COLUMNS = {
  hp: 'ev_hp',
  attack: 'ev_attack',
  defense: 'ev_defense',
  special_attack: 'ev_special_attack',
  special_defense: 'ev_special_defense',
  speed: 'ev_speed',
} as const

export type EvStatKey = keyof typeof EV_STAT_COLUMNS

export const MAX_EV_PER_STAT = 2
