import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { fetchFilteredSpecies, fetchPokedexFilterOptions } from '@/lib/pta3/pokedexFilter'
import { SpeciesPicker } from '@/components/SpeciesPicker'
import { createPokemon } from '../actions'

export default async function NewPokemonPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; typeId?: string; habitatId?: string; campaignId?: string }>
}) {
  const { error, typeId, habitatId, campaignId } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const parsedTypeId = typeId ? Number(typeId) : null
  const parsedHabitatId = habitatId ? Number(habitatId) : null

  const [{ types, habitats }, species, { data: campaigns }, { data: natures }] = await Promise.all([
    fetchPokedexFilterOptions(supabase),
    fetchFilteredSpecies(supabase, { typeId: parsedTypeId, habitatId: parsedHabitatId }),
    supabase.from('campaigns').select('id, name').eq('gm_user_id', user.id).order('name'),
    supabase.from('natures').select('id, name').order('name'),
  ])

  // Trainers assignable at creation time -- any trainer in a campaign this user GMs, regardless of
  // which campaign (if any) the new Pokemon itself is tagged with above.
  const { data: trainers } = await supabase
    .from('trainers')
    .select('id, name, campaigns!inner(name, gm_user_id)')
    .eq('campaigns.gm_user_id', user.id)
    .order('name')

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-24">
      <h1 className="text-2xl font-bold">Create a Pokémon</h1>
      <p className="max-w-sm text-center text-sm text-muted">
        For Pokémon not tied to a trainer's own starter — wild encounters, GM gifts, etc. Leave it
        unassigned to add it to a pool you can hand to a trainer later.
      </p>

      {error && <p className="text-danger">{error}</p>}

      <form method="get" className="flex w-full max-w-sm flex-col gap-2 rounded border p-3 text-sm">
        <p className="font-medium">Filter species</p>
        <label htmlFor="typeId">Type</label>
        <select id="typeId" name="typeId" defaultValue={typeId ?? ''} className="bg-surface-subtle rounded border px-3 py-2">
          <option value="">Any type</option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        <label htmlFor="habitatId">Habitat</label>
        <select id="habitatId" name="habitatId" defaultValue={habitatId ?? ''} className="bg-surface-subtle rounded border px-3 py-2">
          <option value="">Any habitat</option>
          {habitats.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-3">
          <button type="submit" className="rounded border px-3 py-2">
            Apply filters
          </button>
          {(typeId || habitatId) && (
            <a href="/pokemon/new" className="text-xs underline">
              Clear filters
            </a>
          )}
        </div>
      </form>

      <p className="w-full max-w-sm text-xs text-muted">{species.length} matching species</p>

      <form action={createPokemon} className="flex w-full max-w-sm flex-col gap-3">
        <SpeciesPicker species={species} />

        <label htmlFor="nickname">Nickname (optional)</label>
        <input id="nickname" name="nickname" type="text" className="bg-surface-subtle rounded border px-3 py-2" />

        <label htmlFor="natureId">Nature (roll a d20 — numbers match the options below)</label>
        <select id="natureId" name="natureId" className="bg-surface-subtle rounded border px-3 py-2" defaultValue="random">
          <option value="random">Random</option>
          {(natures ?? []).map((n, i) => (
            <option key={n.id} value={n.id}>
              {i + 1}. {n.name}
            </option>
          ))}
        </select>

        <label htmlFor="gender">Gender</label>
        <select id="gender" name="gender" className="bg-surface-subtle rounded border px-3 py-2" defaultValue="random">
          <option value="random">Random</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="genderless">Genderless</option>
        </select>

        <label htmlFor="campaignId">Pool (optional)</label>
        <select id="campaignId" name="campaignId" className="bg-surface-subtle rounded border px-3 py-2" defaultValue={campaignId ?? ''}>
          <option value="">None (personal pool)</option>
          {(campaigns ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <label htmlFor="trainerId">Assign to trainer now (optional)</label>
        <select id="trainerId" name="trainerId" className="bg-surface-subtle rounded border px-3 py-2" defaultValue="">
          <option value="">Leave unassigned</option>
          {(trainers ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.campaigns?.name})
            </option>
          ))}
        </select>

        <button type="submit" className="mt-2 rounded bg-accent px-4 py-2 text-accent-foreground">
          Create Pokémon
        </button>
      </form>
    </main>
  )
}
