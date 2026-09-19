import type { SupabaseClient } from '@supabase/supabase-js'

export type GrantEventRow = {
  id: number
  name: string
  exp: number
  defaultExp: number
  isExpOverridden: boolean
  loyaltyPoints: number
  defaultLoyaltyPoints: number
  isLoyaltyOverridden: boolean
}

// [[Feature - Add more automated EXP and Loyalty Point triggers]]: the effective EXP and LP amounts for
// every automated trigger condition in a Campaign -- global `grant_events` with that Campaign's own
// `campaign_grant_event_exp_overrides`/`campaign_grant_event_loyalty_overrides` merged in independently
// (a GM can override just one side of an event without touching the other). Supersedes the old, separate
// exp_grant_events/loyalty_point_events tables -- every event now carries both amounts, since per the
// user every trigger condition should be able to grant both EXP and LP. `campaignId` optional/null means
// "no Campaign, no overrides possible," matching every other Campaign-scoping loader's own convention.
export async function loadGrantEvents(supabase: SupabaseClient, campaignId?: string | null): Promise<GrantEventRow[]> {
  const [{ data: events }, { data: expOverrides }, { data: loyaltyOverrides }] = await Promise.all([
    supabase.from('grant_events').select('id, name, exp, loyalty_points'),
    campaignId
      ? supabase.from('campaign_grant_event_exp_overrides').select('event_id, exp').eq('campaign_id', campaignId)
      : Promise.resolve({ data: [] as { event_id: number; exp: number }[] }),
    campaignId
      ? supabase.from('campaign_grant_event_loyalty_overrides').select('event_id, loyalty_points').eq('campaign_id', campaignId)
      : Promise.resolve({ data: [] as { event_id: number; loyalty_points: number }[] }),
  ])

  const expOverrideById = new Map((expOverrides ?? []).map((o) => [o.event_id, o.exp]))
  const loyaltyOverrideById = new Map((loyaltyOverrides ?? []).map((o) => [o.event_id, o.loyalty_points]))

  return (events ?? []).map((e) => ({
    id: e.id,
    name: e.name,
    defaultExp: e.exp,
    exp: expOverrideById.get(e.id) ?? e.exp,
    isExpOverridden: expOverrideById.has(e.id),
    defaultLoyaltyPoints: e.loyalty_points,
    loyaltyPoints: loyaltyOverrideById.get(e.id) ?? e.loyalty_points,
    isLoyaltyOverridden: loyaltyOverrideById.has(e.id),
  }))
}

// Convenience for every automated-grant call site (Move used, Sleep, Pokemon Center (damaged), Fainted,
// Evolved), which only ever needs one named event's effective EXP+LP amounts at a time.
export async function loadGrantEventAmounts(
  supabase: SupabaseClient,
  eventName: string,
  campaignId?: string | null,
): Promise<{ exp: number; loyaltyPoints: number }> {
  const events = await loadGrantEvents(supabase, campaignId)
  const event = events.find((e) => e.name === eventName)
  return { exp: event?.exp ?? 0, loyaltyPoints: event?.loyaltyPoints ?? 0 }
}
