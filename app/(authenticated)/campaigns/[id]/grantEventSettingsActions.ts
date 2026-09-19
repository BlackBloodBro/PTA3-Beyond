'use server'

import { createClient } from '@/lib/supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

// Same reasoning as every other "GM Custom"/campaign-settings action set this mirrors: RLS backs this
// up too (the migration's "GM manages their campaign's grant event ... overrides" policies), but
// checking here first turns a bad request into a clean error instead of a raw RLS-denial message.
async function requireGm(supabase: SupabaseClient, campaignId: string, userId: string): Promise<boolean> {
  const { data: campaign } = await supabase.from('campaigns').select('gm_user_id').eq('id', campaignId).maybeSingle()
  return campaign?.gm_user_id === userId
}

// [[Feature - Add more automated EXP and Loyalty Point triggers]]: "remove the trigger" is just setting
// its amount to 0 -- no separate disabled flag, same override mechanism as every other Customization
// setting. EXP and LP are independent overrides on the same event, hence separate set/reset pairs.
export async function setGrantEventExpOverride(campaignId: string, eventId: number, exp: number): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  if (!(await requireGm(supabase, campaignId, user.id))) return { error: 'Only the GM can change EXP grant settings' }
  if (!Number.isInteger(exp)) return { error: 'Enter a whole number' }

  const { error } = await supabase.from('campaign_grant_event_exp_overrides').upsert({ campaign_id: campaignId, event_id: eventId, exp })
  if (error) return { error: error.message }
  return { success: true }
}

export async function resetGrantEventExpOverride(campaignId: string, eventId: number): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  if (!(await requireGm(supabase, campaignId, user.id))) return { error: 'Only the GM can change EXP grant settings' }

  const { error } = await supabase.from('campaign_grant_event_exp_overrides').delete().eq('campaign_id', campaignId).eq('event_id', eventId)
  if (error) return { error: error.message }
  return { success: true }
}

export async function setGrantEventLoyaltyOverride(
  campaignId: string,
  eventId: number,
  loyaltyPoints: number,
): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  if (!(await requireGm(supabase, campaignId, user.id))) return { error: 'Only the GM can change Loyalty grant settings' }
  if (!Number.isInteger(loyaltyPoints)) return { error: 'Enter a whole number' }

  const { error } = await supabase
    .from('campaign_grant_event_loyalty_overrides')
    .upsert({ campaign_id: campaignId, event_id: eventId, loyalty_points: loyaltyPoints })
  if (error) return { error: error.message }
  return { success: true }
}

export async function resetGrantEventLoyaltyOverride(campaignId: string, eventId: number): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  if (!(await requireGm(supabase, campaignId, user.id))) return { error: 'Only the GM can change Loyalty grant settings' }

  const { error } = await supabase.from('campaign_grant_event_loyalty_overrides').delete().eq('campaign_id', campaignId).eq('event_id', eventId)
  if (error) return { error: error.message }
  return { success: true }
}
