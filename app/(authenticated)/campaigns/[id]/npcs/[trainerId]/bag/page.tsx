import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadBagSnapshot, loadItemCatalog, loadTmEligibleMoves, loadTmPrices } from '@/lib/pta3/bag'
import { BagBoard, type BagPokemonOption } from '@/app/(authenticated)/trainers/[id]/bag/BagBoard'
import { fetchAllPages } from '@/lib/supabase/fetchAllPages'

export default async function NpcBagPage({ params }: { params: Promise<{ id: string; trainerId: string }> }) {
  const { id: campaignId, trainerId: id } = await params
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
    .select('id, name, user_id, is_npc, campaign_id, campaigns(gm_user_id)')
    .eq('id', id)
    .single()

  if (!trainer) {
    redirect('/dashboard')
  }

  if (!trainer.is_npc || trainer.campaign_id !== campaignId) {
    notFound()
  }

  const isOwner = trainer.user_id === user.id
  const isGM = trainer.campaigns?.gm_user_id === user.id
  // [[Improvement - Let a GM temporarily add an NPC to the party]]: a party NPC's row is readable by players
  // (RLS, 20261118100000_temporary_party_member.sql) so Breeding can list its Pokemon -- but its sheet stays the
  // GM's. Before that, RLS alone kept players out of this route; now it has to be checked here.
  if (!isOwner && !isGM) {
    notFound()
  }
  const canManage = isOwner || isGM
  // This route only ever serves campaign trainers -- always GM-only, no campaign-less-owner case here.
  const canAdjustMoney = isGM

  const [snapshot, catalog, { data: pokemonRows }, { data: speciesRows }, tmMoves, tmPrices] = await Promise.all([
    loadBagSnapshot(supabase, id),
    loadItemCatalog(supabase),
    supabase
      .from('trainers_pokemon')
      .select('party_slot, pokemon(id, nickname, held_item_id, pokedex(name))')
      .eq('trainer_id', id),
    // Needed for the Catalog's Egg species picker ([[Add Eggs as Item]]).
    fetchAllPages((from, to) => supabase.from('pokedex').select('id, name, sprite_code').order('name').order('id').range(from, to)),
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
        <Link href={`/campaigns/${campaignId}/npcs/${id}`} className="text-sm underline">
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
