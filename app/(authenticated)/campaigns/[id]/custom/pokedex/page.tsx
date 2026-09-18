import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function CampaignPokedexPage({
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

  const { data: species } = await supabase
    .from('pokedex')
    .select('id, name, sprite_code, type_1:types!type_1_id(name), type_2:types!type_2_id(name)')
    .eq('campaign_id', id)
    .order('name')

  const list = (species ?? []) as unknown as { id: number; name: string; sprite_code: string | null; type_1: { name: string } | null; type_2: { name: string } | null }[]

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-24">
      <div className="w-full max-w-2xl">
        <Link href={`/campaigns/${id}/custom`} className="text-sm underline">
          ← Customization
        </Link>
      </div>

      <div className="flex w-full max-w-2xl items-center justify-between">
        <h1 className="text-2xl font-bold">Custom Pokédex</h1>
        <Link href={`/campaigns/${id}/custom/pokedex/new`} className="rounded bg-accent px-4 py-2 text-sm text-accent-foreground">
          + New species
        </Link>
      </div>

      <p className="w-full max-w-2xl text-sm text-muted">
        Homebrew species for this Campaign only, alongside the global Pokédex -- your players will see these in every species picker
        (creating a Pokémon, choosing a starter, breeding).
      </p>

      {error && <p className="w-full max-w-2xl text-danger">{error}</p>}

      {list.length === 0 ? (
        <p className="w-full max-w-2xl text-sm text-muted">No custom species yet.</p>
      ) : (
        <ul className="flex w-full max-w-2xl flex-col gap-2">
          {list.map((s) => (
            <li key={s.id}>
              <Link href={`/campaigns/${id}/custom/pokedex/${s.id}`} className="block rounded border-accent bg-accent/10 p-3 hover:bg-accent/20">
                <span className="font-semibold underline">{s.name}</span>
                <span className="ml-2 text-sm text-muted">{[s.type_1?.name, s.type_2?.name].filter(Boolean).join(' / ') || 'No type'}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
