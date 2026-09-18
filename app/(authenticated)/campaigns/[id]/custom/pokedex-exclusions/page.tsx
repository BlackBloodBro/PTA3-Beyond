import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PokedexExclusionsBrowser } from './PokedexExclusionsBrowser'

export default async function PokedexExclusionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
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

  const [{ data: species }, { data: excluded }] = await Promise.all([
    supabase
      .from('pokedex')
      .select('id, name, sprite_code, type_1:types!type_1_id(name), type_2:types!type_2_id(name)')
      .is('campaign_id', null)
      .order('name'),
    supabase.from('campaign_excluded_pokedex').select('pokedex_id').eq('campaign_id', id),
  ])

  type SpeciesRow = { id: number; name: string; sprite_code: string | null; type_1: { name: string } | null; type_2: { name: string } | null }
  const speciesList = (species ?? []) as unknown as SpeciesRow[]
  const excludedIds = (excluded ?? []).map((r) => r.pokedex_id)

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-24">
      <div className="w-full max-w-2xl">
        <Link href={`/campaigns/${id}/custom`} className="text-sm underline">
          ← Customization
        </Link>
      </div>

      <h1 className="w-full max-w-2xl text-2xl font-bold">Excluded Pokémon</h1>
      <p className="w-full max-w-2xl text-sm text-muted">
        Mark global Pokémon that don&apos;t exist in this Campaign&apos;s world -- your players won&apos;t be able to pick an excluded
        species as a starter or add one to the pool. You can still use one yourself for NPCs and wild encounters.
      </p>

      <PokedexExclusionsBrowser campaignId={id} species={speciesList} initialExcludedIds={excludedIds} />
    </main>
  )
}
