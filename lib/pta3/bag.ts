import type { SupabaseClient } from '@supabase/supabase-js'

export type BagItem = {
  id: string
  itemId: number
  name: string
  description: string | null
  price: number | null
  quantity: number
  stackable: boolean
  holdable: boolean
  categoryNames: string[]
  moveId: number | null
  moveName: string | null
  pokedexId: number | null
  pokedexName: string | null
  // Charge count for TM/TR-style items (null = not applicable / unlimited, e.g. TM itself -- same
  // nullable-means-unlimited convention as pokemon_moves.uses_remaining).
  usesRemaining: number | null
}

export type CatalogItem = {
  id: number
  name: string
  description: string | null
  price: number | null
  buyable: boolean
  stackable: boolean
  holdable: boolean
  categoryNames: string[]
}

export type BagSnapshot = {
  items: BagItem[]
  money: number
  // Percent of items.price a sold item returns -- Campaign-wide (GM-editable, see
  // trainers/[id]/bag/actions.ts's updateSellPricePercent), or a fixed 50 for a campaign-less
  // Trainer, which has no GM to configure it.
  sellPricePercent: number
}

// Shared by every Bag action after a mutation, and by the Bag page on initial load -- returns the
// full current state so the client can just replace its local state wholesale, matching this
// codebase's established "return a snapshot, don't patch state piecemeal" convention (see
// buildClassBuilderSnapshot).
export async function loadBagSnapshot(supabase: SupabaseClient, trainerId: string): Promise<BagSnapshot> {
  const [{ data: rows }, { data: trainer }] = await Promise.all([
    supabase
      .from('trainers_items')
      .select(
        `
        id, quantity, uses_remaining,
        items(id, name, description, price, stackable, holdable, items_item_categories(item_categories(name))),
        moves(id, name),
        pokedex(id, name)
      `,
      )
      .eq('trainer_id', trainerId),
    supabase.from('trainers').select('money, campaign_id, campaigns(sell_price_percent)').eq('id', trainerId).single(),
  ])

  const items: BagItem[] = (rows ?? []).map((r) => {
    const item = r.items!
    const categoryNames = (item.items_item_categories ?? []).map((c) => c.item_categories!.name)
    return {
      id: r.id,
      itemId: item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      quantity: r.quantity,
      stackable: item.stackable,
      holdable: item.holdable,
      categoryNames,
      moveId: r.moves?.id ?? null,
      moveName: r.moves?.name ?? null,
      pokedexId: r.pokedex?.id ?? null,
      pokedexName: r.pokedex?.name ?? null,
      usesRemaining: r.uses_remaining,
    }
  })

  return {
    items,
    money: trainer?.money ?? 0,
    sellPricePercent: trainer?.campaign_id ? (trainer.campaigns?.sell_price_percent ?? 50) : 50,
  }
}

export type TmMoveOption = {
  id: number
  name: string
  frequency: string
  typeName: string | null
}

// The global "TM-eligible movepool" -- any move that's TM/tutor-taught (level_learned = null) for at
// least one species anywhere in pokedex_moves, independent of which Pokémon will eventually learn it.
// This is what "choose a move" at TM purchase/grant time picks from ([[When buying a Technical Machine
// you should choose a move]]) -- a real, if approximate, stand-in for "moves the source material treats
// as TM-teachable," since there's no per-move "is this ever taught via TM" flag on `moves` itself.
export async function loadTmEligibleMoves(supabase: SupabaseClient): Promise<TmMoveOption[]> {
  const { data } = await supabase
    .from('pokedex_moves')
    .select('move:moves!inner(id, name, frequency, types(name))')
    .is('level_learned', null)

  // Same reverse/forward-embed quirk documented elsewhere in this codebase -- `move` comes back as a
  // single object at runtime, not the array TS infers.
  const rows = (data ?? []) as unknown as { move: { id: number; name: string; frequency: string; types: { name: string } | null } | null }[]

  const byId = new Map<number, TmMoveOption>()
  for (const row of rows) {
    const m = row.move
    if (m && !byId.has(m.id)) {
      byId.set(m.id, { id: m.id, name: m.name, frequency: m.frequency, typeName: m.types?.name ?? null })
    }
  }
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name))
}

export type TmPriceOption = {
  itemName: string
  frequency: string
  price: number
}

// TM/TR no longer carry a fixed `items.price` -- price depends on whichever move you attach at
// buy/grant time (per the user's direct request). This is the lookup table the client previews from
// as the move picker changes; `resolveItemPrice` below is the server-authoritative version used by
// buyItem/sellItem so a stale client price can never actually change what's charged.
export async function loadTmPrices(supabase: SupabaseClient): Promise<TmPriceOption[]> {
  const { data } = await supabase.from('technical_machine_prices').select('frequency, price, items(name)')

  // Same reverse/forward-embed quirk documented elsewhere in this codebase.
  const rows = (data ?? []) as unknown as { frequency: string; price: number; items: { name: string } | null }[]

  return rows.filter((r) => r.items !== null).map((r) => ({ itemName: r.items!.name, frequency: r.frequency, price: r.price }))
}

// Server-authoritative price for a bag/catalog item: static `items.price` when set (every item except
// TM/TR), or looked up from `technical_machine_prices` by the attached move's frequency when not.
export async function resolveItemPrice(supabase: SupabaseClient, itemId: number, moveId: number | null): Promise<number | null> {
  const { data: item } = await supabase.from('items').select('price').eq('id', itemId).maybeSingle()
  if (item?.price !== null && item?.price !== undefined) {
    return item.price
  }
  if (moveId === null) {
    return null
  }
  const { data: move } = await supabase.from('moves').select('frequency').eq('id', moveId).maybeSingle()
  if (!move) {
    return null
  }
  const { data: tmPrice } = await supabase
    .from('technical_machine_prices')
    .select('price')
    .eq('item_id', itemId)
    .eq('frequency', move.frequency)
    .maybeSingle()
  return tmPrice?.price ?? null
}

// Loaded once per page visit, filtered client-side -- same "load everything upfront" pattern used
// for Skill Talents and the Class Builder's milestone options. 337 rows is small enough that this
// isn't a real cost, and it means granting/buying never needs a follow-up search request.
export async function loadItemCatalog(supabase: SupabaseClient): Promise<CatalogItem[]> {
  const { data } = await supabase
    .from('items')
    .select('id, name, description, price, buyable, stackable, holdable, items_item_categories(item_categories(name))')
    .order('name')

  return (data ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    price: item.price,
    buyable: item.buyable,
    stackable: item.stackable,
    holdable: item.holdable,
    categoryNames: (item.items_item_categories ?? []).map((c) => c.item_categories!.name),
  }))
}
