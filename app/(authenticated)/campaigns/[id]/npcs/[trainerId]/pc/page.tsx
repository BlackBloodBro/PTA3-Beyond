import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { computePokemonLevelsBulk, computeLoyaltyTier } from '@/lib/pta3/pokemonLevel'
import { fetchPokedexFilterOptions } from '@/lib/pta3/pokedexFilter'
import { computeLevelEligibleEvolutionSet } from '@/lib/pta3/evolution'
import { PcBoard, type PcPokemon } from '@/app/(authenticated)/trainers/[id]/pc/PcBoard'

export default async function NpcPcPage({ params }: { params: Promise<{ id: string; trainerId: string }> }) {
  const { id: campaignId, trainerId: id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // No .eq('user_id', ...) filter -- RLS scopes this to the owner or the campaign's GM, same
  // reasoning as the NPC page.
  const { data: trainer } = await supabase
    .from('trainers')
    .select('id, name, user_id, campaign_id, is_npc, campaigns(gm_user_id)')
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
  // Routine action (same tier as HP adjustment), not GM-tier-gated -- the owner or that Campaign's
  // GM can both freely manage the Team/PC split.
  const canManage = isOwner || isGM

  // Every linked Pokemon, Team and PC alike -- split into the two lists below after computing
  // levels in bulk, rather than two separate queries.
  const [{ data: trainersPokemon }, { types }, { data: loyaltyRows }] = await Promise.all([
    supabase
      .from('trainers_pokemon')
      .select(
        `
        party_slot, obtain_method_id,
        pokemon(
          id, nickname, current_hp, ev_hp, bonus_base_hp, is_shiny, current_exp, loyalty_points, pokedex_id,
          pokedex(name, base_hp, sprite_code, growth_rate_id, type_1_id, type_2_id),
          held_item:items!held_item_id(name)
        )
      `,
      )
      .eq('trainer_id', id),
    fetchPokedexFilterOptions(supabase),
    supabase.from('loyalties').select('name, sort_order, min_points'),
  ])

  // Cast reflects the real runtime shape (pokemon/pokedex/held_item come back as single objects, not
  // the arrays TS infers for these embeds) -- same reverse-embed quirk documented throughout this
  // codebase.
  const rows = (trainersPokemon ?? []) as unknown as {
    party_slot: number | null
    obtain_method_id: number | null
    pokemon: {
      id: string
      nickname: string | null
      current_hp: number
      ev_hp: number
      bonus_base_hp: number
      is_shiny: boolean
      current_exp: number
      loyalty_points: number
      pokedex_id: number
      pokedex: { name: string; base_hp: number; sprite_code: string; growth_rate_id: number | null; type_1_id: number; type_2_id: number | null }
      held_item: { name: string } | null
    } | null
  }[]

  // PC-scale level computation -- see lib/pta3/pokemonLevel.ts's computePokemonLevelsBulk for why
  // this is a bulk call rather than the Trainer page's per-Pokemon computePokemonLevel loop.
  const levelsByPokemonId = await computePokemonLevelsBulk(
    supabase,
    rows.map((tp) => ({
      pokemonId: tp.pokemon!.id,
      currentExp: tp.pokemon!.current_exp,
      isShiny: tp.pokemon!.is_shiny,
      loyaltyPoints: tp.pokemon!.loyalty_points,
      obtainMethodId: tp.obtain_method_id,
      growthRateId: tp.pokemon!.pokedex!.growth_rate_id,
    })),
  )

  // [[Add Evolution functionality]]: gold-highlights a card whose level meets a level-based evolution
  // requirement -- bulk-computed once against the small evolution_triggers table, same "load once,
  // check in memory" shape as computePokemonLevelsBulk above.
  const evolutionEligibleIds = await computeLevelEligibleEvolutionSet(
    supabase,
    rows.map((tp) => ({ pokemonId: tp.pokemon!.id, pokedexId: tp.pokemon!.pokedex_id, level: levelsByPokemonId.get(tp.pokemon!.id)?.level ?? 1 })),
  )

  const allPokemon: PcPokemon[] = rows.map((tp) => {
    const p = tp.pokemon!
    return {
      id: p.id,
      nickname: p.nickname,
      currentHp: p.current_hp,
      maxHp: p.pokedex!.base_hp + p.bonus_base_hp + p.ev_hp * 6,
      isShiny: p.is_shiny,
      spriteCode: p.pokedex!.sprite_code,
      speciesName: p.pokedex!.name,
      level: levelsByPokemonId.get(p.id)?.level ?? 1,
      loyaltyName: computeLoyaltyTier(p.loyalty_points, loyaltyRows ?? [])?.name ?? null,
      type1Id: p.pokedex!.type_1_id,
      type2Id: p.pokedex!.type_2_id,
      partySlot: tp.party_slot,
      heldItemName: p.held_item?.name ?? null,
      evolutionEligible: evolutionEligibleIds.has(p.id),
    }
  })

  const team = allPokemon.filter((p) => p.partySlot !== null).sort((a, b) => (a.partySlot ?? 0) - (b.partySlot ?? 0))
  const pc = allPokemon.filter((p) => p.partySlot === null)

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-24">
      <div className="w-full max-w-6xl">
        <Link href={`/campaigns/${campaignId}/npcs/${id}`} className="text-sm underline">
          ← Back to {trainer.name}
        </Link>
      </div>

      <h1 className="w-full max-w-6xl text-2xl font-bold">{trainer.name}&apos;s PC</h1>

      <PcBoard trainerId={id} campaignId={campaignId} canManage={canManage} initialTeam={team} initialPc={pc} types={types} />
    </main>
  )
}
