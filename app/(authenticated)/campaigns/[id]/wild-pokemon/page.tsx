import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LABEL_CHIP_CLASSES, type LabelColor } from '@/lib/pta3/labelColors'
import { WildPokemonList, type WildPokemon } from './WildPokemonList'

export default async function CampaignWildPokemonPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; q?: string; labelIds?: string | string[] }>
}) {
  const { id } = await params
  const { error, q, labelIds: labelIdsRaw } = await searchParams
  const labelIds = !labelIdsRaw ? [] : Array.isArray(labelIdsRaw) ? labelIdsRaw : [labelIdsRaw]
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

  const [{ data: allLabels }, { data: poolRaw }, { data: trainers }] = await Promise.all([
    supabase.from('campaign_labels').select('id, name, color').eq('campaign_id', id).order('name'),
    // Same unassigned-pool pattern as the dashboard: created_by_user_id is what actually grants
    // access (matches "Creator manages their own unassigned pokemon" RLS), scoped here to this
    // campaign's pool specifically.
    supabase
      .from('pokemon')
      .select(
        'id, nickname, is_shiny, pokedex(name, sprite_code), trainers_pokemon(trainer_id), pokemon_labels(campaign_labels(id, name, color))',
      )
      .eq('campaign_id', id)
      .eq('created_by_user_id', user.id),
    // Assignable targets: every trainer (player or NPC) in this campaign.
    supabase.from('trainers').select('id, name, is_npc').eq('campaign_id', id).order('name'),
  ])

  const searchLower = (q ?? '').trim().toLowerCase()
  const wildPokemon = (poolRaw ?? [])
    .filter((p) => !p.trainers_pokemon)
    .filter((p) => {
      if (!searchLower) return true
      const nickname = p.nickname?.toLowerCase() ?? ''
      const speciesName = p.pokedex?.name?.toLowerCase() ?? ''
      return nickname.includes(searchLower) || speciesName.includes(searchLower)
    })
    .filter((p) => {
      if (labelIds.length === 0) return true
      return (p.pokemon_labels ?? []).some((pl) => pl.campaign_labels && labelIds.includes(String(pl.campaign_labels.id)))
    })

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

      <form method="get" className="flex w-full max-w-2xl flex-col gap-2 rounded border p-3 text-sm">
        <label htmlFor="q" className="font-medium">
          Search by nickname or species
        </label>
        <input id="q" name="q" type="text" defaultValue={q ?? ''} className="bg-surface-subtle rounded border px-3 py-2" />

        {(allLabels ?? []).length > 0 && (
          <>
            <p className="mt-1 font-medium">Labels</p>
            <div className="flex flex-wrap gap-2">
              {(allLabels ?? []).map((label) => (
                <label
                  key={label.id}
                  className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs ${LABEL_CHIP_CLASSES[label.color as LabelColor]}`}
                >
                  <input type="checkbox" name="labelIds" value={label.id} defaultChecked={labelIds.includes(label.id)} />
                  {label.name}
                </label>
              ))}
            </div>
          </>
        )}

        <div className="mt-1 flex items-center gap-3">
          <button type="submit" className="rounded border px-3 py-2">
            Apply filters
          </button>
          {(q || labelIds.length > 0) && (
            <a href={`/campaigns/${id}/wild-pokemon`} className="text-xs underline">
              Clear filters
            </a>
          )}
        </div>
      </form>

      <WildPokemonList
        campaignId={id}
        initialPokemon={
          wildPokemon.map((p) => ({
            id: p.id,
            nickname: p.nickname,
            is_shiny: p.is_shiny,
            pokedex: p.pokedex,
            labelIds: (p.pokemon_labels ?? []).map((pl) => pl.campaign_labels?.id).filter((v): v is string => Boolean(v)),
          })) as unknown as WildPokemon[]
        }
        initialLabels={(allLabels ?? []).map((l) => ({ id: l.id, name: l.name, color: l.color as LabelColor }))}
        trainers={trainers ?? []}
      />
    </main>
  )
}
