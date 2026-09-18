'use server'

import { createClient } from '@/lib/supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

// Same reasoning as the GM Custom Pokemon actions this mirrors: RLS backs this up too ("GM manages
// their campaign's excluded species"), but checking here first turns a bad request into a clean
// error instead of a raw RLS-denial Postgres error.
async function requireGm(supabase: SupabaseClient, campaignId: string, userId: string): Promise<boolean> {
  const { data: campaign } = await supabase.from('campaigns').select('gm_user_id').eq('id', campaignId).maybeSingle()
  return campaign?.gm_user_id === userId
}

// [[Feature - GM can restrict global catalog entries from a Campaign]]: plain functions called
// directly from the client toggle list, not <form action>s -- same shape as addSpeciesMove/
// removeSpeciesMove (campaigns/[id]/custom/pokedex/actions.ts), since a big searchable list toggling
// one row at a time doesn't fit a whole-page form submit.
export async function excludeSpecies(campaignId: string, pokedexId: number): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  if (!(await requireGm(supabase, campaignId, user.id))) return { error: 'Only the GM can exclude species' }

  const { error } = await supabase.from('campaign_excluded_pokedex').insert({ campaign_id: campaignId, pokedex_id: pokedexId })
  if (error && error.code !== '23505') return { error: error.message }
  return { success: true }
}

export async function includeSpecies(campaignId: string, pokedexId: number): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  if (!(await requireGm(supabase, campaignId, user.id))) return { error: 'Only the GM can include species' }

  const { error } = await supabase.from('campaign_excluded_pokedex').delete().eq('campaign_id', campaignId).eq('pokedex_id', pokedexId)
  if (error) return { error: error.message }
  return { success: true }
}
