import type { SupabaseClient } from '@supabase/supabase-js'

export type ExpGrantEventRow = { id: number; name: string; exp: number }

// [[Feature - Add triggers for a Pokemon to gain EXP automatically]]: the effective per-event EXP
// amounts for a Campaign -- global `exp_grant_events` with that Campaign's own
// `campaign_exp_grant_overrides.exp` merged in where one exists. Same shape as
// lib/pta3/loyaltySettings.ts's loadLoyaltyEvents -- `campaignId` optional/null means "no Campaign, no
// overrides possible," matching every other Campaign-scoping loader's own convention in this codebase.
export async function loadExpGrantEvents(supabase: SupabaseClient, campaignId?: string | null): Promise<ExpGrantEventRow[]> {
  const [{ data: events }, { data: overrides }] = await Promise.all([
    supabase.from('exp_grant_events').select('id, name, exp'),
    campaignId
      ? supabase.from('campaign_exp_grant_overrides').select('event_id, exp').eq('campaign_id', campaignId)
      : Promise.resolve({ data: [] as { event_id: number; exp: number }[] }),
  ])

  const overrideByEventId = new Map((overrides ?? []).map((o) => [o.event_id, o.exp]))
  return (events ?? []).map((e) => ({ ...e, exp: overrideByEventId.get(e.id) ?? e.exp }))
}

// Convenience for the one automated-grant call site today (a Move used in combat), which only ever
// needs one named event's effective amount at a time -- same shape as loadLoyaltyEventPoints.
export async function loadExpGrantEventPoints(supabase: SupabaseClient, eventName: string, campaignId?: string | null): Promise<number> {
  const events = await loadExpGrantEvents(supabase, campaignId)
  return events.find((e) => e.name === eventName)?.exp ?? 0
}
