'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

// [[Feature - GM Custom - Proficiency]]: same "re-derive GM-ness server-side, RLS backs it up too"
// shape as every other "GM Custom X" sibling's own requireGm.
async function requireGm(supabase: SupabaseClient, campaignId: string, userId: string): Promise<boolean> {
  const { data: campaign } = await supabase.from('campaigns').select('gm_user_id').eq('id', campaignId).maybeSingle()
  return campaign?.gm_user_id === userId
}

function optionalText(formData: FormData, key: string): string | null {
  const raw = (formData.get(key) as string)?.trim()
  return raw || null
}

type ProficiencyFields = {
  name: string
  description: string | null
}

function parseProficiencyFields(formData: FormData): { error: string } | { fields: ProficiencyFields } {
  const name = (formData.get('name') as string)?.trim()
  if (!name) return { error: 'Name is required' }

  return {
    fields: {
      name,
      description: optionalText(formData, 'description'),
    },
  }
}

export async function createCustomProficiency(campaignId: string, formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (!(await requireGm(supabase, campaignId, user.id))) {
    redirect(`/campaigns/${campaignId}/custom/proficiencies?error=${encodeURIComponent('Only the GM can add custom proficiencies')}`)
  }

  const parsed = parseProficiencyFields(formData)
  if ('error' in parsed) {
    redirect(`/campaigns/${campaignId}/custom/proficiencies/new?error=${encodeURIComponent(parsed.error)}`)
  }

  const { data: inserted, error } = await supabase
    .from('proficiencies')
    .insert({ ...parsed.fields, campaign_id: campaignId })
    .select('id')
    .single()

  if (error || !inserted) {
    const message = error?.code === '23505' ? `This campaign already has a proficiency named "${parsed.fields.name}"` : (error?.message ?? 'Could not create proficiency')
    redirect(`/campaigns/${campaignId}/custom/proficiencies/new?error=${encodeURIComponent(message)}`)
  }

  redirect(`/campaigns/${campaignId}/custom/proficiencies/${inserted.id}`)
}

export async function updateCustomProficiency(campaignId: string, proficiencyId: number, formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (!(await requireGm(supabase, campaignId, user.id))) {
    redirect(`/campaigns/${campaignId}/custom/proficiencies?error=${encodeURIComponent('Only the GM can edit custom proficiencies')}`)
  }

  const parsed = parseProficiencyFields(formData)
  if ('error' in parsed) {
    redirect(`/campaigns/${campaignId}/custom/proficiencies/${proficiencyId}?error=${encodeURIComponent(parsed.error)}`)
  }

  const { error } = await supabase.from('proficiencies').update(parsed.fields).eq('id', proficiencyId).eq('campaign_id', campaignId)

  if (error) {
    const message = error.code === '23505' ? `This campaign already has a proficiency named "${parsed.fields.name}"` : error.message
    redirect(`/campaigns/${campaignId}/custom/proficiencies/${proficiencyId}?error=${encodeURIComponent(message)}`)
  }

  redirect(`/campaigns/${campaignId}/custom/proficiencies/${proficiencyId}?saved=1`)
}

export async function deleteCustomProficiency(campaignId: string, proficiencyId: number) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (!(await requireGm(supabase, campaignId, user.id))) {
    redirect(`/campaigns/${campaignId}/custom/proficiencies?error=${encodeURIComponent('Only the GM can delete custom proficiencies')}`)
  }

  // pokedex_proficiencies.proficiency_id and moves_proficiencies.proficiency_id are both on delete
  // cascade -- deleting a Proficiency just drops that tag off whichever of this Campaign's own custom
  // species/Moves had it, the same "definitional data, fine to cascade" treatment as every sibling
  // relation table in this family. No delete-in-use guard needed here.
  const { error } = await supabase.from('proficiencies').delete().eq('id', proficiencyId).eq('campaign_id', campaignId)
  if (error) {
    redirect(`/campaigns/${campaignId}/custom/proficiencies/${proficiencyId}?error=${encodeURIComponent(error.message)}`)
  }

  redirect(`/campaigns/${campaignId}/custom/proficiencies`)
}
