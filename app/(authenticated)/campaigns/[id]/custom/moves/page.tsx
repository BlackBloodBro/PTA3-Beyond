import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadTypesBrowse } from '@/lib/pta3/referenceBrowser'
import { HomebrewMovesList } from '../HomebrewMovesList'

export default async function CampaignMovesPage({
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

  const [{ data: movesRaw }, types] = await Promise.all([
    supabase.from('moves').select('id, name, damage_stat, frequency, range, types(name)').eq('campaign_id', id).order('name'),
    loadTypesBrowse(supabase, id),
  ])

  type MoveRow = { id: number; name: string; damage_stat: string; frequency: string | null; range: string | null; types: { name: string } | null }
  const moves = ((movesRaw ?? []) as unknown as MoveRow[]).map((m) => ({
    id: m.id,
    name: m.name,
    typeName: m.types?.name ?? null,
    damage_stat: m.damage_stat,
    frequency: m.frequency,
    range: m.range,
  }))

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-24">
      <div className="w-full max-w-2xl">
        <Link href={`/campaigns/${id}/custom`} className="text-sm underline">
          ← Customization
        </Link>
      </div>

      <div className="flex w-full max-w-2xl items-center justify-between">
        <h1 className="text-2xl font-bold">Custom Moves</h1>
        <Link href={`/campaigns/${id}/custom/moves/new`} className="rounded bg-accent px-4 py-2 text-sm text-accent-foreground">
          + New Move
        </Link>
      </div>

      <p className="w-full max-w-2xl text-sm text-muted">
        Homebrew Moves for this Campaign only, alongside the global catalog -- your players will see these anywhere a Move can be learned.
      </p>

      {error && <p className="w-full max-w-2xl text-danger">{error}</p>}

      {moves.length === 0 ? (
        <p className="w-full max-w-2xl text-sm text-muted">No custom Moves yet.</p>
      ) : (
        <HomebrewMovesList campaignId={id} moves={moves} types={types} />
      )}
    </main>
  )
}
