import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SpeciesCreateForm } from './SpeciesCreateForm'
import type { SpeciesStatBlockInitial } from '../SpeciesStatBlockFields'

export default async function NewCustomSpeciesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; templateId?: string }>
}) {
  const { id } = await params
  const { error, templateId } = await searchParams
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

  const [{ data: types }, { data: sizes }, { data: weights }, { data: growthRates }, { data: habitats }, { data: proficiencies }, { data: diets }, { data: eggGroups }, { data: allMoves }, { data: allPassives }, { data: templateOptions }] =
    await Promise.all([
      supabase.from('types').select('id, name').neq('name', 'Special/Variable').order('name'),
      supabase.from('sizes').select('id, name').order('name'),
      supabase.from('weights').select('id, name').order('name'),
      supabase.from('growth_rates').select('id, name').order('name'),
      supabase.from('habitats').select('id, name').order('name'),
      supabase.from('proficiencies').select('id, name').order('name'),
      supabase.from('diets').select('id, name').order('name'),
      supabase.from('egg_groups').select('id, name').order('name'),
      supabase.from('moves').select('id, name, range, damage_stat, types(name)').order('name'),
      supabase.from('passives').select('id, name, passive_type, category').order('name'),
      // [[Feature - GM Custom - Pokemon]]: every species this GM's own session can see -- global
      // catalog + this Campaign's own customs, via the same RLS that already scopes fetchFilteredSpecies
      // -- backs the "start from an existing species" template picker below.
      supabase.from('pokedex').select('id, name').order('name'),
    ])

  // Resolved once here (server-side) rather than passed as a client prop -- lets a bad/inaccessible
  // templateId (RLS hides someone else's Campaign's customs) just silently fall back to blank, no
  // separate error path needed.
  let initial: SpeciesStatBlockInitial | undefined
  let initialMoves: { level_learned: number | null; move: { id: number; name: string; range: string; damage_stat: string; types: { name: string } | null } }[] | undefined
  let initialPassives: { level_learned: number | null; passive: { id: number; name: string; passive_type: string; category: string | null } }[] | undefined

  const parsedTemplateId = templateId ? Number(templateId) : null
  if (parsedTemplateId) {
    const [{ data: templateRaw }, { data: habitatRows }, { data: proficiencyRows }, { data: dietRows }, { data: eggGroupRows }, { data: moveRows }, { data: passiveRows }] = await Promise.all([
      supabase
        .from('pokedex')
        .select(
          'name, type_1_id, type_2_id, size_id, weight_id, growth_rate_id, base_hp, base_atk, base_def, base_sp_atk, base_sp_def, base_speed, catch_rate, egg_hatch_rate, description, sprite_code',
        )
        .eq('id', parsedTemplateId)
        .maybeSingle(),
      supabase.from('pokedex_habitats').select('habitat_id').eq('pokedex_id', parsedTemplateId),
      supabase.from('pokedex_proficiencies').select('proficiency_id').eq('pokedex_id', parsedTemplateId),
      supabase.from('pokedex_diets').select('diet_id').eq('pokedex_id', parsedTemplateId),
      supabase.from('pokedex_egg_groups').select('egg_group_id').eq('pokedex_id', parsedTemplateId),
      supabase.from('pokedex_moves').select('level_learned, move:moves(id, name, range, damage_stat, types(name))').eq('pokedex_id', parsedTemplateId),
      supabase.from('pokedex_passives').select('level_learned, passive:passives(id, name, passive_type, category)').eq('pokedex_id', parsedTemplateId),
    ])

    if (templateRaw) {
      initial = {
        ...templateRaw,
        // A duplicate is a new, separately-named species -- never silently reuses the template's own
        // name (which would just hit the duplicate-name error immediately on submit).
        name: '',
        habitatIds: (habitatRows ?? []).map((r) => r.habitat_id),
        proficiencyIds: (proficiencyRows ?? []).map((r) => r.proficiency_id),
        dietIds: (dietRows ?? []).map((r) => r.diet_id),
        eggGroupIds: (eggGroupRows ?? []).map((r) => r.egg_group_id),
      }
      initialMoves = (moveRows ?? []) as unknown as typeof initialMoves
      initialPassives = (passiveRows ?? []) as unknown as typeof initialPassives
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-24">
      <div className="w-full max-w-sm">
        <Link href={`/campaigns/${id}/custom/pokedex`} className="text-sm underline">
          ← Custom Pokédex
        </Link>
      </div>

      <h1 className="text-2xl font-bold">New custom species</h1>

      <form method="get" className="flex w-full max-w-sm items-end gap-2 rounded border p-3 text-sm">
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="templateId">Start from an existing species (optional)</label>
          <select id="templateId" name="templateId" defaultValue={templateId ?? ''} className="bg-surface-subtle rounded border px-3 py-2">
            <option value="">None (blank)</option>
            {(templateOptions ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="rounded border px-3 py-2">
          Load
        </button>
      </form>
      {parsedTemplateId && !initial && <p className="w-full max-w-sm text-danger">That species couldn&apos;t be loaded as a template.</p>}
      {initial && <p className="w-full max-w-sm text-xs text-muted">Loaded as a starting point -- edit anything below, including the name, before creating.</p>}

      {error && <p className="w-full max-w-sm text-danger">{error}</p>}

      <SpeciesCreateForm
        campaignId={id}
        types={types ?? []}
        sizes={sizes ?? []}
        weights={weights ?? []}
        growthRates={growthRates ?? []}
        habitats={habitats ?? []}
        proficiencies={proficiencies ?? []}
        diets={diets ?? []}
        eggGroups={eggGroups ?? []}
        allMoves={(allMoves ?? []) as unknown as { id: number; name: string; range: string; damage_stat: string; types: { name: string } | null }[]}
        allPassives={(allPassives ?? []) as unknown as { id: number; name: string; passive_type: string; category: string | null }[]}
        initial={initial}
        initialMoves={initialMoves}
        initialPassives={initialPassives}
      />
    </main>
  )
}
