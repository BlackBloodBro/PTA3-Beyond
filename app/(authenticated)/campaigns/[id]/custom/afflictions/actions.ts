'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

// [[Feature - GM Custom - Afflictions]]: same "re-derive GM-ness server-side, RLS backs it up too"
// shape as [[Feature - GM Custom - Pokemon]]/[[Feature - GM Custom - Items]]'s own requireGm.
async function requireGm(supabase: SupabaseClient, campaignId: string, userId: string): Promise<boolean> {
  const { data: campaign } = await supabase.from('campaigns').select('gm_user_id').eq('id', campaignId).maybeSingle()
  return campaign?.gm_user_id === userId
}

function optionalInt(formData: FormData, key: string): number | null {
  const raw = (formData.get(key) as string)?.trim()
  if (!raw) return null
  const n = Number(raw)
  return Number.isNaN(n) ? null : n
}

function optionalText(formData: FormData, key: string): string | null {
  const raw = (formData.get(key) as string)?.trim()
  return raw || null
}

// afflictions_stats supports more than one stat modifier per affliction, but the form is a fixed grid
// (one input per stat.id, matching STAT_IDS in AfflictionFields.tsx) rather than a dynamic add/remove
// list -- there are only 6 stats total, the same "small enough to always show every option" call as
// GM Custom Pokemon's habitat/proficiency checkboxes. A blank input means "no modifier for this stat",
// not "modifier 0" -- only stats with an actual value get a row.
async function replaceStatModifiers(supabase: SupabaseClient, afflictionId: number, formData: FormData, statIds: number[]) {
  await supabase.from('afflictions_stats').delete().eq('affliction_id', afflictionId)
  const rows = statIds
    .map((statId) => ({ statId, modifier: optionalInt(formData, `statModifier_${statId}`) }))
    .filter((r): r is { statId: number; modifier: number } => r.modifier !== null)
  if (rows.length > 0) {
    await supabase.from('afflictions_stats').insert(rows.map((r) => ({ affliction_id: afflictionId, stat_id: r.statId, modifier: r.modifier })))
  }
}

type AfflictionFieldsParsed = {
  name: string
  description: string | null
  catch_modifier: number | null
}

function parseAfflictionFields(formData: FormData): { error: string } | { fields: AfflictionFieldsParsed } {
  const name = (formData.get('name') as string)?.trim()
  if (!name) return { error: 'Name is required' }

  return {
    fields: {
      name,
      description: optionalText(formData, 'description'),
      catch_modifier: optionalInt(formData, 'catchModifier'),
    },
  }
}

export async function createCustomAffliction(campaignId: string, statIds: number[], formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (!(await requireGm(supabase, campaignId, user.id))) {
    redirect(`/campaigns/${campaignId}/custom/afflictions?error=${encodeURIComponent('Only the GM can add custom afflictions')}`)
  }

  const parsed = parseAfflictionFields(formData)
  if ('error' in parsed) {
    redirect(`/campaigns/${campaignId}/custom/afflictions/new?error=${encodeURIComponent(parsed.error)}`)
  }

  const { data: inserted, error } = await supabase
    .from('afflictions')
    .insert({ ...parsed.fields, campaign_id: campaignId })
    .select('id')
    .single()

  if (error || !inserted) {
    const message = error?.code === '23505' ? `This campaign already has an affliction named "${parsed.fields.name}"` : (error?.message ?? 'Could not create affliction')
    redirect(`/campaigns/${campaignId}/custom/afflictions/new?error=${encodeURIComponent(message)}`)
  }

  await replaceStatModifiers(supabase, inserted.id, formData, statIds)

  redirect(`/campaigns/${campaignId}/custom/afflictions/${inserted.id}`)
}

export async function updateCustomAffliction(campaignId: string, afflictionId: number, statIds: number[], formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (!(await requireGm(supabase, campaignId, user.id))) {
    redirect(`/campaigns/${campaignId}/custom/afflictions?error=${encodeURIComponent('Only the GM can edit custom afflictions')}`)
  }

  const parsed = parseAfflictionFields(formData)
  if ('error' in parsed) {
    redirect(`/campaigns/${campaignId}/custom/afflictions/${afflictionId}?error=${encodeURIComponent(parsed.error)}`)
  }

  const { error } = await supabase.from('afflictions').update(parsed.fields).eq('id', afflictionId).eq('campaign_id', campaignId)

  if (error) {
    const message = error.code === '23505' ? `This campaign already has an affliction named "${parsed.fields.name}"` : error.message
    redirect(`/campaigns/${campaignId}/custom/afflictions/${afflictionId}?error=${encodeURIComponent(message)}`)
  }

  await replaceStatModifiers(supabase, afflictionId, formData, statIds)

  redirect(`/campaigns/${campaignId}/custom/afflictions/${afflictionId}?saved=1`)
}

export async function deleteCustomAffliction(campaignId: string, afflictionId: number) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (!(await requireGm(supabase, campaignId, user.id))) {
    redirect(`/campaigns/${campaignId}/custom/afflictions?error=${encodeURIComponent('Only the GM can delete custom afflictions')}`)
  }

  // Unlike GM Custom Pokemon/Items' own equivalents, pokemon_afflictions.affliction_id is `on delete
  // cascade` -- the database would happily delete this affliction out from under every Pokemon
  // currently carrying it, with no error and no trace. Checked explicitly here instead, since nothing
  // stops that at the DB layer the way an ordinary FK restrict would. Goes through a SECURITY DEFINER
  // RPC rather than querying pokemon_afflictions directly -- that table's own RLS only lets a
  // Pokemon's actual Trainer-owner see its rows, so a GM's own query would silently see zero rows for
  // a player's Pokemon even when it's genuinely in use (caught live -- see the migration's own note).
  const { data: inUseCount } = await supabase.rpc('count_pokemon_using_affliction', { target_affliction_id: afflictionId })
  if (inUseCount && inUseCount > 0) {
    redirect(`/campaigns/${campaignId}/custom/afflictions/${afflictionId}?error=${encodeURIComponent("Can't delete an affliction that's currently applied to a Pokémon")}`)
  }

  const { error } = await supabase.from('afflictions').delete().eq('id', afflictionId).eq('campaign_id', campaignId)
  if (error) {
    redirect(`/campaigns/${campaignId}/custom/afflictions/${afflictionId}?error=${encodeURIComponent(error.message)}`)
  }

  redirect(`/campaigns/${campaignId}/custom/afflictions`)
}
