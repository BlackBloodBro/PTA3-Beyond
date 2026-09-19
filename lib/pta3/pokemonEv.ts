import type { SupabaseClient } from '@supabase/supabase-js'

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

// [[Feature - Fully turn off EV's]]: a plain per-Campaign column (like `campaigns.lp_disabled`/
// `exp_disabled`), not the global-default-plus-override pattern used for shared reference data -- same
// reasoning as `loadCampaignLpDisabled`/`loadCampaignExpDisabled`. `campaignId` null/undefined (a
// personal Trainer's Pokemon) means EVs can never be disabled -- there's no Campaign to disable them for.
export async function loadCampaignEvDisabled(supabase: SupabaseClient, campaignId?: string | null): Promise<boolean> {
  if (!campaignId) return false
  const { data } = await supabase.from('campaigns').select('ev_disabled').eq('id', campaignId).maybeSingle()
  return data?.ev_disabled ?? false
}

// [[Feature - Fully turn off EV's]]: max HP isn't one of computeStatRows' 5 stat rows (it has its own
// formula, base + bonus + ev_hp*6, duplicated across every roster/PC/encounter listing plus the Pokemon
// page and the HP-clamping server actions) -- centralized here so every one of those call sites excludes
// EVs the same way, without touching the stored `ev_hp` value itself.
export function computePokemonMaxHp(baseHp: number, bonusBaseHp: number, evHp: number, evsDisabled: boolean): number {
  return baseHp + bonusBaseHp + (evsDisabled ? 0 : evHp * 6)
}
