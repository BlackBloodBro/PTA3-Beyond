import type { SupabaseClient } from '@supabase/supabase-js'

export type LevelBandRow = { band: number; expPerLevel: number; defaultExpPerLevel: number; isOverridden: boolean }
export type LevelRow = { level_number: number; cumulative_exp: number }

const LEVELS_PER_BAND = 10
const BAND_COUNT = 10

// [[Feature - Let a GM customize EXP needed per level band]]: the effective 10 band deltas for a
// Campaign -- global `level_bands` with that Campaign's own `campaign_level_band_overrides` merged in.
// Same shape/convention as lib/pta3/loyaltySettings.ts.
export async function loadLevelBands(supabase: SupabaseClient, campaignId?: string | null): Promise<LevelBandRow[]> {
  const [{ data: bands }, { data: overrides }] = await Promise.all([
    supabase.from('level_bands').select('band, exp_per_level').order('band'),
    campaignId
      ? supabase.from('campaign_level_band_overrides').select('band, exp_per_level').eq('campaign_id', campaignId)
      : Promise.resolve({ data: [] as { band: number; exp_per_level: number }[] }),
  ])

  const overrideByBand = new Map((overrides ?? []).map((o) => [o.band, o.exp_per_level]))
  return (bands ?? []).map((b) => ({
    band: b.band,
    defaultExpPerLevel: b.exp_per_level,
    expPerLevel: overrideByBand.get(b.band) ?? b.exp_per_level,
    isOverridden: overrideByBand.has(b.band),
  }))
}

// Derives the full 100-row {level_number, cumulative_exp}[] curve from 10 band deltas, in the same
// incremental way the original seed data was generated (confirmed directly against it: level 1's
// cumulative_exp equals band 1's own delta, not 0) -- band = ceil(level_number / 10), each level within
// a band costs that band's own delta, added on top of every level before it.
function deriveLevelsFromBands(bands: { band: number; expPerLevel: number }[]): LevelRow[] {
  const deltaByBand = new Map(bands.map((b) => [b.band, b.expPerLevel]))
  const rows: LevelRow[] = []
  let cumulative = 0
  let levelNumber = 0
  for (let band = 1; band <= BAND_COUNT; band++) {
    const delta = deltaByBand.get(band) ?? 0
    for (let i = 0; i < LEVELS_PER_BAND; i++) {
      levelNumber++
      cumulative += delta
      rows.push({ level_number: levelNumber, cumulative_exp: cumulative })
    }
  }
  return rows
}

// [[Feature - Let a GM customize EXP needed per level band]]: drop-in replacement for
// `supabase.from('levels').select('level_number, cumulative_exp')` -- same shape, just derived from
// the Campaign's effective band deltas instead of read directly off the (now purely-default) `levels`
// table. Every existing level-lookup consumer (computePokemonLevel/computePokemonLevelsBulk's "find the
// highest cumulative_exp <= effectiveExp" logic) needs zero changes, only the source of this array does.
export async function loadEffectiveLevels(supabase: SupabaseClient, campaignId?: string | null): Promise<LevelRow[]> {
  const bands = await loadLevelBands(supabase, campaignId)
  return deriveLevelsFromBands(bands.map((b) => ({ band: b.band, expPerLevel: b.expPerLevel })))
}

// [[Feature - Fully turn off EXP]]: a plain per-Campaign column (like `campaigns.lp_disabled`), not the
// global-default-plus-override pattern above -- same reasoning as `loadCampaignLpDisabled`
// (lib/pta3/loyaltySettings.ts). `campaignId` null/undefined (a personal Trainer's Pokemon) means EXP
// can never be disabled -- there's no Campaign to disable it for.
export async function loadCampaignExpDisabled(supabase: SupabaseClient, campaignId?: string | null): Promise<boolean> {
  if (!campaignId) return false
  const { data } = await supabase.from('campaigns').select('exp_disabled').eq('id', campaignId).maybeSingle()
  return data?.exp_disabled ?? false
}
