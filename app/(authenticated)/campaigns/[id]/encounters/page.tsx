import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createEncounter } from './actions'

// [[Feature - Add a combat encounter tracker]]: GM-only -- lets a GM prepare multiple Encounters
// ahead of a session (each its own draft row) and pick which one to start. Never player-visible;
// a Campaign member only ever sees a direct link to the currently active Encounter (from the
// Campaign page), not this list.
export default async function EncountersPage({
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

  const { data: encounters } = await supabase
    .from('encounters')
    .select('id, name, status, created_at')
    .eq('campaign_id', id)
    .order('created_at', { ascending: false })

  const drafts = (encounters ?? []).filter((e) => e.status === 'draft')
  const active = (encounters ?? []).find((e) => e.status === 'active')

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-24">
      <div className="w-full max-w-2xl">
        <Link href={`/campaigns/${id}`} className="text-sm underline">
          ← {campaign.name}
        </Link>
      </div>

      <div className="flex w-full max-w-2xl items-center justify-between">
        <h1 className="text-2xl font-bold">Encounters</h1>
      </div>

      {error && <p className="w-full max-w-2xl text-danger">{error}</p>}

      <form
        action={createEncounter.bind(null, id)}
        className="flex w-full max-w-2xl items-end gap-2 rounded border-accent bg-accent/10 p-3 text-sm"
      >
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="name" className="font-medium">
            Prepare a new Encounter
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            placeholder="e.g. Team Rocket ambush"
            className="bg-surface-subtle rounded border p-2"
          />
        </div>
        <button type="submit" className="rounded bg-accent px-4 py-2 text-accent-foreground">
          Prepare
        </button>
      </form>

      {active && (
        <div className="w-full max-w-2xl">
          <h2 className="mb-2 font-semibold">Active</h2>
          <Link
            href={`/campaigns/${id}/encounters/${active.id}`}
            className="block rounded border-accent bg-accent/10 p-3 underline hover:bg-accent/20"
          >
            {active.name}
          </Link>
        </div>
      )}

      {drafts.length > 0 && (
        <div className="w-full max-w-2xl">
          <h2 className="mb-2 font-semibold">Drafts</h2>
          <div className="flex flex-col gap-2">
            {drafts.map((e) => (
              <Link
                key={e.id}
                href={`/campaigns/${id}/encounters/${e.id}`}
                className="rounded border p-3 underline hover:bg-accent/10"
              >
                {e.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {(encounters ?? []).length === 0 && <p className="text-sm text-muted">No Encounters yet -- prepare one above.</p>}
    </main>
  )
}
