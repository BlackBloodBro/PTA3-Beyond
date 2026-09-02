import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { fetchFilteredSpecies, fetchPokedexFilterOptions } from '@/lib/pta3/pokedexFilter'
import { CreatePokemonForm } from './CreatePokemonForm'

// Normalizes a searchParams entry that's a bare string when there's exactly one value, or an array
// when there are several -- native <input type="checkbox" name="typeIds" value="X"> repeated with
// the same name submits as multiple values under that one key, which is how the multi-select filter
// below works without any client JS.
function toIdArray(raw: string | string[] | undefined): number[] {
  if (!raw) return []
  const values = Array.isArray(raw) ? raw : [raw]
  return values.map(Number).filter((n) => !Number.isNaN(n))
}

export default async function NewPokemonPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; typeIds?: string | string[]; habitatIds?: string | string[]; campaignId?: string }>
}) {
  const { error, typeIds, habitatIds, campaignId } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const selectedTypeIds = toIdArray(typeIds)
  const selectedHabitatIds = toIdArray(habitatIds)

  const [
    { types, habitats },
    species,
    { data: gmCampaigns },
    { data: playerCampaignTrainers },
    { data: natures },
    { data: loyaltyTiers },
    { data: obtainMethods },
    { data: items },
    { data: sizes },
    { data: weights },
    { data: levels },
    { data: shinyModifiers },
  ] = await Promise.all([
    fetchPokedexFilterOptions(supabase),
    fetchFilteredSpecies(supabase, { typeIds: selectedTypeIds, habitatIds: selectedHabitatIds }),
    supabase.from('campaigns').select('id, name').eq('gm_user_id', user.id).order('name'),
    // [[Users should be able to add Pokemon to their Trainers in a Campaign]]: a player who isn't a
    // GM can still tag a new Pokemon into a campaign's pool, as long as they have a Trainer there --
    // createPokemon enforces the same check server-side, this is just what populates the picker.
    supabase.from('trainers').select('campaigns(id, name)').eq('user_id', user.id).not('campaign_id', 'is', null),
    // Nature stat preview reuses the exact same query shape as the Pokemon detail page's edit form.
    supabase.from('natures').select('id, name, increased:stats!increased_stat_id(name), decreased:stats!decreased_stat_id(name)').order('name'),
    // Modifier/sort_order/min_points only -- the live level preview derives the current tier from a
    // typed "Starting LP" number now, per [[Add a Loyalty editor]], not a picked id.
    supabase.from('loyalties').select('modifier, sort_order, min_points'),
    supabase.from('obtain_methods').select('id, name, modifier').order('name'),
    supabase.from('items').select('id, name').order('name'),
    supabase.from('sizes').select('id, name').order('name'),
    supabase.from('weights').select('id, name').order('name'),
    supabase.from('levels').select('level_number, cumulative_exp').order('level_number'),
    supabase.from('exp_modifiers_shiny').select('name, modifier'),
  ])

  // Trainers assignable at creation time -- any trainer in a campaign this user GMs, regardless of
  // which campaign (if any) the new Pokemon itself is tagged with above. Direct-to-Trainer
  // assignment stays GM-only, unlike the pool-tagging picker below.
  const { data: trainers } = await supabase
    .from('trainers')
    .select('id, name, campaigns!inner(name, gm_user_id)')
    .eq('campaigns.gm_user_id', user.id)
    .order('name')

  // Merge GM'd campaigns with campaigns the user merely plays in (has a Trainer there) -- both are
  // valid pools to tag a new Pokemon into, deduped by id since a GM who's also somehow a player in
  // their own campaign would otherwise appear twice.
  const campaignMap = new Map<string, { id: string; name: string }>()
  for (const c of gmCampaigns ?? []) campaignMap.set(c.id, c)
  for (const row of (playerCampaignTrainers ?? []) as unknown as { campaigns: { id: string; name: string } | null }[]) {
    if (row.campaigns) campaignMap.set(row.campaigns.id, row.campaigns)
  }
  const campaigns = [...campaignMap.values()].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-24">
      <h1 className="text-2xl font-bold">Create a Pokémon</h1>
      <p className="max-w-sm text-center text-sm text-muted">
        For Pokémon not tied to a trainer's own starter — wild encounters, GM gifts, etc. Leave it
        unassigned to add it to a pool you can hand to a trainer later.
      </p>

      {error && <p className="text-danger">{error}</p>}

      <form method="get" className="flex w-full max-w-sm flex-col gap-2 rounded border border-accent bg-accent/10 p-4 text-sm">
        <h2 className="font-semibold">Filter species</h2>

        {/* Native <details>/<summary> gives a closed-by-default dropdown with a real selection box
            inside once opened -- no client JS needed, and the checkboxes underneath still submit via
            this plain GET form exactly as before (multi-select, [[Bug - Improve Wild Pokemon creation
            and editing]]). */}
        <details className="rounded border">
          <summary className="cursor-pointer select-none px-2 py-1.5 text-sm">
            Type {selectedTypeIds.length > 0 ? `(${selectedTypeIds.length} selected)` : '(any)'}
          </summary>
          <div className="flex flex-wrap gap-x-3 gap-y-1 border-t p-2">
            {types.map((t) => (
              <label key={t.id} className="flex items-center gap-1">
                <input type="checkbox" name="typeIds" value={t.id} defaultChecked={selectedTypeIds.includes(t.id)} />
                {t.name}
              </label>
            ))}
          </div>
        </details>

        <details className="rounded border">
          <summary className="cursor-pointer select-none px-2 py-1.5 text-sm">
            Habitat {selectedHabitatIds.length > 0 ? `(${selectedHabitatIds.length} selected)` : '(any)'}
          </summary>
          <div className="flex flex-wrap gap-x-3 gap-y-1 border-t p-2">
            {habitats.map((h) => (
              <label key={h.id} className="flex items-center gap-1">
                <input type="checkbox" name="habitatIds" value={h.id} defaultChecked={selectedHabitatIds.includes(h.id)} />
                {h.name}
              </label>
            ))}
          </div>
        </details>

        <div className="mt-2 flex items-center gap-3">
          <button type="submit" className="rounded border px-3 py-2">
            Apply filters
          </button>
          {(selectedTypeIds.length > 0 || selectedHabitatIds.length > 0) && (
            <a href="/pokemon/new" className="text-xs underline">
              Clear filters
            </a>
          )}
        </div>
      </form>

      <p className="w-full max-w-sm text-xs text-muted">{species.length} matching species</p>

      <CreatePokemonForm
        species={species}
        natures={(natures ?? []) as unknown as { id: number; name: string; increased: { name: string } | null; decreased: { name: string } | null }[]}
        loyaltyTiers={loyaltyTiers ?? []}
        obtainMethods={obtainMethods ?? []}
        items={items ?? []}
        types={types}
        sizes={sizes ?? []}
        weights={weights ?? []}
        levels={levels ?? []}
        shinyModifiers={shinyModifiers ?? []}
        campaigns={campaigns}
        trainers={(trainers ?? []) as unknown as { id: string; name: string; campaigns: { name: string } | null }[]}
        defaultCampaignId={campaignId ?? ''}
      />
    </main>
  )
}
