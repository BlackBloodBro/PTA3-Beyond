'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

// [[Feature - GM Custom - Moves]]: same "re-derive GM-ness server-side, RLS backs it up too" shape as
// every other "GM Custom X" FR's own requireGm.
async function requireGm(supabase: SupabaseClient, campaignId: string, userId: string): Promise<boolean> {
  const { data: campaign } = await supabase.from('campaigns').select('gm_user_id').eq('id', campaignId).maybeSingle()
  return campaign?.gm_user_id === userId
}

function toIdArray(formData: FormData, key: string): number[] {
  return formData
    .getAll(key)
    .map((v) => Number(v))
    .filter((n) => !Number.isNaN(n))
}

function optionalText(formData: FormData, key: string): string | null {
  const raw = (formData.get(key) as string)?.trim()
  return raw || null
}

async function replaceProficiencies(supabase: SupabaseClient, moveId: number, ids: number[]) {
  await supabase.from('moves_proficiencies').delete().eq('move_id', moveId)
  if (ids.length > 0) {
    await supabase.from('moves_proficiencies').insert(ids.map((id) => ({ move_id: moveId, proficiency_id: id })))
  }
}

type MoveFieldsParsed = {
  name: string
  type_id: number
  damage_stat: string
  range: string | null
  frequency: string | null
  damage_dice: string | null
  description: string | null
}

const DAMAGE_STATS = ['physical', 'special', 'either', 'effect']

function parseMoveFields(formData: FormData): { error: string } | { fields: MoveFieldsParsed } {
  const name = (formData.get('name') as string)?.trim()
  if (!name) return { error: 'Name is required' }

  const typeIdRaw = (formData.get('typeId') as string)?.trim()
  const typeId = typeIdRaw ? Number(typeIdRaw) : NaN
  if (!typeIdRaw || Number.isNaN(typeId)) return { error: 'Type is required' }

  const damageStat = (formData.get('damageStat') as string)?.trim()
  if (!DAMAGE_STATS.includes(damageStat)) return { error: 'Damage stat is required' }

  return {
    fields: {
      name,
      type_id: typeId,
      damage_stat: damageStat,
      range: optionalText(formData, 'range'),
      frequency: optionalText(formData, 'frequency'),
      damage_dice: optionalText(formData, 'damageDice'),
      description: optionalText(formData, 'description'),
    },
  }
}

export async function createCustomMove(campaignId: string, formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (!(await requireGm(supabase, campaignId, user.id))) {
    redirect(`/campaigns/${campaignId}/custom/moves?error=${encodeURIComponent('Only the GM can add custom Moves')}`)
  }

  const parsed = parseMoveFields(formData)
  if ('error' in parsed) {
    redirect(`/campaigns/${campaignId}/custom/moves/new?error=${encodeURIComponent(parsed.error)}`)
  }

  const { data: inserted, error } = await supabase
    .from('moves')
    .insert({ ...parsed.fields, campaign_id: campaignId })
    .select('id')
    .single()

  if (error || !inserted) {
    const message = error?.code === '23505' ? `This campaign already has a Move named "${parsed.fields.name}"` : (error?.message ?? 'Could not create Move')
    redirect(`/campaigns/${campaignId}/custom/moves/new?error=${encodeURIComponent(message)}`)
  }

  await replaceProficiencies(supabase, inserted.id, toIdArray(formData, 'proficiencyIds'))

  redirect(`/campaigns/${campaignId}/custom/moves/${inserted.id}`)
}

export async function updateCustomMove(campaignId: string, moveId: number, formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (!(await requireGm(supabase, campaignId, user.id))) {
    redirect(`/campaigns/${campaignId}/custom/moves?error=${encodeURIComponent('Only the GM can edit custom Moves')}`)
  }

  const parsed = parseMoveFields(formData)
  if ('error' in parsed) {
    redirect(`/campaigns/${campaignId}/custom/moves/${moveId}?error=${encodeURIComponent(parsed.error)}`)
  }

  const { error } = await supabase.from('moves').update(parsed.fields).eq('id', moveId).eq('campaign_id', campaignId)

  if (error) {
    const message = error.code === '23505' ? `This campaign already has a Move named "${parsed.fields.name}"` : error.message
    redirect(`/campaigns/${campaignId}/custom/moves/${moveId}?error=${encodeURIComponent(message)}`)
  }

  await replaceProficiencies(supabase, moveId, toIdArray(formData, 'proficiencyIds'))

  redirect(`/campaigns/${campaignId}/custom/moves/${moveId}?saved=1`)
}

export async function deleteCustomMove(campaignId: string, moveId: number) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (!(await requireGm(supabase, campaignId, user.id))) {
    redirect(`/campaigns/${campaignId}/custom/moves?error=${encodeURIComponent('Only the GM can delete custom Moves')}`)
  }

  // pokemon_moves.move_id/trainer_moves.move_id/pokemon_move_grants.move_id are all `on delete
  // cascade` (unlike a plain FK restrict) -- a Pokemon/Trainer's actually-learned Move would silently
  // vanish otherwise. Checked via a SECURITY DEFINER RPC rather than querying those tables directly --
  // same fix [[Feature - GM Custom - Afflictions]] needed, applied proactively here since a plain
  // query from the GM's own session isn't a reliable way to see every Campaign member's own rows.
  const { data: usageCount } = await supabase.rpc('count_move_usages', { target_move_id: moveId })
  if (usageCount && usageCount > 0) {
    redirect(`/campaigns/${campaignId}/custom/moves/${moveId}?error=${encodeURIComponent("Can't delete a Move that's already known by a Pokémon or Trainer")}`)
  }

  // pokedex_moves/moves_proficiencies aren't checked above -- those are the Move's own definitional
  // data (which species can learn it, its Proficiency tags), fine to cascade-delete alongside it.
  // trainers_items.move_id (a TM/TR item's attached Move) has no cascade at all, so it still blocks
  // deletion below via a real FK-violation error if a Bag item is currently attached to this Move.
  const { error } = await supabase.from('moves').delete().eq('id', moveId).eq('campaign_id', campaignId)
  if (error) {
    const message = error.code === '23503' ? "Can't delete a Move that's currently attached to a Bag item" : error.message
    redirect(`/campaigns/${campaignId}/custom/moves/${moveId}?error=${encodeURIComponent(message)}`)
  }

  redirect(`/campaigns/${campaignId}/custom/moves`)
}
