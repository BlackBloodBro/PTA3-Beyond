'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadBagSnapshot, type BagSnapshot } from '@/lib/pta3/bag'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

// Same shape and reasoning as the PC page's loadAuthorizedTrainer -- granting/discarding/using/buying
// are all routine actions (same tier as HP adjustment), so the owner keeps control even inside a
// Campaign, in addition to that Campaign's GM.
async function loadAuthorizedTrainer(supabase: SupabaseClient, trainerId: string, userId: string) {
  const { data: trainer } = await supabase
    .from('trainers')
    .select('id, user_id, money, campaign_id, campaigns(gm_user_id, sell_price_percent)')
    .eq('id', trainerId)
    .maybeSingle()

  if (!trainer) return null

  const authorized = trainer.user_id === userId || trainer.campaigns?.gm_user_id === userId
  return authorized ? trainer : null
}

// Whole-number quantity, clamped to [1, 100] -- the upper bound isn't about affordability (Buy is
// already bounded by what the Trainer can afford), it's a fat-finger guard against typing an extra
// digit (e.g. 1000 instead of 100) and accidentally buying/granting/discarding/selling 10x too much.
function clampQuantity(quantity: number): number {
  return Math.max(1, Math.min(100, Math.floor(quantity)))
}

async function requireAuthorizedTrainer(supabase: SupabaseClient, trainerId: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const trainer = await loadAuthorizedTrainer(supabase, trainerId, user.id)
  return { user, trainer }
}

// Shared by grantItem/buyItem: stacking is free (identical item_id/move_id/pokedex_id increments an
// existing row), capped at 1 total for non-stackable items rather than erroring -- a second copy of a
// non-stackable item is simply a no-op, matching this app's "explicit steps only, no silent surprises"
// philosophy without needing a dedicated error path for what's a fairly harmless click.
async function addToBag(
  supabase: SupabaseClient,
  trainerId: string,
  itemId: number,
  moveId: number | null,
  pokedexId: number | null,
  quantity: number,
): Promise<{ error: string } | { ok: true }> {
  const { data: item } = await supabase.from('items').select('id, stackable').eq('id', itemId).maybeSingle()
  if (!item) {
    return { error: 'Item not found' }
  }

  let existingQuery = supabase.from('trainers_items').select('id, quantity').eq('trainer_id', trainerId).eq('item_id', itemId)
  existingQuery = moveId ? existingQuery.eq('move_id', moveId) : existingQuery.is('move_id', null)
  existingQuery = pokedexId ? existingQuery.eq('pokedex_id', pokedexId) : existingQuery.is('pokedex_id', null)
  const { data: existing } = await existingQuery.maybeSingle()

  if (existing) {
    if (!item.stackable) {
      return { ok: true }
    }
    const { error } = await supabase.from('trainers_items').update({ quantity: existing.quantity + quantity }).eq('id', existing.id)
    if (error) return { error: error.message }
    return { ok: true }
  }

  const { error } = await supabase
    .from('trainers_items')
    .insert({ trainer_id: trainerId, item_id: itemId, move_id: moveId, pokedex_id: pokedexId, quantity: item.stackable ? quantity : 1 })
  if (error) return { error: error.message }
  return { ok: true }
}

export async function grantItem(trainerId: string, itemId: number, quantity: number = 1): Promise<{ error: string } | BagSnapshot> {
  const supabase = await createClient()
  const { trainer } = await requireAuthorizedTrainer(supabase, trainerId)
  if (!trainer) {
    return { error: 'Not authorized to manage this Trainer’s Bag' }
  }

  const result = await addToBag(supabase, trainerId, itemId, null, null, clampQuantity(quantity))
  if ('error' in result) return result

  return loadBagSnapshot(supabase, trainerId)
}

export async function discardItem(trainerId: string, trainersItemId: string, amount: number): Promise<{ error: string } | BagSnapshot> {
  const supabase = await createClient()
  const { trainer } = await requireAuthorizedTrainer(supabase, trainerId)
  if (!trainer) {
    return { error: 'Not authorized to manage this Trainer’s Bag' }
  }

  const { data: row } = await supabase
    .from('trainers_items')
    .select('id, quantity')
    .eq('id', trainersItemId)
    .eq('trainer_id', trainerId)
    .maybeSingle()

  if (!row) {
    return { error: 'Item not found in this Bag' }
  }

  const remaining = row.quantity - amount
  if (remaining > 0) {
    const { error } = await supabase.from('trainers_items').update({ quantity: remaining }).eq('id', row.id)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase.from('trainers_items').delete().eq('id', row.id)
    if (error) return { error: error.message }
  }

  return loadBagSnapshot(supabase, trainerId)
}

// "Using" an item is mechanically identical to discarding 1 -- no automatic effect simulation, matches
// this app's existing philosophy everywhere else (moves don't auto-roll damage, HP is manually
// adjusted). Kept as a separate action from discardItem for intent clarity in the UI/audit trail, even
// though the implementation is the same call.
export async function useItem(trainerId: string, trainersItemId: string): Promise<{ error: string } | BagSnapshot> {
  return discardItem(trainerId, trainersItemId, 1)
}

export async function buyItem(trainerId: string, itemId: number, quantity: number = 1): Promise<{ error: string } | BagSnapshot> {
  const supabase = await createClient()
  const { trainer } = await requireAuthorizedTrainer(supabase, trainerId)
  if (!trainer) {
    return { error: 'Not authorized to manage this Trainer’s Bag' }
  }

  const { data: item } = await supabase.from('items').select('id, buyable, price').eq('id', itemId).maybeSingle()
  if (!item || !item.buyable || item.price === null) {
    return { error: 'That item is not available to buy' }
  }

  const qty = clampQuantity(quantity)
  const totalCost = item.price * qty
  if (trainer.money < totalCost) {
    return { error: 'Not enough money' }
  }

  const { error: moneyError } = await supabase.from('trainers').update({ money: trainer.money - totalCost }).eq('id', trainerId)
  if (moneyError) return { error: moneyError.message }

  const result = await addToBag(supabase, trainerId, itemId, null, null, qty)
  if ('error' in result) return result

  return loadBagSnapshot(supabase, trainerId)
}

// Reverse of buyItem: credits money for a fraction of the item's buy price rather than the full
// amount, discouraging a free buy-then-sell loop while still letting a player liquidate excess loot.
// The fraction is Campaign-wide (see updateSellPricePercent) rather than per-sale, matching how the
// GM already controls other economy-balance levers (e.g. directly adjusting money). Items with no
// price (`items.price = null`) can't be sold -- same "not offered" treatment buyItem/the Catalog's Buy
// button already give those, kept consistent rather than inventing a separate fallback value.
export async function sellItem(trainerId: string, trainersItemId: string, quantity: number = 1): Promise<{ error: string } | BagSnapshot> {
  const supabase = await createClient()
  const { trainer } = await requireAuthorizedTrainer(supabase, trainerId)
  if (!trainer) {
    return { error: 'Not authorized to manage this Trainer’s Bag' }
  }

  const { data: row } = await supabase
    .from('trainers_items')
    .select('id, quantity, items(price)')
    .eq('id', trainersItemId)
    .eq('trainer_id', trainerId)
    .maybeSingle()

  if (!row) {
    return { error: 'Item not found in this Bag' }
  }
  if (row.items?.price == null) {
    return { error: 'That item cannot be sold' }
  }

  const qty = clampQuantity(quantity)
  if (qty > row.quantity) {
    return { error: 'Not enough of that item to sell' }
  }

  const percent = trainer.campaign_id ? (trainer.campaigns?.sell_price_percent ?? 50) : 50
  const saleValue = Math.floor((row.items.price * percent) / 100) * qty

  const { error: moneyError } = await supabase.from('trainers').update({ money: trainer.money + saleValue }).eq('id', trainerId)
  if (moneyError) return { error: moneyError.message }

  const remaining = row.quantity - qty
  if (remaining > 0) {
    const { error } = await supabase.from('trainers_items').update({ quantity: remaining }).eq('id', row.id)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase.from('trainers_items').delete().eq('id', row.id)
    if (error) return { error: error.message }
  }

  return loadBagSnapshot(supabase, trainerId)
}

// The sell-price percentage itself is GM-only within a Campaign (an economy-balance lever, same tier
// as directly adjusting money) -- a campaign-less Trainer has no GM to configure it, so it stays fixed
// at the 50 default for that case (see loadBagSnapshot/sellItem's own fallback) with no edit path here.
export async function updateSellPricePercent(trainerId: string, percent: number): Promise<{ error: string } | BagSnapshot> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: trainer } = await supabase
    .from('trainers')
    .select('id, campaign_id, campaigns(gm_user_id)')
    .eq('id', trainerId)
    .maybeSingle()

  if (!trainer || !trainer.campaign_id || trainer.campaigns?.gm_user_id !== user.id) {
    return { error: 'Only the campaign GM can change the sell price percentage' }
  }

  const clamped = Math.max(0, Math.min(100, Math.round(percent)))
  const { error } = await supabase.from('campaigns').update({ sell_price_percent: clamped }).eq('id', trainer.campaign_id)
  if (error) return { error: error.message }

  return loadBagSnapshot(supabase, trainerId)
}

// Directly adjusting the raw currency balance (outside of buying) is GM-only within a Campaign,
// mirroring the Pokemon EV-redistribution precedent -- assigning/spending is routine, correcting the
// raw number is GM-only. But a Trainer with no Campaign has no GM to defer to, so the owner gets full
// control here too -- same "no campaign -> the personal owner has full control" rule already used for
// Class/Background (trainers/actions.ts's canEditGmTier) and for Wild Pokemon.
export async function adjustMoney(trainerId: string, delta: number): Promise<{ error: string } | BagSnapshot> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: trainer } = await supabase
    .from('trainers')
    .select('id, money, user_id, campaign_id, campaigns(gm_user_id)')
    .eq('id', trainerId)
    .maybeSingle()

  if (!trainer) {
    return { error: 'Trainer not found' }
  }

  const isAuthorized = trainer.campaign_id ? trainer.campaigns?.gm_user_id === user.id : trainer.user_id === user.id
  if (!isAuthorized) {
    return { error: trainer.campaign_id ? 'Only the campaign GM can directly adjust money' : 'Not authorized to manage this Trainer' }
  }

  const newAmount = Math.max(0, trainer.money + delta)
  const { error } = await supabase.from('trainers').update({ money: newAmount }).eq('id', trainerId)
  if (error) return { error: error.message }

  return loadBagSnapshot(supabase, trainerId)
}

// Bag-driven "give as held item" -- a new, owner-accessible path alongside the existing GM-only
// held-item field on the Pokemon edit page (that field stays exactly as-is, a narrative override with
// no inventory interaction). Blocks giving a new item if the Pokemon is already holding one, rather
// than silently swapping -- the player unequips first (Pokemon page) if they want to change it, same
// "explicit steps only" reasoning as the non-stackable-item no-op above.
export async function giveHeldItem(trainerId: string, trainersItemId: string, pokemonId: string): Promise<{ error: string } | BagSnapshot> {
  const supabase = await createClient()
  const { trainer } = await requireAuthorizedTrainer(supabase, trainerId)
  if (!trainer) {
    return { error: 'Not authorized to manage this Trainer’s Bag' }
  }

  const [{ data: row }, { data: pokemon }] = await Promise.all([
    supabase.from('trainers_items').select('id, item_id, quantity, items(holdable)').eq('id', trainersItemId).eq('trainer_id', trainerId).maybeSingle(),
    supabase
      .from('trainers_pokemon')
      .select('pokemon(id, held_item_id)')
      .eq('trainer_id', trainerId)
      .eq('pokemon_id', pokemonId)
      .maybeSingle(),
  ])

  if (!row) {
    return { error: 'Item not found in this Bag' }
  }
  if (!row.items?.holdable) {
    return { error: 'That item cannot be held by a Pokémon' }
  }
  const pokemonRow = pokemon?.pokemon
  if (!pokemonRow) {
    return { error: 'That Pokémon does not belong to this Trainer' }
  }
  if (pokemonRow.held_item_id !== null) {
    return { error: 'That Pokémon is already holding an item -- unequip it first' }
  }

  const { error: setError } = await supabase.from('pokemon').update({ held_item_id: row.item_id }).eq('id', pokemonId)
  if (setError) return { error: setError.message }

  if (row.quantity > 1) {
    const { error } = await supabase.from('trainers_items').update({ quantity: row.quantity - 1 }).eq('id', row.id)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase.from('trainers_items').delete().eq('id', row.id)
    if (error) return { error: error.message }
  }

  return loadBagSnapshot(supabase, trainerId)
}
