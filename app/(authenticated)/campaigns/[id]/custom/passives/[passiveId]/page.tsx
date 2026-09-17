import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ConfirmButton } from '@/components/ConfirmButton'
import { updateCustomPassive, deleteCustomPassive } from '../actions'
import { PassiveFields } from '../PassiveFields'

export default async function EditCustomPassivePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; passiveId: string }>
  searchParams: Promise<{ error?: string; saved?: string }>
}) {
  const { id, passiveId: passiveIdRaw } = await params
  const { error, saved } = await searchParams
  const passiveId = Number(passiveIdRaw)
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

  const { data: passive } = await supabase
    .from('passives')
    .select('id, name, description, passive_type, category, context')
    .eq('id', passiveId)
    .eq('campaign_id', id)
    .maybeSingle()

  if (!passive) {
    redirect(`/campaigns/${id}/custom/passives`)
  }

  const [{ data: stats }, { data: statRows }] = await Promise.all([
    supabase.from('stats').select('id, name').order('id'),
    supabase.from('passives_stats').select('stat_id, modifier').eq('passive_id', passiveId),
  ])

  const statIds = (stats ?? []).map((s) => s.id)

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-24">
      <div className="w-full max-w-sm">
        <Link href={`/campaigns/${id}/custom/passives`} className="text-sm underline">
          ← Custom Passives
        </Link>
      </div>

      <div className="flex w-full max-w-sm items-center justify-between">
        <h1 className="text-2xl font-bold">{passive.name}</h1>
        <div className="flex items-center gap-2">
          <Link href={`/campaigns/${id}/custom/passives/new?templateId=${passiveId}`} className="rounded border px-3 py-2 text-sm">
            Duplicate
          </Link>
          <form action={deleteCustomPassive.bind(null, id, passiveId)}>
            <ConfirmButton confirmMessage={`Permanently delete "${passive.name}"? This cannot be undone.`} className="rounded border border-danger px-3 py-2 text-sm text-danger">
              Delete
            </ConfirmButton>
          </form>
        </div>
      </div>

      {error && <p className="w-full max-w-sm text-danger">{error}</p>}
      {saved && <p className="w-full max-w-sm text-success">Saved.</p>}

      <form action={updateCustomPassive.bind(null, id, passiveId, statIds)} className="flex w-full max-w-sm flex-col gap-3">
        <PassiveFields
          stats={stats ?? []}
          initial={{
            ...passive,
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
