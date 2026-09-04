import type { createClient } from '@/lib/supabase/server'
import { computeLoyaltyTier } from '@/lib/pta3/pokemonLevel'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

export type EvolutionTarget = {
  toPokedexId: number
  toName: string
  toSpriteCode: string
  triggerType: 'level' | 'loyalty' | 'item' | 'other'
  levelRequirement: number | null
  itemId: number | null
  itemName: string | null
}

// Every outgoing evolution edge from a species, regardless of whether a given Pokemon currently
// satisfies it -- the Pokemon page decides eligibility itself (it already has the Pokemon's computed
// level and loyalty in hand). 'other'-typed edges are included too -- they're real, GM-override-only
// paths (trade evolutions, day/night-gated branches, etc.), not just automatic ones.
export async function loadEvolutionTargets(supabase: SupabaseClient, fromPokedexId: number): Promise<EvolutionTarget[]> {
  const { data } = await supabase
    .from('evolution_triggers')
    .select('to_pokedex_id, trigger_type, level_requirement, item_id, pokedex!evolution_triggers_to_pokedex_id_fkey(name, sprite_code), items(name)')
    .eq('from_pokedex_id', fromPokedexId)

  // Cast reflects the real runtime shape (pokedex/items come back as single objects, not the arrays
  // TS infers for these embeds) -- same reverse-embed quirk documented throughout this codebase.
  const rows = ((data ?? []) as unknown) as {
    to_pokedex_id: number
    trigger_type: string
    level_requirement: number | null
    item_id: number | null
    pokedex: { name: string; sprite_code: string } | null
    items: { name: string } | null
  }[]

  return rows.map((row) => ({
    toPokedexId: row.to_pokedex_id,
    toName: row.pokedex!.name,
    toSpriteCode: row.pokedex!.sprite_code,
    triggerType: row.trigger_type as EvolutionTarget['triggerType'],
    levelRequirement: row.level_requirement,
    itemId: row.item_id,
    itemName: row.items?.name ?? null,
  }))
}

export type ChainMember = { id: number; name: string; spriteCode: string }

// Every OTHER species in a Pokemon's evolution chain (forward and backward) -- feeds the GM-override
// picker, which per Design can jump to any reachable stage in one action, including devolving. Null
// evolutionChainId means this species isn't part of any known multi-member chain (nothing to pick).
export async function loadEvolutionChainMembers(
  supabase: SupabaseClient,
  evolutionChainId: number | null,
  excludePokedexId: number,
): Promise<ChainMember[]> {
  if (evolutionChainId === null) return []
  const { data } = await supabase
    .from('pokedex')
    .select('id, name, sprite_code')
    .eq('evolution_chain_id', evolutionChainId)
    .neq('id', excludePokedexId)
    .order('name')
  return (data ?? []).map((r) => ({ id: r.id, name: r.name, spriteCode: r.sprite_code }))
}

// Bulk level-eligibility check for list pages (PC, global Pokemon overview) -- same "load the whole
// small reference table once, compute in memory" shape as computePokemonLevelsBulk, avoiding an N+1
// query per row. A Pokemon is eligible if its level meets or exceeds the LOWEST level_requirement among
// its species' outgoing 'level' edges (equivalent to "meets at least one of its evolution options").
export async function computeLevelEligibleEvolutionSet(
  supabase: SupabaseClient,
  pokemonList: { pokemonId: string; pokedexId: number; level: number }[],
): Promise<Set<string>> {
  const { data: levelEdges } = await supabase.from('evolution_triggers').select('from_pokedex_id, level_requirement').eq('trigger_type', 'level')

  const minLevelByPokedexId = new Map<number, number>()
  for (const edge of levelEdges ?? []) {
    if (edge.level_requirement === null) continue
    const current = minLevelByPokedexId.get(edge.from_pokedex_id)
    if (current === undefined || edge.level_requirement < current) {
      minLevelByPokedexId.set(edge.from_pokedex_id, edge.level_requirement)
    }
  }

  const eligible = new Set<string>()
  for (const p of pokemonList) {
    const requiredLevel = minLevelByPokedexId.get(p.pokedexId)
    if (requiredLevel !== undefined && p.level >= requiredLevel) {
      eligible.add(p.pokemonId)
    }
  }
  return eligible
}

// The top loyalties tier (by sort_order) is this app's max tier -- the fixed threshold every
// 'loyalty' trigger requires, per Design (remapped from PokeAPI's min_happiness, no numeric Happiness
// stat exists in this app to check instead). Uses sort_order rather than a fragile name-'5' string
// match, per [[Add a Loyalty editor]] -- same fix already applied to sizes/weights.
export async function isMaxLoyalty(supabase: SupabaseClient, loyaltyPoints: number): Promise<boolean> {
  const { data: rows } = await supabase.from('loyalties').select('sort_order, min_points')
  if (!rows || rows.length === 0) return false
  const maxSortOrder = Math.max(...rows.map((r) => r.sort_order))
  return computeLoyaltyTier(loyaltyPoints, rows)?.sort_order === maxSortOrder
}

export type EvolutionStoneBagItem = { trainersItemId: string; itemId: number; itemName: string; quantity: number }

// [[Feature - Add a Pokemon Breeding Check mechanic]]: a bred Egg carries the FIRST species in the
// chosen parent's evolution line, not that parent's own (possibly-evolved) species -- per the user
// (2026-09-04), correcting the base mechanic's original "the mother's own species" rule. The base form
// is whichever chain member has no incoming `evolution_triggers` edge (nothing evolves into it); a
// species with no chain at all (evolutionChainId null) is trivially its own base. Falls back to the
// given id if a chain is somehow missing its own base (shouldn't happen with real seeded data, but
// this never invents a species to grant).
export async function resolveBaseSpeciesId(supabase: SupabaseClient, pokedexId: number): Promise<number> {
  const { data: species } = await supabase.from('pokedex').select('evolution_chain_id').eq('id', pokedexId).maybeSingle()
  if (!species?.evolution_chain_id) return pokedexId

  const { data: members } = await supabase.from('pokedex').select('id').eq('evolution_chain_id', species.evolution_chain_id)
  const memberIds = (members ?? []).map((m) => m.id)
  if (memberIds.length === 0) return pokedexId

  const { data: incomingEdges } = await supabase.from('evolution_triggers').select('to_pokedex_id').in('to_pokedex_id', memberIds)
  const hasIncoming = new Set((incomingEdges ?? []).map((e) => e.to_pokedex_id))

  return memberIds.find((id) => !hasIncoming.has(id)) ?? pokedexId
}

// This Trainer's Bag rows for any of the 10 Evolution Stone catalog items -- lets the Pokemon page
// show "Evolve using {stone}" only for stones the Trainer actually has, and gives the client the real
// trainers_items row id evolvePokemon needs to consume one.
export async function loadEvolutionStoneBagItems(supabase: SupabaseClient, trainerId: string): Promise<EvolutionStoneBagItem[]> {
  const { data } = await supabase
    .from('trainers_items')
    .select('id, item_id, quantity, items!inner(name, items_item_categories!inner(item_categories!inner(name)))')
    .eq('trainer_id', trainerId)
    .eq('items.items_item_categories.item_categories.name', 'Evolution Stones')

  // Cast reflects the real runtime shape (items comes back as a single object, not the array TS
  // infers) -- same reverse-embed quirk documented throughout this codebase.
  const rows = ((data ?? []) as unknown) as { id: string; item_id: number; quantity: number; items: { name: string } | null }[]
  return rows.map((r) => ({ trainersItemId: r.id, itemId: r.item_id, itemName: r.items?.name ?? 'Evolution Stone', quantity: r.quantity }))
}

export type PassiveLossPreview = { passiveId: number; name: string }

// Passives currently learned that the target species doesn't offer -- per Design, these get deleted
// automatically on evolve, but the Trainer/GM must be warned by name first so they can pick a
// replacement if the new species offers one.
export async function previewPassiveLoss(supabase: SupabaseClient, pokemonId: string, toPokedexId: number): Promise<PassiveLossPreview[]> {
  const [{ data: learned }, { data: offered }] = await Promise.all([
    supabase.from('pokemon_passives').select('passive_id, passives(name)').eq('pokemon_id', pokemonId),
    supabase.from('pokedex_passives').select('passive_id').eq('pokedex_id', toPokedexId),
  ])

  // Cast reflects the real runtime shape (passives comes back as a single object, not the array TS
  // infers) -- same reverse-embed quirk documented throughout this codebase.
  const learnedRows = ((learned ?? []) as unknown) as { passive_id: number; passives: { name: string } | null }[]
  const offeredIds = new Set((offered ?? []).map((r) => r.passive_id))
  return learnedRows.filter((r) => !offeredIds.has(r.passive_id)).map((r) => ({ passiveId: r.passive_id, name: r.passives!.name }))
}

// Shifts a GM's custom Size/Weight override by the tier-delta between the old and new species'
// *defaults*, per Design. Returns null (no change) if there's no override set, or if Variable is
// involved anywhere in the calculation (skipped entirely, not guessed at). Clamps at the extreme tier
// if the shift would overrun it. Symmetric -- works the same whether delta is positive (evolving
// forward) or negative (GM devolving).
export async function shiftSizeOrWeightOverride(
  supabase: SupabaseClient,
  table: 'sizes' | 'weights',
  currentOverrideId: number | null,
  fromDefaultId: number | null,
  toDefaultId: number | null,
): Promise<number | null> {
  if (currentOverrideId === null) return null

  const { data: rows } = await supabase.from(table).select('id, sort_order')
  const sortOrderById = new Map((rows ?? []).map((r) => [r.id, r.sort_order]))

  const overrideOrder = sortOrderById.get(currentOverrideId)
  const fromOrder = fromDefaultId !== null ? sortOrderById.get(fromDefaultId) : undefined
  const toOrder = toDefaultId !== null ? sortOrderById.get(toDefaultId) : undefined

  // Variable (or any id with no sort_order) involved anywhere -- skip the shift, leave override as-is.
  if (overrideOrder == null || fromOrder == null || toOrder == null) return currentOverrideId

  const delta = toOrder - fromOrder
  if (delta === 0) return currentOverrideId

  const orders = [...sortOrderById.values()].filter((v): v is number => v !== null)
  const minOrder = Math.min(...orders)
  const maxOrder = Math.max(...orders)
  const shiftedOrder = Math.min(maxOrder, Math.max(minOrder, overrideOrder + delta))

  const shiftedId = [...sortOrderById.entries()].find(([, order]) => order === shiftedOrder)?.[0]
  return shiftedId ?? currentOverrideId
}
