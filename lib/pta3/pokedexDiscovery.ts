import type { createClient } from '@/lib/supabase/server'
import { trainerHasBaseClassFeature } from '@/lib/pta3/trainerFeatures'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

export type PokedexVisibility = { restricted: false } | { restricted: true; discoveredIds: number[] }

// [[Feature - Only show Pokemon a Trainer has encountered in the Pokedex]]: which species a viewer may see in a
// Campaign's Pokedex. A plain per-Campaign column (like `exp_disabled`), off by default.
//
// Unrestricted (everything) when: the Campaign's "discovery only" switch is off; the viewer is the GM (the same
// "GM always sees everything" convention as every other identification gate); or one of the viewer's own Trainers
// in the Campaign has the Researcher's "Walking encyclopedia" (its text: look through the Pokedex books as much as
// you like without scanning -- the same rule the Encounter already uses to identify opponents).
//
// Otherwise the viewer sees a species if it is in `campaign_scanned_species` (the party-shared "seen" record,
// written by scanning in an Encounter), or one of *their own* Trainers in the Campaign owns a Pokemon of it. Owned
// species are read here, at page load, rather than recorded on every acquisition, so starters, hatched eggs, gifts
// and caught Pokemon all count with no extra write path and no backfill.
export async function loadPokedexVisibility(supabase: SupabaseClient, campaignId: string, userId: string): Promise<PokedexVisibility> {
  const { data: campaign } = await supabase.from('campaigns').select('gm_user_id, pokedex_discovery_only').eq('id', campaignId).maybeSingle()
  if (!campaign || !campaign.pokedex_discovery_only || campaign.gm_user_id === userId) return { restricted: false }

  const { data: trainers } = await supabase.from('trainers').select('id').eq('campaign_id', campaignId).eq('user_id', userId)
  const trainerIds = (trainers ?? []).map((t) => t.id)

  const walking = await Promise.all(trainerIds.map((id) => trainerHasBaseClassFeature(supabase, id, 'Walking encyclopedia')))
  if (walking.some(Boolean)) return { restricted: false }

  const [{ data: scanned }, { data: owned }] = await Promise.all([
    supabase.from('campaign_scanned_species').select('pokedex_id').eq('campaign_id', campaignId),
    trainerIds.length > 0
      ? supabase.from('trainers_pokemon').select('pokemon(pokedex_id)').in('trainer_id', trainerIds)
      : Promise.resolve({ data: [] as unknown[] }),
  ])

  const ids = new Set<number>((scanned ?? []).map((r) => r.pokedex_id))
  // trainers_pokemon.pokemon_id is a primary key, so this embed comes back as a single object at runtime (the
  // same quirk documented throughout this codebase), not the array TS infers.
  for (const row of (owned ?? []) as unknown as { pokemon: { pokedex_id: number } | null }[]) {
    if (row.pokemon) ids.add(row.pokemon.pokedex_id)
  }
  return { restricted: true, discoveredIds: [...ids] }
}

export async function loadCampaignPokedexDiscoveryOnly(supabase: SupabaseClient, campaignId: string): Promise<boolean> {
  const { data } = await supabase.from('campaigns').select('pokedex_discovery_only').eq('id', campaignId).maybeSingle()
  return data?.pokedex_discovery_only ?? false
}
