'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { POINT_BUY_BUDGET, STAT_KEYS, pointBuyCost, type StatKey } from '@/lib/pta3/pointBuy'
import { isLabelColor, type LabelColor } from '@/lib/pta3/labelColors'
import { trainerHref } from '@/lib/pta3/trainerPaths'
import { validateCreationSkillTalentPicks, applySkillTalentPicks } from '@/lib/pta3/skillTalents'

// Mirrors createTrainer (app/trainers/actions.ts) -- same name/class/origin/25-point stat-budget
// validation -- but is deliberately its own function, not a shared refactor: campaignId here is
// required and validated as GM-of-that-campaign only (not createTrainer's "GM or member" check),
// the row is inserted with user_id set to the GM's own id and is_npc: true, error redirects point
// at this campaign's npcs/new page instead of /trainers/new, and success skips the
// /trainers/{id}/starter flow entirely -- that's a player-only ceremony an NPC doesn't need.
export async function createNpc(campaignId: string, formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const name = (formData.get('name') as string)?.trim()
  const classId = Number(formData.get('classId'))
  const originId = Number(formData.get('originId'))

  const stats: Record<StatKey, number> = {
    attack: Number(formData.get('attack')),
    defense: Number(formData.get('defense')),
    specialAttack: Number(formData.get('specialAttack')),
    specialDefense: Number(formData.get('specialDefense')),
    speed: Number(formData.get('speed')),
  }

  const npcNewUrl = `/campaigns/${campaignId}/npcs/new`

  if (!name) {
    redirect(`${npcNewUrl}?error=${encodeURIComponent('Name is required')}`)
  }
  if (!classId) {
    redirect(`${npcNewUrl}?error=${encodeURIComponent('Class is required')}`)
  }
  if (!originId) {
    redirect(`${npcNewUrl}?error=${encodeURIComponent('Origin is required')}`)
  }
  for (const key of STAT_KEYS) {
    if (!Number.isInteger(stats[key]) || stats[key] < 1 || stats[key] > 6) {
      redirect(`${npcNewUrl}?error=${encodeURIComponent('Each stat must be between 1 and 6')}`)
    }
  }

  const cost = pointBuyCost(stats)
  if (cost !== POINT_BUY_BUDGET) {
    redirect(
      `${npcNewUrl}?error=${encodeURIComponent(`Point buy must use exactly ${POINT_BUY_BUDGET} points (used ${cost})`)}`,
    )
  }

  const talentResult = await validateCreationSkillTalentPicks(supabase, classId, originId, formData)
  if ('error' in talentResult) {
    redirect(`${npcNewUrl}?error=${encodeURIComponent(talentResult.error)}`)
  }

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id')
    .eq('id', campaignId)
    .eq('gm_user_id', user.id)
    .maybeSingle()

  if (!campaign) {
    redirect(`${npcNewUrl}?error=${encodeURIComponent('You are not the GM of that campaign')}`)
  }

  const { data: trainer, error } = await supabase
    .from('trainers')
    .insert({
      user_id: user.id,
      name,
      class_id: classId,
      origin_id: originId,
      campaign_id: campaignId,
      is_npc: true,
      base_attack: stats.attack,
      base_defense: stats.defense,
      base_special_attack: stats.specialAttack,
      base_special_defense: stats.specialDefense,
      base_speed: stats.speed,
    })
    .select('id')
    .single()

  if (error || !trainer) {
    redirect(`${npcNewUrl}?error=${encodeURIComponent(error?.message ?? 'Could not create NPC')}`)
  }

  await applySkillTalentPicks(supabase, trainer.id, talentResult.skillIds)

  redirect(`${trainerHref({ id: trainer.id, is_npc: true, campaign_id: campaignId })}/build`)
}

// Promotes an existing trainer (created the normal way, anywhere -- no campaign, or a different
// one) into an NPC of this campaign: sets campaign_id to here and is_npc to true in one update.
// GM-only, and only for a trainer the GM already owns themselves -- this is "turn my own spare
// trainer into an NPC," not a way to conscript someone else's trainer. Once converted, the
// existing is_npc-driven RLS/visibility rules (same ones createNpc relies on) apply automatically:
// it disappears from fellow players' view and from the global /trainers list, and starts showing
// up on this campaign's NPC roster instead.
export async function convertTrainerToNpc(campaignId: string, formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const npcsUrl = `/campaigns/${campaignId}/npcs`
  const trainerId = (formData.get('trainerId') as string)?.trim()

  if (!trainerId) {
    redirect(`${npcsUrl}?error=${encodeURIComponent('Choose a trainer to convert')}`)
  }

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id')
    .eq('id', campaignId)
    .eq('gm_user_id', user.id)
    .maybeSingle()

  if (!campaign) {
    redirect(`${npcsUrl}?error=${encodeURIComponent('You are not the GM of that campaign')}`)
  }

  // Explicit .eq('user_id', ...) and .eq('is_npc', false) -- this should only ever mean "turn one
  // of MY regular trainers into an NPC here," not any trainer, and not a no-op re-convert of one
  // that's already an NPC (which could otherwise silently steal it from a different campaign).
  const { data: trainer, error } = await supabase
    .from('trainers')
    .update({ campaign_id: campaignId, is_npc: true })
    .eq('id', trainerId)
    .eq('user_id', user.id)
    .eq('is_npc', false)
    .select('id')
    .maybeSingle()

  if (error) {
    redirect(`${npcsUrl}?error=${encodeURIComponent(error.message)}`)
  }
  if (!trainer) {
    redirect(`${npcsUrl}?error=${encodeURIComponent('Not authorized to convert that trainer, or it is already an NPC')}`)
  }

  redirect(trainerHref({ id: trainer.id, is_npc: true, campaign_id: campaignId }))
}

// GM-only, creates a new campaign label (name + a color from the fixed palette). Called directly
// from a client component (no <form action>, no redirect/returnTo) -- the new label is returned so
// the caller can add it to whatever local label list is driving its checkbox pickers, wherever on
// the page that happened to be, instead of needing a page reload to see it.
export async function createLabel(
  campaignId: string,
  name: string,
  color: string,
): Promise<{ error: string } | { label: { id: string; name: string; color: LabelColor } }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const trimmedName = name.trim()
  const safeColor: LabelColor = color && isLabelColor(color) ? color : 'gray'

  if (!trimmedName) {
    return { error: 'Label name is required' }
  }

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id')
    .eq('id', campaignId)
    .eq('gm_user_id', user.id)
    .maybeSingle()

  if (!campaign) {
    return { error: 'You are not the GM of that campaign' }
  }

  const { data: label, error } = await supabase
    .from('campaign_labels')
    .insert({ campaign_id: campaignId, name: trimmedName, color: safeColor })
    .select('id, name, color')
    .single()

  if (error || !label) {
    return { error: error?.message ?? 'Failed to create label' }
  }

  return { label: { id: String(label.id), name: label.name, color: label.color as LabelColor } }
}

// GM-only, replaces a trainer's (NPC's) full label set at once from the submitted checkbox values
// -- same "delete then insert everything" shape as setPokemonEvs
// (app/trainers/[id]/pokemon/actions.ts). Called directly from a client component, so toggling
// labels on an NPC's sheet updates in place instead of reloading the page.
export async function setTrainerLabels(trainerId: string, labelIds: string[]): Promise<{ error: string } | { labelIds: string[] }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { error: deleteError } = await supabase.from('trainer_labels').delete().eq('trainer_id', trainerId)

  if (deleteError) {
    return { error: deleteError.message }
  }

  if (labelIds.length > 0) {
    const { error: insertError } = await supabase
      .from('trainer_labels')
      .insert(labelIds.map((labelId) => ({ trainer_id: trainerId, label_id: labelId })))

    if (insertError) {
      return { error: insertError.message }
    }
  }

  return { labelIds }
}

// GM-only, same replace-all shape as setTrainerLabels. Called directly from a client component, so
// editing a Wild Pokemon's labels updates that row in place instead of reloading the whole list
// (which previously had to redirect back via a `returnTo` field since Wild Pokemon have no detail
// page of their own to land on).
export async function setPokemonLabels(
  pokemonId: string,
  labelIds: string[],
): Promise<{ error: string } | { labelIds: string[] }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { error: deleteError } = await supabase.from('pokemon_labels').delete().eq('pokemon_id', pokemonId)

  if (deleteError) {
    return { error: deleteError.message }
  }

  if (labelIds.length > 0) {
    const { error: insertError } = await supabase
      .from('pokemon_labels')
      .insert(labelIds.map((labelId) => ({ pokemon_id: pokemonId, label_id: labelId })))

    if (insertError) {
      return { error: insertError.message }
    }
  }

  return { labelIds }
}
