import type { SupabaseClient } from '@supabase/supabase-js'

export type ShinyRateRow = { denominator: number; defaultDenominator: number; isOverridden: boolean }

// [[Feature - Let a GM customize their Campaign's shiny rate]]: the effective shiny denominator ("1 in
// N") for a Campaign -- the global `shiny_rate_settings` singleton with that Campaign's own
// `campaign_shiny_rate_overrides` row merged in where one exists. Same shape/convention as
// lib/pta3/levelBandSettings.ts's loadLevelBands -- `campaignId` optional/null means "no Campaign, no
// override possible."
export async function loadShinyRate(supabase: SupabaseClient, campaignId?: string | null): Promise<ShinyRateRow> {
  const [{ data: defaultRow }, { data: override }] = await Promise.all([
    supabase.from('shiny_rate_settings').select('denominator').single(),
    campaignId
      ? supabase.from('campaign_shiny_rate_overrides').select('denominator').eq('campaign_id', campaignId).maybeSingle()
      : Promise.resolve({ data: null as { denominator: number } | null }),
  ])

  const defaultDenominator = defaultRow?.denominator ?? 250
  return {
    defaultDenominator,
    denominator: override?.denominator ?? defaultDenominator,
    isOverridden: override !== null && override !== undefined,
  }
}

// Convenience for the one call site that only needs the resolved number (Pokémon creation's "Random"
// Shininess option) -- same shape as loadExpGrantEventPoints.
export async function loadShinyRateDenominator(supabase: SupabaseClient, campaignId?: string | null): Promise<number> {
  const { denominator } = await loadShinyRate(supabase, campaignId)
  return denominator
}
