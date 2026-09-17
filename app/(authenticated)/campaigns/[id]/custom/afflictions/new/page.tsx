import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createCustomAffliction } from '../actions'
import { AfflictionFields, type AfflictionFieldsInitial } from '../AfflictionFields'

export default async function NewCustomAfflictionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; templateId?: string }>
}) {
  const { id } = await params
  const { error, templateId } = await searchParams
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

  const [{ data: stats }, { data: templateOptions }] = await Promise.all([
    supabase.from('stats').select('id, name').order('id'),
    // [[Feature - GM Custom - Afflictions]]: every affliction this GM's own session can see -- global
    // catalog + this Campaign's own customs, via the same RLS that already scopes the catalog. Backs
    // the "start from an existing affliction" template picker below.
    supabase.from('afflictions').select('id, name').order('name'),
  ])

  const statIds = (stats ?? []).map((s) => s.id)

  let initial: AfflictionFieldsInitial | undefined

  const parsedTemplateId = templateId ? Number(templateId) : null
  if (parsedTemplateId) {
    const [{ data: templateRaw }, { data: statRows }] = await Promise.all([
      supabase.from('afflictions').select('name, description, catch_modifier').eq('id', parsedTemplateId).maybeSingle(),
      supabase.from('afflictions_stats').select('stat_id, modifier').eq('affliction_id', parsedTemplateId),
    ])

    if (templateRaw) {
      initial = {
        ...templateRaw,
        // A duplicate is a new, separately-named affliction -- never silently reuses the template's
        // own name (which would just hit the duplicate-name error immediately on submit).
        name: '',
        statModifiers: Object.fromEntries((statRows ?? []).map((r) => [r.stat_id, r.modifier])),
      }
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-24">
      <div className="w-full max-w-sm">
        <Link href={`/campaigns/${id}/custom/afflictions`} className="text-sm underline">
          ← Custom Afflictions
        </Link>
      </div>

      <h1 className="text-2xl font-bold">New custom affliction</h1>

      <form method="get" className="flex w-full max-w-sm items-end gap-2 rounded border p-3 text-sm">
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="templateId">Start from an existing affliction (optional)</label>
          <select id="templateId" name="templateId" defaultValue={templateId ?? ''} className="bg-surface-subtle rounded border px-3 py-2">
            <option value="">None (blank)</option>
            {(templateOptions ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="rounded border px-3 py-2">
          Load
        </button>
      </form>
      {parsedTemplateId && !initial && <p className="w-full max-w-sm text-danger">That affliction couldn&apos;t be loaded as a template.</p>}
      {initial && <p className="w-full max-w-sm text-xs text-muted">Loaded as a starting point -- edit anything below, including the name, before creating.</p>}

      {error && <p className="w-full max-w-sm text-danger">{error}</p>}

      <form action={createCustomAffliction.bind(null, id, statIds)} className="flex w-full max-w-sm flex-col gap-3">
        <AfflictionFields stats={stats ?? []} initial={initial} />
        <button type="submit" className="mt-2 rounded bg-accent px-4 py-2 text-accent-foreground">
          Create affliction
        </button>
      </form>
    </main>
  )
}
