'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function createCampaign(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const name = (formData.get('name') as string)?.trim()
  const description = (formData.get('description') as string)?.trim()

  if (!name) {
    redirect(`/campaigns/new?error=${encodeURIComponent('Name is required')}`)
  }

  const { data: campaign, error } = await supabase
    .from('campaigns')
    .insert({ name, description: description || null, gm_user_id: user.id })
    .select('id')
    .single()

  if (error || !campaign) {
    redirect(`/campaigns/new?error=${encodeURIComponent(error?.message ?? 'Could not create campaign')}`)
  }

  redirect(`/campaigns/${campaign.id}`)
}

export async function joinCampaign(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const code = (formData.get('code') as string)?.trim()

  if (!code) {
    redirect(`/campaigns/join?error=${encodeURIComponent('Invite code is required')}`)
  }

  const { data: campaignId, error } = await supabase.rpc('join_campaign', { code })

  if (error || !campaignId) {
    redirect(`/campaigns/join?error=${encodeURIComponent(error?.message ?? 'Could not join campaign')}`)
  }

  redirect(`/campaigns/${campaignId}`)
}

export async function leaveCampaign(trainerId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // .eq('user_id', user.id) here isn't just belt-and-suspenders -- it's what makes this "leave
  // MY trainer" rather than any trainer; RLS would allow a GM to null out campaign_id on a
  // player's trainer too (that's the "remove a player" action below), so this action needs its
  // own explicit ownership check to stay scoped to self-service use.
  await supabase.from('trainers').update({ campaign_id: null }).eq('id', trainerId).eq('user_id', user.id)

  redirect(`/trainers/${trainerId}`)
}

// Lets a trainer's owner assign it to (or move it between, or clear it from) any campaign they
// GM or are a member of, from the /trainers list -- the counterpart to leaveCampaign, but usable
// without already being on the campaign's own page, and without needing to go all the way back to
// the trainer-creation flow to set a campaign for the first time.
// Called directly from a client component (no <form action>, no redirect) so re-assigning a
// trainer's campaign from the /trainers list updates that row in place instead of reloading the
// whole list.
export async function assignTrainerToCampaign(
  trainerId: string,
  campaignIdRaw: string,
  // [[Improvement - Adding a Trainer to a GM'd Campaign should default it to an NPC]]: only ever
  // sent (and only ever applied) when the target campaign is one this user GMs -- the caller
  // (TrainerCampaignControl) omits it entirely for a "joined as member" campaign, same as
  // createTrainer's own isNpc handling.
  isNpc?: boolean,
): Promise<{ error: string } | { campaignId: string | null; campaignName: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Same ownership reasoning as leaveCampaign -- RLS would let a GM update a player's trainer too,
  // so this needs its own explicit check to stay scoped to "assign MY trainer."
  const { data: trainer } = await supabase.from('trainers').select('id').eq('id', trainerId).eq('user_id', user.id).maybeSingle()

  if (!trainer) {
    return { error: 'Not authorized to move that trainer' }
  }

  let campaignId: string | null = null
  let campaignName: string | null = null
  // A campaign-less Trainer can't be an NPC (NPCs are inherently campaign-scoped -- they only ever
  // show up on a Campaign's own roster) -- reset alongside campaignId whenever unassigning entirely.
  let resolvedIsNpc = false
  if (campaignIdRaw) {
    // Same "GM or joined member" check as createTrainer's own campaign assignment.
    const [{ data: asGM }, { data: asMember }, { data: campaign }] = await Promise.all([
      supabase.from('campaigns').select('id').eq('id', campaignIdRaw).eq('gm_user_id', user.id).maybeSingle(),
      supabase.from('campaign_members').select('campaign_id').eq('campaign_id', campaignIdRaw).eq('user_id', user.id).maybeSingle(),
      supabase.from('campaigns').select('name').eq('id', campaignIdRaw).maybeSingle(),
    ])
    if (!asGM && !asMember) {
      return { error: 'You are not part of that campaign' }
    }
    campaignId = campaignIdRaw
    campaignName = campaign?.name ?? null
    if (asGM) {
      resolvedIsNpc = isNpc ?? true
    }
  }

  const { error } = await supabase
    .from('trainers')
    .update({ campaign_id: campaignId, is_npc: resolvedIsNpc })
    .eq('id', trainerId)
    .eq('user_id', user.id)

  if (error) {
    return { error: error.message }
  }

  return { campaignId, campaignName }
}

// GM-only, same edit-toggle pattern as updateTrainerInfo -- called directly from a client component
// (no <form action>, no redirect) so the campaign page updates in place instead of reloading.
export async function updateCampaign(
  campaignId: string,
  input: { name: string; description: string },
): Promise<{ error: string } | { name: string; description: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const name = input.name.trim()
  const description = input.description.trim()

  if (!name) {
    return { error: 'Name is required' }
  }

  // RLS already restricts campaign updates to the GM, but this action needs its own explicit check
  // to return a client-friendly error instead of a silently-ignored zero-row update.
  const { data: campaign } = await supabase.from('campaigns').select('gm_user_id').eq('id', campaignId).maybeSingle()

  if (!campaign || campaign.gm_user_id !== user.id) {
    return { error: 'Only this campaign\'s GM can edit it' }
  }

  const { error } = await supabase
    .from('campaigns')
    .update({ name, description: description || null })
    .eq('id', campaignId)

  if (error) {
    return { error: error.message }
  }

  return { name, description: description || null }
}

// Percent of items.price a sold item returns, for every Trainer in this Campaign (see bag/actions.ts's
// sellItem) -- Campaign-wide, GM-only, same tier as editing the Campaign's Name/Description above.
// Moved here from a per-Trainer Bag-page control (see [[Move selling percentage to Campaign settings]])
// since it was never actually per-Trainer, just misleadingly placed.
export async function updateCampaignSellPricePercent(campaignId: string, percent: number): Promise<{ error: string } | { sellPricePercent: number }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: campaign } = await supabase.from('campaigns').select('gm_user_id').eq('id', campaignId).maybeSingle()

  if (!campaign || campaign.gm_user_id !== user.id) {
    return { error: 'Only this campaign\'s GM can change the sell price percentage' }
  }

  const clamped = Math.max(0, Math.min(100, Math.round(percent)))
  const { error } = await supabase.from('campaigns').update({ sell_price_percent: clamped }).eq('id', campaignId)

  if (error) {
    return { error: error.message }
  }

  return { sellPricePercent: clamped }
}

export async function removePlayer(campaignId: string, targetUserId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Both operations are gated by existing RLS (GM-of-this-campaign only), so this silently
  // affects zero rows for anyone who isn't the GM -- it's not a real permission check on its own.
  await supabase
    .from('trainers')
    .update({ campaign_id: null })
    .eq('campaign_id', campaignId)
    .eq('user_id', targetUserId)

  await supabase.from('campaign_members').delete().eq('campaign_id', campaignId).eq('user_id', targetUserId)

  redirect(`/campaigns/${campaignId}`)
}

export async function deleteCampaign(campaignId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Only player trainers block deletion -- they must be removed manually first (same as always).
  // NPCs are wholly GM-owned, so they're cleaned up automatically below rather than forcing the GM
  // to delete potentially dozens of them one at a time first.
  const { count } = await supabase
    .from('trainers')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .eq('is_npc', false)

  if (count && count > 0) {
    redirect(
      `/campaigns/${campaignId}?error=${encodeURIComponent(
        'Remove all trainers from the campaign before deleting it',
      )}`,
    )
  }

  // Deleting each NPC cascades its trainers_pokemon link (on delete cascade), which orphans their
  // Pokemon back into the unassigned pool rather than deleting the Pokemon -- intentional,
  // non-destructive default; the GM can separately clean up leftover pool Pokemon if they want.
  await supabase.from('trainers').delete().eq('campaign_id', campaignId).eq('is_npc', true)

  const { error } = await supabase.from('campaigns').delete().eq('id', campaignId)

  if (error) {
    redirect(`/campaigns/${campaignId}?error=${encodeURIComponent(error.message)}`)
  }

  redirect('/dashboard')
}
