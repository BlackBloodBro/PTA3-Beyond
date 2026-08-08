import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadBagSnapshot, loadItemCatalog } from '@/lib/pta3/bag'
import { BagBoard, type BagPokemonOption } from '@/app/(authenticated)/trainers/[id]/bag/BagBoard'

export default async function CampaignTrainerBagPage({ params }: { params: Promise<{ id: string; trainerId: string }> }) {
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

  if (trainer.is_npc || trainer.campaign_id !== campaignId) {
    notFound()
  }

  const isOwner = trainer.user_id === user.id
  const isGM = trainer.campaigns?.gm_user_id === user.id
  const canManage = isOwner || isGM
  // This route only ever serves campaign trainers -- always GM-only, no campaign-less-owner case here.
  const canAdjustMoney = isGM
  // The sell-price percentage is a Campaign-tier GM setting, same as adjustMoney -- this route always
  // has a real Campaign, so it's simply isGM (no campaign-less case to fall back for here).
  const canEditSellPercent = isGM

  const [snapshot, catalog, { data: pokemonRows }] = await Promise.all([
    loadBagSnapshot(supabase, id),
    loadItemCatalog(supabase),
    supabase
      .from('trainers_pokemon')
      .select('pokemon(id, nickname, held_item_id, pokedex(name))')
      .eq('trainer_id', id),
  ])

  const pokemonOptions: BagPokemonOption[] = (pokemonRows ?? [])
    .map((r) => r.pokemon)
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .map((p) => ({
      id: p.id,
      name: p.nickname ? `${p.nickname} (${p.pokedex!.name})` : p.pokedex!.name,
      hasHeldItem: p.held_item_id !== null,
    }))

  return (
    <main className="flex min-h-screen flex-col items-center gap-4 p-24">
      <h1 className="text-2xl font-bold">{trainer.name}&apos;s Bag</h1>
      <BagBoard
        trainerId={id}
        canManage={canManage}
        canAdjustMoney={canAdjustMoney}
        canEditSellPercent={canEditSellPercent}
        initialItems={snapshot.items}
        initialMoney={snapshot.money}
        initialSellPricePercent={snapshot.sellPricePercent}
        catalog={catalog}
        pokemonOptions={pokemonOptions}
      />
      <Link href={`/campaigns/${campaignId}/trainers/${id}`} className="underline">
        Back to {trainer.name}
      </Link>
    </main>
  )
}
