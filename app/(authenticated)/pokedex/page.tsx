import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { loadPokedexBrowse, loadMovesBrowse, loadSkillsBrowse, loadClassesBrowse, loadOriginsBrowse } from '@/lib/pta3/referenceBrowser'
import { loadItemCatalog } from '@/lib/pta3/bag'
import { fetchPokedexFilterOptions } from '@/lib/pta3/pokedexFilter'
import { PokedexBrowser } from './PokedexBrowser'

export default async function PokedexPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Signed-in is the only gate -- this is reference data, not scoped to anything owned.
  const [pokedex, moves, items, skills, classes, origins, { types, habitats }] = await Promise.all([
    loadPokedexBrowse(supabase),
    loadMovesBrowse(supabase),
    loadItemCatalog(supabase),
    loadSkillsBrowse(supabase),
    loadClassesBrowse(supabase),
    loadOriginsBrowse(supabase),
    fetchPokedexFilterOptions(supabase),
  ])

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-24">
      <div className="w-full max-w-4xl">
        <Link href="/dashboard" className="text-sm underline">
          ← Dashboard
        </Link>
      </div>

      <h1 className="w-full max-w-4xl text-2xl font-bold">Pokédex</h1>

      <PokedexBrowser
        pokedex={pokedex}
        moves={moves}
        items={items}
        skills={skills}
        classes={classes}
        origins={origins}
        types={types}
        habitats={habitats}
      />
    </main>
  )
}
