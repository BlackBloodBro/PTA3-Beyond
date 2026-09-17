import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ConfirmButton } from '@/components/ConfirmButton'
import { updateCustomAffliction, deleteCustomAffliction } from '../actions'
import { AfflictionFields } from '../AfflictionFields'

export default async function EditCustomAfflictionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; afflictionId: string }>
  searchParams: Promise<{ error?: string; saved?: string }>
}) {
  const { id, afflictionId: afflictionIdRaw } = await params
  const { error, saved } = await searchParams
  const afflictionId = Number(afflictionIdRaw)
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

  const { data: affliction } = await supabase
    .from('afflictions')
    .select('id, name, description, catch_modifier')
    .eq('id', afflictionId)
    .eq('campaign_id', id)
    .maybeSingle()

  if (!affliction) {
    redirect(`/campaigns/${id}/custom/afflictions`)
  }

  const [{ data: stats }, { data: statRows }] = await Promise.all([
    supabase.from('stats').select('id, name').order('id'),
    supabase.from('afflictions_stats').select('stat_id, modifier').eq('affliction_id', afflictionId),
  ])

  const statIds = (stats ?? []).map((s) => s.id)

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-24">
      <div className="w-full max-w-sm">
        <Link href={`/campaigns/${id}/custom/afflictions`} className="text-sm underline">
          ← Custom Afflictions
        </Link>
      </div>

      <div className="flex w-full max-w-sm items-center justify-between">
        <h1 className="text-2xl font-bold">{affliction.name}</h1>
        <div className="flex items-center gap-2">
          <Link href={`/campaigns/${id}/custom/afflictions/new?templateId=${afflictionId}`} className="rounded border px-3 py-2 text-sm">
            Duplicate
          </Link>
          <form action={deleteCustomAffliction.bind(null, id, afflictionId)}>
            <ConfirmButton
              confirmMessage={`Permanently delete "${affliction.name}"? This cannot be undone.`}
              className="rounded border border-danger px-3 py-2 text-sm text-danger"
            >
              Delete
            </ConfirmButton>
          </form>
        </div>
      </div>

      {error && <p className="w-full max-w-sm text-danger">{error}</p>}
      {saved && <p className="w-full max-w-sm text-success">Saved.</p>}

      <form action={updateCustomAffliction.bind(null, id, afflictionId, statIds)} className="flex w-full max-w-sm flex-col gap-3">
        <AfflictionFields
          stats={stats ?? []}
          initial={{
            ...affliction,
            statModifiers: Object.fromEntries((statRows ?? []).map((r) => [r.stat_id, r.modifier])),
          }}
        />
        <button type="submit" className="mt-2 rounded bg-accent px-4 py-2 text-accent-foreground">
          Save changes
        </button>
      </form>
    </main>
  )
}
