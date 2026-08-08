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
        id, quantity,
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
    }
  })

  return {
    items,
    money: trainer?.money ?? 0,
    sellPricePercent: trainer?.campaign_id ? (trainer.campaigns?.sell_price_percent ?? 50) : 50,
  }
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
