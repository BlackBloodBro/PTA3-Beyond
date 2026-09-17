'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

// [[Feature - GM Custom - Passives]]: same "re-derive GM-ness server-side, RLS backs it up too"
// shape as every other "GM Custom X" FR's own requireGm.
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

// passives_stats supports more than one stat modifier per Passive, but there are only 6 stats total --
// a fixed grid (one input per stat.id), same shape as [[Feature - GM Custom - Afflictions]]'s own
// replaceStatModifiers, rather than a dynamic add/remove list.
async function replaceStatModifiers(supabase: SupabaseClient, passiveId: number, formData: FormData, statIds: number[]) {
  await supabase.from('passives_stats').delete().eq('passive_id', passiveId)
  const rows = statIds
    .map((statId) => ({ statId, modifier: optionalInt(formData, `statModifier_${statId}`) }))
    .filter((r): r is { statId: number; modifier: number } => r.modifier !== null)
  if (rows.length > 0) {
    await supabase.from('passives_stats').insert(rows.map((r) => ({ passive_id: passiveId, stat_id: r.statId, modifier: r.modifier })))
  }
}

type PassiveFieldsParsed = {
  name: string
  description: string | null
  passive_type: string
  category: string | null
  context: string | null
}

const PASSIVE_TYPES = ['stat', 'ability']
const CONTEXTS = ['combat', 'out_of_combat']

function parsePassiveFields(formData: FormData): { error: string } | { fields: PassiveFieldsParsed } {
  const name = (formData.get('name') as string)?.trim()
  if (!name) return { error: 'Name is required' }

  const passiveType = (formData.get('passiveType') as string)?.trim()
  if (!PASSIVE_TYPES.includes(passiveType)) return { error: 'Passive type is required' }

  const context = (formData.get('context') as string)?.trim()
  if (context && !CONTEXTS.includes(context)) return { error: 'Invalid context' }

  const category = (formData.get('category') as string)?.trim() || null
  if (passiveType === 'stat' && !category) return { error: 'Category is required for a Stat passive' }

  return {
    fields: {
      name,
      description: optionalText(formData, 'description'),
      passive_type: passiveType,
      category: passiveType === 'stat' ? category : null,
      context: context || null,
    },
  }
}

export async function createCustomPassive(campaignId: string, statIds: number[], formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (!(await requireGm(supabase, campaignId, user.id))) {
    redirect(`/campaigns/${campaignId}/custom/passives?error=${encodeURIComponent('Only the GM can add custom Passives')}`)
  }

  const parsed = parsePassiveFields(formData)
  if ('error' in parsed) {
    redirect(`/campaigns/${campaignId}/custom/passives/new?error=${encodeURIComponent(parsed.error)}`)
  }

  const { data: inserted, error } = await supabase
    .from('passives')
    .insert({ ...parsed.fields, campaign_id: campaignId })
    .select('id')
    .single()

  if (error || !inserted) {
    const message = error?.code === '23505' ? `This campaign already has a Passive named "${parsed.fields.name}"` : (error?.message ?? 'Could not create Passive')
    redirect(`/campaigns/${campaignId}/custom/passives/new?error=${encodeURIComponent(message)}`)
  }

  await replaceStatModifiers(supabase, inserted.id, formData, statIds)

  redirect(`/campaigns/${campaignId}/custom/passives/${inserted.id}`)
}

export async function updateCustomPassive(campaignId: string, passiveId: number, statIds: number[], formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (!(await requireGm(supabase, campaignId, user.id))) {
    redirect(`/campaigns/${campaignId}/custom/passives?error=${encodeURIComponent('Only the GM can edit custom Passives')}`)
  }

  const parsed = parsePassiveFields(formData)
  if ('error' in parsed) {
    redirect(`/campaigns/${campaignId}/custom/passives/${passiveId}?error=${encodeURIComponent(parsed.error)}`)
  }

  const { error } = await supabase.from('passives').update(parsed.fields).eq('id', passiveId).eq('campaign_id', campaignId)

  if (error) {
    const message = error.code === '23505' ? `This campaign already has a Passive named "${parsed.fields.name}"` : error.message
    redirect(`/campaigns/${campaignId}/custom/passives/${passiveId}?error=${encodeURIComponent(message)}`)
  }

  await replaceStatModifiers(supabase, passiveId, formData, statIds)

  redirect(`/campaigns/${campaignId}/custom/passives/${passiveId}?saved=1`)
}

export async function deleteCustomPassive(campaignId: string, passiveId: number) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (!(await requireGm(supabase, campaignId, user.id))) {
    redirect(`/campaigns/${campaignId}/custom/passives?error=${encodeURIComponent('Only the GM can delete custom Passives')}`)
  }

  // pokemon_passives.passive_id is `on delete cascade` -- checked via a SECURITY DEFINER RPC rather
  // than querying pokemon_passives directly, same fix [[Feature - GM Custom - Afflictions]]/
  // [[Feature - GM Custom - Moves]] needed for their own equivalents.
  const { data: usageCount } = await supabase.rpc('count_pokemon_using_passive', { target_passive_id: passiveId })
  if (usageCount && usageCount > 0) {
    redirect(`/campaigns/${campaignId}/custom/passives/${passiveId}?error=${encodeURIComponent("Can't delete a Passive that's already known by a Pokémon")}`)
  }

  const { error } = await supabase.from('passives').delete().eq('id', passiveId).eq('campaign_id', campaignId)
  if (error) {
    redirect(`/campaigns/${campaignId}/custom/passives/${passiveId}?error=${encodeURIComponent(error.message)}`)
  }

  redirect(`/campaigns/${campaignId}/custom/passives`)
}
