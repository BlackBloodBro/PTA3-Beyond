import type { SupabaseClient } from '@supabase/supabase-js'

export type LoyaltyTierRow = {
  id: number
  name: string
  description: string | null
  modifier: number
  sort_order: number
  min_points: number
}

export type LoyaltyEventRow = { id: number; name: string; points: number }

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

// Same shape for the 3 automated LP-grant events (Sleep / Pokemon Center (damaged) / Fainted).
export async function loadLoyaltyEvents(supabase: SupabaseClient, campaignId?: string | null): Promise<LoyaltyEventRow[]> {
  const [{ data: events }, { data: overrides }] = await Promise.all([
    supabase.from('loyalty_point_events').select('id, name, points'),
    campaignId
      ? supabase.from('campaign_loyalty_event_overrides').select('event_id, points').eq('campaign_id', campaignId)
      : Promise.resolve({ data: [] as { event_id: number; points: number }[] }),
  ])

  const overrideByEventId = new Map((overrides ?? []).map((o) => [o.event_id, o.points]))
  return (events ?? []).map((e) => ({ ...e, points: overrideByEventId.get(e.id) ?? e.points }))
}

// Convenience for the 3 automated-grant call sites (restSleep/restPokemonCenter/adjustPokemonHp's
// Fainted check), which only ever need one named event's effective points at a time.
export async function loadLoyaltyEventPoints(supabase: SupabaseClient, eventName: string, campaignId?: string | null): Promise<number> {
  const events = await loadLoyaltyEvents(supabase, campaignId)
  return events.find((e) => e.name === eventName)?.points ?? 0
}
