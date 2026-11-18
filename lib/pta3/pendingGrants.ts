import type { createClient } from '@/lib/supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

// [[Feature - Let the GM approve EXP and LP gained in an Encounter]]: one Pokemon's pending EXP/LP in an Encounter.
// Kept out of the 'use server' actions file so the Encounter page can load it with its own client.
export type PendingGrant = {
  pokemonId: string
  name: string
  exp: number
  loyaltyPoints: number
}

// GM only in practice: RLS returns no rows to anyone else.
export async function loadEncounterPendingGrants(supabase: SupabaseClient, encounterId: string): Promise<PendingGrant[]> {
  const { data } = await supabase
    .from('encounter_pending_grants')
    .select('pokemon_id, exp, loyalty_points, pokemon(nickname, pokedex(name))')
    .eq('encounter_id', encounterId)
    .order('updated_at')

  // Same embed quirk documented throughout this codebase -- `pokemon` is a single object at runtime.
  type Row = { pokemon_id: string; exp: number; loyalty_points: number; pokemon: { nickname: string | null; pokedex: { name: string } | null } | null }
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    pokemonId: r.pokemon_id,
    name: r.pokemon?.nickname
      ? `${r.pokemon.nickname} (${r.pokemon.pokedex?.name ?? 'Unknown'})`
      : (r.pokemon?.pokedex?.name ?? 'Unknown Pokémon'),
    exp: r.exp,
    loyaltyPoints: r.loyalty_points,
  }))
}
