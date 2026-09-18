'use server'

import { createClient } from '@/lib/supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

// Same reasoning as every other "GM Custom"/campaign-settings action set this mirrors: RLS backs
// this up too (the migration's "GM manages their campaign's loyalty ... overrides" policies), but
// checking here first turns a bad request into a clean error instead of a raw RLS-denial message.
async function requireGm(supabase: SupabaseClient, campaignId: string, userId: string): Promise<boolean> {
  const { data: campaign } = await supabase.from('campaigns').select('gm_user_id').eq('id', campaignId).maybeSingle()
  return campaign?.gm_user_id === userId
}

// [[Feature - Allow a GM to change Loyalty settings]]: one row at a time, called directly from the
// client (LoyaltySettingsSection) as a plain function -- same shape as excludeSpecies/includeSpecies
// (campaigns/[id]/custom/pokedex-exclusions/actions.ts) rather than a whole-page form submit.
export async function setLoyaltyTierOverride(campaignId: string, loyaltyId: number, minPoints: number): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  if (!(await requireGm(supabase, campaignId, user.id))) return { error: 'Only the GM can change Loyalty settings' }
  if (!Number.isInteger(minPoints) || minPoints < 0) return { error: 'Enter a whole number of 0 or more' }

  const { error } = await supabase
    .from('campaign_loyalty_tier_overrides')
    .upsert({ campaign_id: campaignId, loyalty_id: loyaltyId, min_points: minPoints })
  if (error) return { error: error.message }
  return { success: true }
}

export async function resetLoyaltyTierOverride(campaignId: string, loyaltyId: number): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  if (!(await requireGm(supabase, campaignId, user.id))) return { error: 'Only the GM can change Loyalty settings' }

  const { error } = await supabase.from('campaign_loyalty_tier_overrides').delete().eq('campaign_id', campaignId).eq('loyalty_id', loyaltyId)
  if (error) return { error: error.message }
  return { success: true }
}

// "Remove the automated action" (per this FR's Problem statement) is just setting points to 0 --
// no separate disabled flag, same override mechanism as the tiers above.
export async function setLoyaltyEventOverride(campaignId: string, eventId: number, points: number): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  if (!(await requireGm(supabase, campaignId, user.id))) return { error: 'Only the GM can change Loyalty settings' }
  if (!Number.isInteger(points)) return { error: 'Enter a whole number' }

  const { error } = await supabase
    .from('campaign_loyalty_event_overrides')
    .upsert({ campaign_id: campaignId, event_id: eventId, points })
  if (error) return { error: error.message }
  return { success: true }
}

export async function resetLoyaltyEventOverride(campaignId: string, eventId: number): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  if (!(await requireGm(supabase, campaignId, user.id))) return { error: 'Only the GM can change Loyalty settings' }

  const { error } = await supabase.from('campaign_loyalty_event_overrides').delete().eq('campaign_id', campaignId).eq('event_id', eventId)
  if (error) return { error: error.message }
  return { success: true }
}
