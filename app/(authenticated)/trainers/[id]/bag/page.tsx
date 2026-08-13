import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadBagSnapshot, loadItemCatalog, loadTmEligibleMoves, loadTmPrices } from '@/lib/pta3/bag'
import { BagBoard, type BagPokemonOption } from './BagBoard'

export default async function BagPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // No .eq('user_id', ...) filter -- RLS scopes this to the owner or the campaign's GM.
  const { data: trainer } = await supabase
    .from('trainers')
    .select('id, name, user_id, campaign_id, campaigns(gm_user_id)')
    .eq('id', id)
    .single()

  if (!trainer) {
    redirect('/dashboard')
  }

  // Any Trainer belonging to a Campaign (NPC or player) lives under /campaigns/[id]/.../bag now.
  if (trainer.campaign_id) {
    notFound()
  }

  const isOwner = trainer.user_id === user.id
  const isGM = trainer.campaigns?.gm_user_id === user.id
  const canManage = isOwner || isGM
  // Directly adjusting money is GM-only within a Campaign, but this route only ever serves
  // campaign-less Trainers (see the notFound() guard above) -- no GM to defer to, so the owner gets
  // full control, same rule as adjustMoney's own campaign_id ? isGM : isOwner check.
  const canAdjustMoney = isOwner

  const [snapshot, catalog, { data: pokemonRows }, { data: speciesRows }, tmMoves, tmPrices] = await Promise.all([
    loadBagSnapshot(supabase, id),
    loadItemCatalog(supabase),
    supabase
      .from('trainers_pokemon')
      .select('party_slot, pokemon(id, nickname, held_item_id, pokedex(name))')
      .eq('trainer_id', id),
    // Needed for the Catalog's Egg species picker ([[Add Eggs as Item]]) -- same small-columns-only
    // shape as /pokemon/new's own species list fetch.
    supabase.from('pokedex').select('id, name, sprite_code').order('name'),
    // Needed for the Catalog's TM/TR move picker ([[When buying a Technical Machine you should
    // choose a move]]).
    loadTmEligibleMoves(supabase),
    loadTmPrices(supabase),
  ])

  const pokemonOptions: BagPokemonOption[] = (pokemonRows ?? [])
    .filter((r) => r.pokemon !== null)
    .map((r) => ({
      id: r.pokemon!.id,
      name: r.pokemon!.nickname ? `${r.pokemon!.nickname} (${r.pokemon!.pokedex!.name})` : r.pokemon!.pokedex!.name,
      hasHeldItem: r.pokemon!.held_item_id !== null,
      partySlot: r.party_slot,
    }))

  return (
    <main className="flex min-h-screen flex-col items-center gap-4 p-24">
      <div className="w-full max-w-4xl">
        <Link href={`/trainers/${id}`} className="text-sm underline">
          ← Back to {trainer.name}
        </Link>
      </div>
      <h1 className="text-2xl font-bold">{trainer.name}&apos;s Inventory</h1>
      <BagBoard
        trainerId={id}
        canManage={canManage}
        canAdjustMoney={canAdjustMoney}
        initialItems={snapshot.items}
        initialMoney={snapshot.money}
        initialSellPricePercent={snapshot.sellPricePercent}
        catalog={catalog}
        pokemonOptions={pokemonOptions}
        speciesList={speciesRows ?? []}
        tmMoves={tmMoves}
        tmPrices={tmPrices}
      />
    </main>
  )
}
