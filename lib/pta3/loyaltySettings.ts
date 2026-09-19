import type { SupabaseClient } from '@supabase/supabase-js'

export type LoyaltyTierRow = {
  id: number
  name: string
  description: string | null
  modifier: number
  sort_order: number
  min_points: number
}

// [[Feature - Allow a GM to change Loyalty settings]]: the effective 6-tier list for a Campaign --
// global `loyalties` with that Campaign's own `campaign_loyalty_tier_overrides.min_points` merged in
// where one exists. `campaignId` optional/`null` means "no Campaign, no overrides possible" (a personal
// Trainer's Pokemon), matching every other Campaign-scoping loader's own convention in this codebase --
// callers that don't pass it get exactly today's global-only behavior.
export async function loadLoyaltyTiers(supabase: SupabaseClient, campaignId?: string | null): Promise<LoyaltyTierRow[]> {
  const [{ data: tiers }, { data: overrides }] = await Promise.all([
    supabase.from('loyalties').select('id, name, description, modifier, sort_order, min_points').order('sort_order'),
    campaignId
      ? supabase.from('campaign_loyalty_tier_overrides').select('loyalty_id, min_points').eq('campaign_id', campaignId)
      : Promise.resolve({ data: [] as { loyalty_id: number; min_points: number }[] }),
  ])

  const overrideByLoyaltyId = new Map((overrides ?? []).map((o) => [o.loyalty_id, o.min_points]))
  return (tiers ?? []).map((t) => ({ ...t, min_points: overrideByLoyaltyId.get(t.id) ?? t.min_points }))
}

// [[Feature - Fully turn off LP]]: a plain per-Campaign column (like `campaigns.sell_price_percent`),
// not the global-default-plus-override pattern above -- there's no shared "default" to merge here,
// every Campaign has its own concrete value from the moment it's created (see the migration's own
// backfill-then-default-flip reasoning). `campaignId` null/undefined (a personal Trainer's Pokemon) means
// LP can never be disabled -- there's no Campaign to disable it for.
export async function loadCampaignLpDisabled(supabase: SupabaseClient, campaignId?: string | null): Promise<boolean> {
  if (!campaignId) return false
  const { data } = await supabase.from('campaigns').select('lp_disabled').eq('id', campaignId).maybeSingle()
  return data?.lp_disabled ?? false
}
