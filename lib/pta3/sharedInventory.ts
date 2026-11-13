import type { SupabaseClient } from '@supabase/supabase-js'

// [[Feature - Shared currency and inventory]]: the Campaign-wide pool. Readable by every Campaign member (RLS); written
// only through the deposit_/withdraw_shared_* database functions, which move the currency / items atomically.
export type SharedItem = {
  id: string
  itemId: number
  name: string
  description: string | null
  quantity: number
  stackable: boolean
  // Variant attachments, mirroring a Trainer's own inventory rows (TM/TR move, fossil/Egg species, Egg nature) and the
  // TR use charges.
  moveName: string | null
  pokedexName: string | null
  natureName: string | null
  usesRemaining: number | null
}

export type SharedSnapshot = { money: number; items: SharedItem[] }

export async function loadSharedSnapshot(supabase: SupabaseClient, campaignId: string): Promise<SharedSnapshot> {
  const [{ data: campaign }, { data: rows }] = await Promise.all([
    supabase.from('campaigns').select('money').eq('id', campaignId).maybeSingle(),
    supabase
      .from('campaign_items')
      .select('id, quantity, uses_remaining, items(id, name, description, stackable), moves(name), pokedex(name), natures(name)')
      .eq('campaign_id', campaignId),
  ])

  // Same single-row-embed quirk documented throughout this codebase: these come back as one object at runtime, not the
  // array TS infers.
  const typed = (rows ?? []) as unknown as {
    id: string
    quantity: number
    uses_remaining: number | null
    items: { id: number; name: string; description: string | null; stackable: boolean } | null
    moves: { name: string } | null
    pokedex: { name: string } | null
    natures: { name: string } | null
  }[]

  const items: SharedItem[] = typed
    .filter((r) => r.items)
    .map((r) => ({
      id: r.id,
      itemId: r.items!.id,
      name: r.items!.name,
      description: r.items!.description,
      quantity: r.quantity,
      stackable: r.items!.stackable,
      moveName: r.moves?.name ?? null,
      pokedexName: r.pokedex?.name ?? null,
      natureName: r.natures?.name ?? null,
      usesRemaining: r.uses_remaining,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return { money: campaign?.money ?? 0, items }
}
