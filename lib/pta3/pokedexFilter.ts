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
//
// Both filters take arrays now (multi-select, [[Bug - Improve Wild Pokemon creation and editing]]) --
// a species matches if it has ANY of the selected types (OR across both of its own type columns AND
// across every selected type id) and/or belongs to ANY of the selected habitats. An empty array
// means "no filter on this dimension" (same as null did before), not "matches nothing".
export async function fetchFilteredSpecies(
  supabase: SupabaseClient,
  filters: { typeIds: number[]; habitatIds: number[] },
): Promise<{ id: number; name: string; sprite_code: string; growth_rate_id: number | null }[]> {
  let query = supabase.from('pokedex').select('id, name, sprite_code, growth_rate_id')

  // A species matches on EITHER of its two types, same as how type effectiveness/matchups treat a
  // dual-type Pokemon -- extended here to match on ANY of the selected type ids too.
  if (filters.typeIds.length > 0) {
    const clause = filters.typeIds.flatMap((id) => [`type_1_id.eq.${id}`, `type_2_id.eq.${id}`]).join(',')
    query = query.or(clause)
  }

  if (filters.habitatIds.length > 0) {
    const { data: habitatRows } = await supabase
      .from('pokedex_habitats')
      .select('pokedex_id')
      .in('habitat_id', filters.habitatIds)
    query = query.in('id', (habitatRows ?? []).map((r) => r.pokedex_id))
  }

  const { data } = await query.order('name')
  return data ?? []
}
