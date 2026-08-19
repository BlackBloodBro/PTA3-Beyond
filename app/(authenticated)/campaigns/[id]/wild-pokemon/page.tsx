import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { type LabelColor } from '@/lib/pta3/labelColors'
import { computePokemonLevelsBulk } from '@/lib/pta3/pokemonLevel'
import { fetchPokedexFilterOptions } from '@/lib/pta3/pokedexFilter'
import { WildPokemonList, type WildPokemon } from './WildPokemonList'

export default async function CampaignWildPokemonPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: campaign } = await supabase.from('campaigns').select('id, name, gm_user_id').eq('id', id).single()

  if (!campaign || campaign.gm_user_id !== user.id) {
    redirect(`/campaigns/${id}`)
  }

  const [{ data: allLabels }, { data: poolRaw }, { data: trainers }, { types }] = await Promise.all([
    supabase.from('campaign_labels').select('id, name, color').eq('campaign_id', id).order('name'),
    // Same unassigned-pool pattern as the dashboard: created_by_user_id is what actually grants
    // access (matches "Creator manages their own unassigned pokemon" RLS), scoped here to this
    // campaign's pool specifically.
    supabase
      .from('pokemon')
      .select(
        `id, nickname, is_shiny, current_exp, loyalty_points,
        pokedex(name, sprite_code, growth_rate_id, type_1_id, type_2_id),
        trainers_pokemon(trainer_id), pokemon_labels(campaign_labels(id, name, color))`,
      )
      .eq('campaign_id', id)
      .eq('created_by_user_id', user.id),
    // Assignable targets: every trainer (player or NPC) in this campaign.
    supabase.from('trainers').select('id, name, is_npc').eq('campaign_id', id).order('name'),
    fetchPokedexFilterOptions(supabase),
  ])

  // Search/label filtering happens live, client-side, in WildPokemonList -- this only applies the
  // structural "is this actually still wild" filter, not the user-facing search/label filters.
  // Cast here (not at the final prop) to sidestep the reverse-embed quirk where PostgREST's
  // single-object `pokedex` embed still infers as an array in TS -- see pokemonLevel.ts/WildPokemonList.tsx.
  type PoolRow = {
    id: string
    nickname: string | null
    is_shiny: boolean
    current_exp: number
    loyalty_points: number
    pokedex: { name: string; sprite_code: string; growth_rate_id: number | null; type_1_id: number; type_2_id: number | null } | null
    trainers_pokemon: { trainer_id: string } | null
    pokemon_labels: { campaign_labels: { id: string; name: string; color: string } | null }[]
  }
  const wildPokemon = ((poolRaw ?? []) as unknown as PoolRow[]).filter((p) => !p.trainers_pokemon)

  // Wild Pokemon have no trainers_pokemon row (unowned), so obtainMethodId is always null here --
  // computePokemonLevelsBulk defaults that modifier to 1, same as an "unset" obtain method anywhere else.
  const levelsByPokemonId = await computePokemonLevelsBulk(
    supabase,
    wildPokemon.map((p) => ({
      pokemonId: p.id,
      currentExp: p.current_exp,
      isShiny: p.is_shiny,
      loyaltyPoints: p.loyalty_points,
      obtainMethodId: null,
      growthRateId: p.pokedex!.growth_rate_id,
    })),
  )

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-24">
      <div className="w-full max-w-2xl">
        <Link href={`/campaigns/${id}`} className="text-sm underline">
          ← {campaign.name}
        </Link>
      </div>

      {error && <p className="w-full max-w-2xl text-danger">{error}</p>}

      <div className="flex w-full max-w-2xl items-center justify-between">
        <h1 className="text-2xl font-bold">Wild Pokémon</h1>
        <Link href={`/pokemon/new?campaignId=${id}`} className="rounded bg-accent px-4 py-2 text-sm text-accent-foreground">
          + New Pokémon
        </Link>
      </div>

      <WildPokemonList
        campaignId={id}
        initialPokemon={wildPokemon.map(
          (p): WildPokemon => ({
            id: p.id,
            nickname: p.nickname,
            is_shiny: p.is_shiny,
            pokedex: p.pokedex,
            level: levelsByPokemonId.get(p.id)?.level ?? 1,
            type1Id: p.pokedex!.type_1_id,
            type2Id: p.pokedex!.type_2_id,
            labelIds: (p.pokemon_labels ?? []).map((pl) => pl.campaign_labels?.id).filter((v): v is string => Boolean(v)),
          }),
        )}
        initialLabels={(allLabels ?? []).map((l) => ({ id: l.id, name: l.name, color: l.color as LabelColor }))}
        trainers={trainers ?? []}
        types={types}
      />
    </main>
  )
}
