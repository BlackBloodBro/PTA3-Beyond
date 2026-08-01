import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { computePokemonLevelsBulk } from '@/lib/pta3/pokemonLevel'
import { fetchPokedexFilterOptions } from '@/lib/pta3/pokedexFilter'
import { PcBoard, type PcPokemon } from './PcBoard'

export default async function PCPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // No .eq('user_id', ...) filter -- RLS scopes this to the owner or the campaign's GM, same
  // reasoning as the Trainer page.
  const { data: trainer } = await supabase
    .from('trainers')
    .select('id, name, user_id, campaign_id, campaigns(gm_user_id)')
    .eq('id', id)
    .single()

  if (!trainer) {
    redirect('/dashboard')
  }

  const isOwner = trainer.user_id === user.id
  const isGM = trainer.campaigns?.gm_user_id === user.id
  // Routine action (same tier as HP adjustment), not GM-tier-gated -- the owner or that Campaign's
  // GM can both freely manage the Team/PC split.
  const canManage = isOwner || isGM

  // Every linked Pokemon, Team and PC alike -- split into the two lists below after computing
  // levels in bulk, rather than two separate queries.
  const [{ data: trainersPokemon }, { types }] = await Promise.all([
    supabase
      .from('trainers_pokemon')
      .select(
        `
        party_slot, obtain_method_id,
        pokemon(
          id, nickname, current_hp, ev_hp, is_shiny, current_exp, loyalty_id,
          pokedex(name, base_hp, sprite_code, growth_rate_id, type_1_id, type_2_id),
          loyalty:loyalties(name)
        )
      `,
      )
      .eq('trainer_id', id),
    fetchPokedexFilterOptions(supabase),
  ])

  const rows = trainersPokemon ?? []

  // PC-scale level computation -- see lib/pta3/pokemonLevel.ts's computePokemonLevelsBulk for why
  // this is a bulk call rather than the Trainer page's per-Pokemon computePokemonLevel loop.
  const levelsByPokemonId = await computePokemonLevelsBulk(
    supabase,
    rows.map((tp) => ({
      pokemonId: tp.pokemon!.id,
      currentExp: tp.pokemon!.current_exp,
      isShiny: tp.pokemon!.is_shiny,
      loyaltyId: tp.pokemon!.loyalty_id,
      obtainMethodId: tp.obtain_method_id,
      growthRateId: tp.pokemon!.pokedex!.growth_rate_id,
    })),
  )

  const allPokemon: PcPokemon[] = rows.map((tp) => {
    const p = tp.pokemon!
    return {
      id: p.id,
      nickname: p.nickname,
      currentHp: p.current_hp,
      maxHp: p.pokedex!.base_hp + p.ev_hp * 6,
      isShiny: p.is_shiny,
      spriteCode: p.pokedex!.sprite_code,
      speciesName: p.pokedex!.name,
      level: levelsByPokemonId.get(p.id)?.level ?? 1,
      loyaltyName: p.loyalty?.name ?? null,
      type1Id: p.pokedex!.type_1_id,
      type2Id: p.pokedex!.type_2_id,
      partySlot: tp.party_slot,
    }
  })

  const team = allPokemon.filter((p) => p.partySlot !== null).sort((a, b) => (a.partySlot ?? 0) - (b.partySlot ?? 0))
  const pc = allPokemon.filter((p) => p.partySlot === null)

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-24">
      <div className="w-full max-w-6xl">
        <Link href={`/trainers/${id}`} className="text-sm underline">
          ← Back to {trainer.name}
        </Link>
      </div>

      <h1 className="w-full max-w-6xl text-2xl font-bold">{trainer.name}&apos;s PC</h1>

      <PcBoard trainerId={id} canManage={canManage} initialTeam={team} initialPc={pc} types={types} />
    </main>
  )
}
