'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isMatchupChoice, type MatchupChoice } from './matchupChoices'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

// [[Feature - GM Custom - Type]]: same "re-derive GM-ness server-side, RLS backs it up too" shape as
// every other "GM Custom X" sibling's own requireGm.
async function requireGm(supabase: SupabaseClient, campaignId: string, userId: string): Promise<boolean> {
  const { data: campaign } = await supabase.from('campaigns').select('gm_user_id').eq('id', campaignId).maybeSingle()
  return campaign?.gm_user_id === userId
}

// Every other Type visible to this GM's own session -- global catalog + this Campaign's own customs,
// via the same RLS that already scopes every other picker. Used both to render the walkthrough grid
// and to know which attack_<id>/defend_<id> fields to expect back from the submitted form, rather than
// trusting a hidden field listing them (same "re-derive server-side" caution as validateSkillTalentPickSets).
export async function loadOtherVisibleTypes(supabase: SupabaseClient, excludeTypeId?: number): Promise<{ id: number; name: string }[]> {
  let query = supabase.from('types').select('id, name').neq('name', 'Special/Variable').order('name')
  if (excludeTypeId) query = query.neq('id', excludeTypeId)
  const { data } = await query
  return data ?? []
}

// One row per other visible Type (this new/edited Type attacking it, and it attacking this Type) plus
// the single self-matchup pick -- required an "explicit choice per relationship" walkthrough as its own
// design decision, not defaulting anything to neutral-by-omission.
function parseMatchupChoices(formData: FormData, otherTypeIds: number[]): { error: string } | { selfChoice: MatchupChoice; rows: { otherTypeId: number; attack: MatchupChoice; defend: MatchupChoice }[] } {
  const selfChoice = formData.get('self')
  if (!isMatchupChoice(selfChoice)) return { error: 'Pick how this Type matches up against itself' }

  const rows: { otherTypeId: number; attack: MatchupChoice; defend: MatchupChoice }[] = []
  for (const otherTypeId of otherTypeIds) {
    const attack = formData.get(`attack_${otherTypeId}`)
    const defend = formData.get(`defend_${otherTypeId}`)
    if (!isMatchupChoice(attack) || !isMatchupChoice(defend)) {
      return { error: 'Every matchup relationship needs an explicit pick' }
    }
    rows.push({ otherTypeId, attack, defend })
  }

  return { selfChoice, rows }
}

// Loads typeId's full matchup state, shaped for TypeFieldsInitial -- used both by the edit page (to
// pre-fill the current Type's own values) and the new page's template picker (to pre-fill a duplicate
// from an existing Type's values). A pair with no row at all defaults to 'neutral', matching how the
// global chart itself only stores non-neutral pairs.
export async function loadTypeMatchupState(
  supabase: SupabaseClient,
  typeId: number,
  otherTypeIds: number[],
): Promise<{ selfChoice: MatchupChoice; matchupsByOtherTypeId: Record<number, { attack: MatchupChoice; defend: MatchupChoice }> }> {
  const [{ data: matchupRows }, { data: immunityRows }] = await Promise.all([
    supabase.from('type_matchups').select('attacking_type_id, defending_type_id, modifier').or(`attacking_type_id.eq.${typeId},defending_type_id.eq.${typeId}`),
    supabase.from('type_immunities').select('attacking_type_id, defending_type_id').or(`attacking_type_id.eq.${typeId},defending_type_id.eq.${typeId}`),
  ])

  function resolve(attackingId: number, defendingId: number): MatchupChoice {
    if ((immunityRows ?? []).some((r) => r.attacking_type_id === attackingId && r.defending_type_id === defendingId)) return 'immune'
    const match = (matchupRows ?? []).find((r) => r.attacking_type_id === attackingId && r.defending_type_id === defendingId)
    if (match) return match.modifier === 1 ? 'effective' : 'resisted'
    return 'neutral'
  }

  const selfChoice = resolve(typeId, typeId)
  const matchupsByOtherTypeId: Record<number, { attack: MatchupChoice; defend: MatchupChoice }> = {}
  for (const otherTypeId of otherTypeIds) {
    matchupsByOtherTypeId[otherTypeId] = { attack: resolve(typeId, otherTypeId), defend: resolve(otherTypeId, typeId) }
  }

  return { selfChoice, matchupsByOtherTypeId }
}

// Replaces every type_matchups/type_immunities row involving typeId wholesale -- delete-then-insert,
// same shape as replaceStatModifiers elsewhere in this family. A 'neutral' pick means no row at all
// (matches how the global chart itself already only stores non-neutral pairs).
async function replaceTypeMatchups(
  supabase: SupabaseClient,
  typeId: number,
  selfChoice: MatchupChoice,
  rows: { otherTypeId: number; attack: MatchupChoice; defend: MatchupChoice }[],
): Promise<{ error: string } | { ok: true }> {
  const [{ error: delMatchups }, { error: delImmunities }] = await Promise.all([
    supabase.from('type_matchups').delete().or(`attacking_type_id.eq.${typeId},defending_type_id.eq.${typeId}`),
    supabase.from('type_immunities').delete().or(`attacking_type_id.eq.${typeId},defending_type_id.eq.${typeId}`),
  ])
  if (delMatchups) return { error: delMatchups.message }
  if (delImmunities) return { error: delImmunities.message }

  const matchupRows: { attacking_type_id: number; defending_type_id: number; modifier: number }[] = []
  const immunityRows: { attacking_type_id: number; defending_type_id: number }[] = []

  function apply(attackingId: number, defendingId: number, choice: MatchupChoice) {
    if (choice === 'immune') immunityRows.push({ attacking_type_id: attackingId, defending_type_id: defendingId })
    else if (choice === 'resisted') matchupRows.push({ attacking_type_id: attackingId, defending_type_id: defendingId, modifier: -1 })
    else if (choice === 'effective') matchupRows.push({ attacking_type_id: attackingId, defending_type_id: defendingId, modifier: 1 })
    // 'neutral' -- no row
  }

  apply(typeId, typeId, selfChoice)
  for (const row of rows) {
    apply(typeId, row.otherTypeId, row.attack)
    apply(row.otherTypeId, typeId, row.defend)
  }

  if (matchupRows.length > 0) {
    const { error } = await supabase.from('type_matchups').insert(matchupRows)
    if (error) return { error: error.message }
  }
  if (immunityRows.length > 0) {
    const { error } = await supabase.from('type_immunities').insert(immunityRows)
    if (error) return { error: error.message }
  }

  return { ok: true }
}

export async function createCustomType(campaignId: string, formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (!(await requireGm(supabase, campaignId, user.id))) {
    redirect(`/campaigns/${campaignId}/custom/types?error=${encodeURIComponent('Only the GM can add custom types')}`)
  }

  const name = (formData.get('name') as string)?.trim()
  if (!name) {
    redirect(`/campaigns/${campaignId}/custom/types/new?error=${encodeURIComponent('Name is required')}`)
  }

  const otherTypes = await loadOtherVisibleTypes(supabase)
  const parsed = parseMatchupChoices(formData, otherTypes.map((t) => t.id))
  if ('error' in parsed) {
    redirect(`/campaigns/${campaignId}/custom/types/new?error=${encodeURIComponent(parsed.error)}`)
  }

  const { data: inserted, error } = await supabase.from('types').insert({ name, campaign_id: campaignId }).select('id').single()

  if (error || !inserted) {
    const message = error?.code === '23505' ? `This campaign already has a type named "${name}"` : (error?.message ?? 'Could not create type')
    redirect(`/campaigns/${campaignId}/custom/types/new?error=${encodeURIComponent(message)}`)
  }

  const result = await replaceTypeMatchups(supabase, inserted.id, parsed.selfChoice, parsed.rows)
  if ('error' in result) {
    redirect(`/campaigns/${campaignId}/custom/types/${inserted.id}?error=${encodeURIComponent(result.error)}`)
  }

  redirect(`/campaigns/${campaignId}/custom/types/${inserted.id}`)
}

export async function updateCustomType(campaignId: string, typeId: number, formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (!(await requireGm(supabase, campaignId, user.id))) {
    redirect(`/campaigns/${campaignId}/custom/types?error=${encodeURIComponent('Only the GM can edit custom types')}`)
  }

  const name = (formData.get('name') as string)?.trim()
  if (!name) {
    redirect(`/campaigns/${campaignId}/custom/types/${typeId}?error=${encodeURIComponent('Name is required')}`)
  }

  const otherTypes = await loadOtherVisibleTypes(supabase, typeId)
  const parsed = parseMatchupChoices(formData, otherTypes.map((t) => t.id))
  if ('error' in parsed) {
    redirect(`/campaigns/${campaignId}/custom/types/${typeId}?error=${encodeURIComponent(parsed.error)}`)
  }

  const { error } = await supabase.from('types').update({ name }).eq('id', typeId).eq('campaign_id', campaignId)
  if (error) {
    const message = error.code === '23505' ? `This campaign already has a type named "${name}"` : error.message
    redirect(`/campaigns/${campaignId}/custom/types/${typeId}?error=${encodeURIComponent(message)}`)
  }

  const result = await replaceTypeMatchups(supabase, typeId, parsed.selfChoice, parsed.rows)
  if ('error' in result) {
    redirect(`/campaigns/${campaignId}/custom/types/${typeId}?error=${encodeURIComponent(result.error)}`)
  }

  redirect(`/campaigns/${campaignId}/custom/types/${typeId}?saved=1`)
}

export async function deleteCustomType(campaignId: string, typeId: number) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (!(await requireGm(supabase, campaignId, user.id))) {
    redirect(`/campaigns/${campaignId}/custom/types?error=${encodeURIComponent('Only the GM can delete custom types')}`)
  }

  // Unlike type_matchups/type_immunities (the Type's own definition, cascades away), a custom Move/
  // Pokedex species/held-item boost, a specific Pokemon's own type override, or a Trainer's "Type ace"
  // pick can all actually use this Type -- none of those seven columns cascade, so
  // count_type_usages bypasses RLS to check all of them before allowing deletion.
  const { data: usageCount } = await supabase.rpc('count_type_usages', { target_type_id: typeId })
  if (usageCount && usageCount > 0) {
    redirect(`/campaigns/${campaignId}/custom/types/${typeId}?error=${encodeURIComponent("Can't delete a type that's already in use by a Move, Pokemon, species, item, or Trainer")}`)
  }

  const { error } = await supabase.from('types').delete().eq('id', typeId).eq('campaign_id', campaignId)
  if (error) {
    redirect(`/campaigns/${campaignId}/custom/types/${typeId}?error=${encodeURIComponent(error.message)}`)
  }

  redirect(`/campaigns/${campaignId}/custom/types`)
}
