import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { deletePokemon } from '@/app/(authenticated)/pokemon/actions'
import { PokemonSprite } from '@/components/PokemonSprite'
import { ConfirmButton } from '@/components/ConfirmButton'
import { PokemonAssignmentPanel } from './PokemonAssignmentPanel'
import { pokemonHref } from '@/lib/pta3/pokemonPaths'

export default async function PokemonListPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const [{ data: gmCampaigns }, { data: assignedPokemonRaw }, { data: poolPokemonRaw }, { data: myTrainers }, { data: gmTrainers }] =
    await Promise.all([
      supabase.from('campaigns').select('id, name').eq('gm_user_id', user.id).order('created_at', { ascending: false }),
      // Pokemon belonging to one of your own trainers, via trainers_pokemon (not the "Owners can
      // view their pokemon" RLS policy directly, since that alone wouldn't let this query group by
      // trainer for display).
      supabase
        .from('trainers_pokemon')
        .select('trainer_id, trainers!inner(id, name, user_id, is_npc, campaign_id), pokemon(id, nickname, is_shiny, pokedex(name, sprite_code))')
        .eq('trainers.user_id', user.id),
      // Pool Pokemon this user created -- filtered to unassigned (no trainers_pokemon row) below,
      // since PostgREST has no direct "no related row exists" filter for a reverse relation.
      supabase
        .from('pokemon')
        .select('id, nickname, is_shiny, campaign_id, pokedex(name, sprite_code), trainers_pokemon(trainer_id)')
        .eq('created_by_user_id', user.id),
      // Assignable targets, half one: every trainer you own that ISN'T in a campaign -- a campaign
      // hands GM-tier control (including assignment) to that campaign's GM alone, even over a trainer
      // you own yourself, so a campaign trainer only ever becomes assignable via the GM half below.
      supabase.from('trainers').select('id, name, is_npc, campaigns(name)').eq('user_id', user.id).is('campaign_id', null).order('name'),
      // Assignable targets, half two: every trainer in a campaign you GM (not just your own trainers,
      // and including your own trainers that ARE in that campaign) -- the GM-hands-a-caught-wild-
      // Pokemon-to-a-player-or-NPC workflow. Merged with myTrainers below and deduped by id.
      supabase.from('trainers').select('id, name, is_npc, campaigns!inner(name, gm_user_id)').eq('campaigns.gm_user_id', user.id).order('name'),
    ])

  const assignableTrainersById = new Map<string, { id: string; name: string; is_npc: boolean; campaignName: string | null }>()
  for (const t of [...(myTrainers ?? []), ...(gmTrainers ?? [])]) {
    assignableTrainersById.set(t.id, { id: t.id, name: t.name, is_npc: t.is_npc, campaignName: t.campaigns?.name ?? null })
  }
  const assignableTrainers = Array.from(assignableTrainersById.values()).sort((a, b) => a.name.localeCompare(b.name))

  // Campaigns a Pokemon's pool can be tagged with are GM-only -- matches createPokemon's own rule.
  const assignableCampaignsForPokemon = gmCampaigns ?? []

  type PokemonRow = {
    id: string
    nickname: string | null
    is_shiny: boolean
    pokedex: { name: string; sprite_code: string } | null
    trainerId: string | null
    trainerName: string | null
    trainerIsNpc: boolean | null
    trainerCampaignId: string | null
    campaignId: string | null
  }

  // Cast reflects the real runtime shape (pokedex/trainers come back as single objects, not the
  // arrays TS infers for these embeds) -- same reverse-embed quirk documented throughout this
  // codebase wherever a query is given an explicit result type.
  const assignedRows = ((assignedPokemonRaw ?? [])
    .filter((tp) => tp.pokemon)
    .map((tp) => ({
      id: tp.pokemon!.id,
      nickname: tp.pokemon!.nickname,
      is_shiny: tp.pokemon!.is_shiny,
      pokedex: tp.pokemon!.pokedex,
      trainerId: tp.trainer_id,
      trainerName: tp.trainers?.name ?? null,
      trainerIsNpc: tp.trainers?.is_npc ?? null,
      trainerCampaignId: tp.trainers?.campaign_id ?? null,
      campaignId: null,
    })) as unknown) as PokemonRow[]

  const poolRows = ((poolPokemonRaw ?? [])
    .filter((p) => !p.trainers_pokemon)
    .map((p) => ({
      id: p.id,
      nickname: p.nickname,
      is_shiny: p.is_shiny,
      pokedex: p.pokedex,
      trainerId: null,
      trainerName: null,
      trainerIsNpc: null,
      trainerCampaignId: null,
      campaignId: p.campaign_id,
    })) as unknown) as PokemonRow[]

  const allMyPokemon = [...assignedRows, ...poolRows]

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-24">
      <div className="w-full max-w-2xl">
        <Link href="/dashboard" className="text-sm underline">
          ← Dashboard
        </Link>
      </div>

      <div className="flex w-full max-w-2xl items-center justify-between">
        <h1 className="text-2xl font-bold">Pokémon</h1>
        <Link href="/pokemon/new" className="rounded bg-accent px-4 py-2 text-sm text-accent-foreground">
          + New Pokémon
        </Link>
      </div>

      {error && <p className="w-full max-w-2xl text-danger">{error}</p>}

      <div className="flex w-full max-w-2xl flex-col gap-2">
        {allMyPokemon.length === 0 ? (
          <p className="text-sm text-muted">You don&apos;t have any Pokémon yet.</p>
        ) : (
          allMyPokemon.map((p) => (
            <div key={p.id} className="flex flex-col gap-2 rounded border p-3">
              <div className="flex items-center justify-between gap-2">
                <Link
                  href={pokemonHref({
                    id: p.id,
                    hasOwner: p.trainerId !== null,
                    campaignId: p.trainerId !== null ? p.trainerCampaignId : p.campaignId,
                  })}
                  className="flex items-center gap-2 underline"
                >
                  {p.pokedex && <PokemonSprite spriteCode={p.pokedex.sprite_code} shiny={p.is_shiny} alt={p.pokedex.name} size={32} />}
                  {p.nickname ? `${p.nickname} (${p.pokedex?.name})` : p.pokedex?.name}
                </Link>
                <form action={deletePokemon.bind(null, p.id)}>
                  <ConfirmButton
                    confirmMessage={`Permanently delete ${
                      p.nickname ? `${p.nickname} (${p.pokedex?.name})` : p.pokedex?.name
                    }? This cannot be undone.`}
                    className="rounded border border-danger px-3 py-1 text-xs text-danger"
                  >
                    Delete
                  </ConfirmButton>
                </form>
              </div>

              <PokemonAssignmentPanel
                pokemonId={p.id}
                initialTrainerId={p.trainerId}
                initialTrainerName={p.trainerName}
                initialTrainerIsNpc={p.trainerIsNpc}
                initialTrainerCampaignId={p.trainerCampaignId}
                initialCampaignId={p.campaignId}
                assignableTrainers={assignableTrainers}
                assignableCampaigns={assignableCampaignsForPokemon}
              />
            </div>
          ))
        )}
      </div>
    </main>
  )
}
