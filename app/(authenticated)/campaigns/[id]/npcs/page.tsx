import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { convertTrainerToNpc } from '@/app/(authenticated)/campaigns/[id]/actions'
import { ConfirmButton } from '@/components/ConfirmButton'
import { LABEL_CHIP_CLASSES, type LabelColor } from '@/lib/pta3/labelColors'

export default async function CampaignNpcsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; q?: string; labelIds?: string | string[] }>
}) {
  const { id } = await params
  const { error, q, labelIds: labelIdsRaw } = await searchParams
  const labelIds = !labelIdsRaw ? [] : Array.isArray(labelIdsRaw) ? labelIdsRaw : [labelIdsRaw]
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

  const { data: allLabels } = await supabase
    .from('campaign_labels')
    .select('id, name, color')
    .eq('campaign_id', id)
    .order('name')

  // Candidates for "convert an existing trainer" below -- the GM's own regular trainers (not
  // already an NPC anywhere), regardless of which campaign (if any) they're currently in.
  const { data: convertibleTrainers } = await supabase
    .from('trainers')
    .select('id, name')
    .eq('user_id', user.id)
    .eq('is_npc', false)
    .order('name')

  let query = supabase
    .from('trainers')
    .select('id, name, level, classes(name), trainer_labels(campaign_labels(id, name, color))')
    .eq('campaign_id', id)
    .eq('is_npc', true)
    .order('name')

  if (q) {
    query = query.ilike('name', `%${q}%`)
  }

  const { data: npcsRaw } = await query

  // Label filtering (OR semantics -- "has any of the checked labels") happens here rather than as
  // a PostgREST embedded-resource filter -- simpler than the join-filter syntax for what's expected
  // to be at most dozens of rows per campaign.
  const npcs = (npcsRaw ?? []).filter((n) => {
    if (labelIds.length === 0) return true
    return (n.trainer_labels ?? []).some((tl) => tl.campaign_labels && labelIds.includes(String(tl.campaign_labels.id)))
  })

  function buildFilterUrl(nextLabelIds: string[]) {
    const sp = new URLSearchParams()
    if (q) sp.set('q', q)
    nextLabelIds.forEach((lid) => sp.append('labelIds', lid))
    const qs = sp.toString()
    return `/campaigns/${id}/npcs${qs ? `?${qs}` : ''}`
  }

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-24">
      <div className="w-full max-w-2xl">
        <Link href={`/campaigns/${id}`} className="text-sm underline">
          ← {campaign.name}
        </Link>
      </div>

      <div className="flex w-full max-w-2xl items-center justify-between">
        <h1 className="text-2xl font-bold">NPCs</h1>
        <Link href={`/campaigns/${id}/npcs/new`} className="rounded bg-accent px-4 py-2 text-sm text-accent-foreground">
          + New NPC
        </Link>
      </div>

      {error && <p className="w-full max-w-2xl text-danger">{error}</p>}

      {(convertibleTrainers ?? []).length > 0 && (
        <form
          action={convertTrainerToNpc.bind(null, id)}
          className="flex w-full max-w-2xl flex-wrap items-center gap-2 rounded border p-3 text-sm"
        >
          <label htmlFor="trainerId" className="font-medium">
            Turn an existing trainer into an NPC here
          </label>
          <select id="trainerId" name="trainerId" required defaultValue="" className="bg-surface-subtle rounded border p-2">
            <option value="" disabled>
              Choose a trainer...
            </option>
            {(convertibleTrainers ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <ConfirmButton
            confirmMessage="Convert this trainer into an NPC here? It will move into this campaign and become GM-only -- hidden from fellow players, and off the global Trainers list."
            className="rounded border px-3 py-2"
          >
            Convert
          </ConfirmButton>
        </form>
      )}

      <form method="get" className="flex w-full max-w-2xl flex-col gap-2 rounded border p-3 text-sm">
        <label htmlFor="q" className="font-medium">
          Search by name
        </label>
        <input id="q" name="q" type="text" defaultValue={q ?? ''} className="bg-surface-subtle rounded border px-3 py-2" />

        {(allLabels ?? []).length > 0 && (
          <>
            <p className="mt-1 font-medium">Labels</p>
            <div className="flex flex-wrap gap-2">
              {(allLabels ?? []).map((label) => (
                <label
                  key={label.id}
                  className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs ${LABEL_CHIP_CLASSES[label.color as LabelColor]}`}
                >
                  <input type="checkbox" name="labelIds" value={label.id} defaultChecked={labelIds.includes(label.id)} />
                  {label.name}
                </label>
              ))}
            </div>
          </>
        )}

        <div className="mt-1 flex items-center gap-3">
          <button type="submit" className="rounded border px-3 py-2">
            Apply filters
          </button>
          {(q || labelIds.length > 0) && (
            <a href={`/campaigns/${id}/npcs`} className="text-xs underline">
              Clear filters
            </a>
          )}
        </div>
      </form>

      <div className="flex w-full max-w-2xl flex-col gap-2">
        {npcs.length === 0 ? (
          <p className="text-sm text-muted">No NPCs match.</p>
        ) : (
          npcs.map((n) => (
            <Link key={n.id} href={`/trainers/${n.id}`} className="flex flex-col gap-1 rounded border p-3 hover:bg-surface-subtle">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{n.name}</span>
                <span className="text-sm text-muted">
                  Level {n.level} {n.classes?.name}
                </span>
              </div>
              {(n.trainer_labels ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {(n.trainer_labels ?? []).map(
                    (tl, i) =>
                      tl.campaign_labels && (
                        <span
                          key={i}
                          className={`rounded-full px-2 py-0.5 text-xs ${LABEL_CHIP_CLASSES[tl.campaign_labels.color as LabelColor]}`}
                        >
                          {tl.campaign_labels.name}
                        </span>
                      ),
                  )}
                </div>
              )}
            </Link>
          ))
        )}
      </div>
    </main>
  )
}
