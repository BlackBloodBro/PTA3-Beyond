import type { createClient } from '@/lib/supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

// Shared by both Pokemon-creation flows (starter and GM-created): the options for the Type/Habitat
// filter dropdowns above the species picker. Excludes the "Special/Variable" sentinel type -- it
// exists only so Moves.type_id can represent typeless/type-shifting moves and no real Pokedex
// species ever has it, so it would just be a dead option in the list.
export async function fetchPokedexFilterOptions(supabase: SupabaseClient) {
  const [{ data: types }, { data: habitats }] = await Promise.all([
    supabase.from('types').select('id, name').neq('name', 'Special/Variable').order('name'),
    supabase.from('habitats').select('id, name').order('name'),
  ])
  return { types: types ?? [], habitats: habitats ?? [] }
}

// Habitat is many-to-many (pokedex_habitats), so it's filtered via a separate id lookup rather
// than an embedded join -- keeps this filterable/unfilterable by habitat without the query's
// result shape (and TS type) changing between the two branches.
export async function fetchFilteredSpecies(
  supabase: SupabaseClient,
  filters: { typeId: number | null; habitatId: number | null },
): Promise<{ name: string; sprite_code: string }[]> {
  let query = supabase.from('pokedex').select('name, sprite_code')

  // A species matches on EITHER of its two types, same as how type effectiveness/matchups treat a
  // dual-type Pokemon.
  if (filters.typeId) {
    query = query.or(`type_1_id.eq.${filters.typeId},type_2_id.eq.${filters.typeId}`)
  }

  if (filters.habitatId) {
    const { data: habitatRows } = await supabase
      .from('pokedex_habitats')
      .select('pokedex_id')
      .eq('habitat_id', filters.habitatId)
    query = query.in('id', (habitatRows ?? []).map((r) => r.pokedex_id))
  }

  const { data } = await query.order('name')
  return data ?? []
}
