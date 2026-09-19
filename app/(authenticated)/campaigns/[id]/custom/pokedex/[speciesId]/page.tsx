import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ConfirmButton } from '@/components/ConfirmButton'
import { updateCustomSpecies, deleteCustomSpecies } from '../actions'
import { SpeciesStatBlockFields } from '../SpeciesStatBlockFields'
import { SpeciesRelationsEditor } from './SpeciesRelationsEditor'

export default async function EditCustomSpeciesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; speciesId: string }>
  searchParams: Promise<{ error?: string; saved?: string }>
}) {
  const { id, speciesId: speciesIdRaw } = await params
  const { error, saved } = await searchParams
  const speciesId = Number(speciesIdRaw)
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

  const { data: speciesRaw } = await supabase
    .from('pokedex')
    .select(
      'id, name, type_1_id, type_2_id, size_id, weight_id, growth_rate_id, base_hp, base_atk, base_def, base_sp_atk, base_sp_def, base_speed, catch_rate, egg_hatch_rate, description, sprite_code',
    )
    .eq('id', speciesId)
    .eq('campaign_id', id)
    .maybeSingle()

  if (!speciesRaw) {
    redirect(`/campaigns/${id}/custom/pokedex`)
  }

  const [
    { data: types },
    { data: sizes },
    { data: weights },
    { data: growthRates },
    { data: habitats },
    { data: proficiencies },
    { data: diets },
    { data: eggGroups },
    { data: habitatRows },
    { data: proficiencyRows },
    { data: dietRows },
    { data: eggGroupRows },
    { data: allMoves },
    { data: allPassives },
    { data: moveRows },
    { data: passiveRows },
  ] = await Promise.all([
    supabase.from('types').select('id, name').neq('name', 'Special/Variable').order('name'),
    supabase.from('sizes').select('id, name').order('name'),
    supabase.from('weights').select('id, name').order('name'),
    supabase.from('growth_rates').select('id, name').order('name'),
    supabase.from('habitats').select('id, name').order('name'),
    supabase.from('proficiencies').select('id, name').order('name'),
    supabase.from('diets').select('id, name').order('name'),
    supabase.from('egg_groups').select('id, name').order('name'),
    supabase.from('pokedex_habitats').select('habitat_id').eq('pokedex_id', speciesId),
    supabase.from('pokedex_proficiencies').select('proficiency_id').eq('pokedex_id', speciesId),
    supabase.from('pokedex_diets').select('diet_id').eq('pokedex_id', speciesId),
    supabase.from('pokedex_egg_groups').select('egg_group_id').eq('pokedex_id', speciesId),
    supabase.from('moves').select('id, name, range, damage_stat, types(name)').order('name'),
    supabase.from('passives').select('id, name, passive_type, category').order('name'),
    supabase.from('pokedex_moves').select('level_learned, learnable_without_exp, move:moves(id, name, range, damage_stat, types(name))').eq('pokedex_id', speciesId),
    supabase.from('pokedex_passives').select('level_learned, passive:passives(id, name, passive_type, category)').eq('pokedex_id', speciesId),
  ])

  const species = speciesRaw

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-24">
      <div className="w-full max-w-sm">
        <Link href={`/campaigns/${id}/custom/pokedex`} className="text-sm underline">
          ← Custom Pokédex
        </Link>
      </div>

      <div className="flex w-full max-w-sm items-center justify-between">
        <h1 className="text-2xl font-bold">{species.name}</h1>
        <div className="flex items-center gap-2">
          <Link href={`/campaigns/${id}/custom/pokedex/new?templateId=${speciesId}`} className="rounded border px-3 py-2 text-sm">
            Duplicate
          </Link>
          <form action={deleteCustomSpecies.bind(null, id, speciesId)}>
            <ConfirmButton
              confirmMessage={`Permanently delete "${species.name}"? Any Pokémon already using it will keep working, but this can't be used to create new ones anymore. This cannot be undone.`}
              className="rounded border border-danger px-3 py-2 text-sm text-danger"
            >
              Delete
            </ConfirmButton>
          </form>
        </div>
      </div>

      {error && <p className="w-full max-w-sm text-danger">{error}</p>}
      {saved && <p className="w-full max-w-sm text-success">Saved.</p>}

      {/* [[Feature - GM Custom - Pokemon]]: Save sits at the true bottom of the page, after the
          Moves/Passives editor too, matching this codebase's own convention (CampaignInfoSection,
          SellPricePercentSection, PokemonInteractive's EV editor -- Save always follows every field,
          never precedes them). The button lives outside this <form>'s own DOM subtree (after
          SpeciesRelationsEditor below), so it's tied back to the form by id via the `form` attribute
          instead of literal nesting. */}
      <form id="species-edit-form" action={updateCustomSpecies.bind(null, id, speciesId)} className="flex w-full max-w-sm flex-col gap-3">
        <SpeciesStatBlockFields
          types={types ?? []}
          sizes={sizes ?? []}
          weights={weights ?? []}
          growthRates={growthRates ?? []}
          habitats={habitats ?? []}
          proficiencies={proficiencies ?? []}
          diets={diets ?? []}
          eggGroups={eggGroups ?? []}
          initial={{
            ...species,
            habitatIds: (habitatRows ?? []).map((r) => r.habitat_id),
            proficiencyIds: (proficiencyRows ?? []).map((r) => r.proficiency_id),
            dietIds: (dietRows ?? []).map((r) => r.diet_id),
            eggGroupIds: (eggGroupRows ?? []).map((r) => r.egg_group_id),
          }}
        />
      </form>

      <SpeciesRelationsEditor
        campaignId={id}
        pokedexId={speciesId}
        allMoves={(allMoves ?? []) as unknown as { id: number; name: string; range: string; damage_stat: string; types: { name: string } | null }[]}
        allPassives={(allPassives ?? []) as unknown as { id: number; name: string; passive_type: string; category: string | null }[]}
        initialMoves={
          (moveRows ?? []) as unknown as {
            level_learned: number | null
            learnable_without_exp: boolean
            move: { id: number; name: string; range: string; damage_stat: string; types: { name: string } | null }
          }[]
        }
        initialPassives={
          (passiveRows ?? []) as unknown as { level_learned: number | null; passive: { id: number; name: string; passive_type: string; category: string | null } }[]
        }
      />

      <button type="submit" form="species-edit-form" className="w-full max-w-sm rounded bg-accent px-4 py-2 text-accent-foreground">
        Save changes
      </button>
    </main>
  )
}
