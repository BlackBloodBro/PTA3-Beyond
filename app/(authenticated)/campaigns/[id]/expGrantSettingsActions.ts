'use server'

import { createClient } from '@/lib/supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

// Same reasoning as loyaltySettingsActions.ts: RLS backs this up too (the migration's "GM manages
// their campaign's exp grant overrides" policy), but checking here first turns a bad request into a
// clean error instead of a raw RLS-denial message.
async function requireGm(supabase: SupabaseClient, campaignId: string, userId: string): Promise<boolean> {
  const { data: campaign } = await supabase.from('campaigns').select('gm_user_id').eq('id', campaignId).maybeSingle()
  return campaign?.gm_user_id === userId
}

// [[Feature - Add triggers for a Pokemon to gain EXP automatically]]: "remove the trigger" is just
// setting its exp to 0 -- no separate disabled flag, same override mechanism as Loyalty settings.
export async function setExpGrantOverride(campaignId: string, eventId: number, exp: number): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  if (!(await requireGm(supabase, campaignId, user.id))) return { error: 'Only the GM can change EXP grant settings' }
  if (!Number.isInteger(exp)) return { error: 'Enter a whole number' }

  const { error } = await supabase.from('campaign_exp_grant_overrides').upsert({ campaign_id: campaignId, event_id: eventId, exp })
  if (error) return { error: error.message }
  return { success: true }
}

export async function resetExpGrantOverride(campaignId: string, eventId: number): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  if (!(await requireGm(supabase, campaignId, user.id))) return { error: 'Only the GM can change EXP grant settings' }

  const { error } = await supabase.from('campaign_exp_grant_overrides').delete().eq('campaign_id', campaignId).eq('event_id', eventId)
  if (error) return { error: error.message }
  return { success: true }
}
