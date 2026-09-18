'use server'

import { createClient } from '@/lib/supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

// Same reasoning as loyaltySettingsActions.ts/expGrantSettingsActions.ts: RLS backs this up too (the
// migration's "GM manages their campaign's level band overrides" policy), but checking here first
// turns a bad request into a clean error instead of a raw RLS-denial message.
async function requireGm(supabase: SupabaseClient, campaignId: string, userId: string): Promise<boolean> {
  const { data: campaign } = await supabase.from('campaigns').select('gm_user_id').eq('id', campaignId).maybeSingle()
  return campaign?.gm_user_id === userId
}

export async function setLevelBandOverride(campaignId: string, band: number, expPerLevel: number): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  if (!(await requireGm(supabase, campaignId, user.id))) return { error: 'Only the GM can change level band settings' }
  if (!Number.isInteger(expPerLevel) || expPerLevel < 1) return { error: 'Enter a whole number of 1 or more' }

  const { error } = await supabase.from('campaign_level_band_overrides').upsert({ campaign_id: campaignId, band, exp_per_level: expPerLevel })
  if (error) return { error: error.message }
  return { success: true }
}

export async function resetLevelBandOverride(campaignId: string, band: number): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  if (!(await requireGm(supabase, campaignId, user.id))) return { error: 'Only the GM can change level band settings' }

  const { error } = await supabase.from('campaign_level_band_overrides').delete().eq('campaign_id', campaignId).eq('band', band)
  if (error) return { error: error.message }
  return { success: true }
}
