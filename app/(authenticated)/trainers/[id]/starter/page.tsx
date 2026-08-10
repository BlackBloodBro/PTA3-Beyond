import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { fetchFilteredSpecies, fetchPokedexFilterOptions } from '@/lib/pta3/pokedexFilter'
import { SpeciesPicker } from '@/components/SpeciesPicker'
import { createStarterPokemon } from './actions'

export default async function StarterPokemonPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; typeId?: string; habitatId?: string }>
}) {
  const { id } = await params
  const { error, typeId, habitatId } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: trainer } = await supabase
    .from('trainers')
    .select('id, name')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!trainer) {
    redirect('/dashboard')
  }

  // Still single-select here -- this flow's own filter UI is untouched by the multi-select change
  // ([[Bug - Improve Wild Pokemon creation and editing]] scoped that to /pokemon/new specifically),
  // just adapted to fetchFilteredSpecies' new array-based signature.
  const parsedTypeId = typeId ? Number(typeId) : null
  const parsedHabitatId = habitatId ? Number(habitatId) : null

  const [{ types, habitats }, species] = await Promise.all([
    fetchPokedexFilterOptions(supabase),
    fetchFilteredSpecies(supabase, { typeIds: parsedTypeId ? [parsedTypeId] : [], habitatIds: parsedHabitatId ? [parsedHabitatId] : [] }),
  ])

  const createStarterForTrainer = createStarterPokemon.bind(null, trainer.id)

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-24">
      <h1 className="text-2xl font-bold">Choose {trainer.name}&apos;s starter Pokémon</h1>

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
            <a href={`/trainers/${id}/starter`} className="text-xs underline">
              Clear filters
            </a>
          )}
        </div>
      </form>

      <p className="w-full max-w-sm text-xs text-muted">{species.length} matching species</p>

      <form action={createStarterForTrainer} className="flex w-full max-w-sm flex-col gap-3">
        <SpeciesPicker species={species} />

        <label htmlFor="nickname">Nickname (optional)</label>
        <input id="nickname" name="nickname" type="text" className="bg-surface-subtle rounded border px-3 py-2" />

        <button type="submit" className="mt-2 rounded bg-accent px-4 py-2 text-accent-foreground">
          Confirm starter
        </button>
      </form>
    </main>
  )
}
