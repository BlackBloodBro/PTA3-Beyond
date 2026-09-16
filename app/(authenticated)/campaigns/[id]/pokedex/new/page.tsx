import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createCustomSpecies } from '../actions'
import { SpeciesForm } from '../SpeciesForm'

export default async function NewCustomSpeciesPage({
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

  const [{ data: types }, { data: sizes }, { data: weights }, { data: growthRates }, { data: habitats }, { data: proficiencies }, { data: diets }, { data: eggGroups }] =
    await Promise.all([
      supabase.from('types').select('id, name').neq('name', 'Special/Variable').order('name'),
      supabase.from('sizes').select('id, name').order('name'),
      supabase.from('weights').select('id, name').order('name'),
      supabase.from('growth_rates').select('id, name').order('name'),
      supabase.from('habitats').select('id, name').order('name'),
      supabase.from('proficiencies').select('id, name').order('name'),
      supabase.from('diets').select('id, name').order('name'),
      supabase.from('egg_groups').select('id, name').order('name'),
    ])

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-24">
      <div className="w-full max-w-sm">
        <Link href={`/campaigns/${id}/pokedex`} className="text-sm underline">
          ← Custom Pokédex
        </Link>
      </div>

      <h1 className="text-2xl font-bold">New custom species</h1>

      {error && <p className="text-danger">{error}</p>}

      <SpeciesForm
        action={createCustomSpecies.bind(null, id)}
        submitLabel="Create species"
        types={types ?? []}
        sizes={sizes ?? []}
        weights={weights ?? []}
        growthRates={growthRates ?? []}
        habitats={habitats ?? []}
        proficiencies={proficiencies ?? []}
        diets={diets ?? []}
        eggGroups={eggGroups ?? []}
      />
    </main>
  )
}
