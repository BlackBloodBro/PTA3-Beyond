import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createCustomMove } from '../actions'
import { MoveFields, type MoveFieldsInitial } from '../MoveFields'

export default async function NewCustomMovePage({
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

  const [{ data: types }, { data: proficiencies }, { data: templateOptions }] = await Promise.all([
    supabase.from('types').select('id, name').neq('name', 'Special/Variable').order('name'),
    supabase.from('proficiencies').select('id, name').order('name'),
    // [[Feature - GM Custom - Moves]]: every Move this GM's own session can see -- global catalog +
    // this Campaign's own customs, via the same RLS that already scopes every other picker. Backs the
    // "start from an existing Move" template picker below.
    supabase.from('moves').select('id, name').order('name'),
  ])

  let initial: MoveFieldsInitial | undefined

  const parsedTemplateId = templateId ? Number(templateId) : null
  if (parsedTemplateId) {
    const [{ data: templateRaw }, { data: proficiencyRows }] = await Promise.all([
      supabase.from('moves').select('name, type_id, damage_stat, range, frequency, damage_dice, description').eq('id', parsedTemplateId).maybeSingle(),
      supabase.from('moves_proficiencies').select('proficiency_id').eq('move_id', parsedTemplateId),
    ])

    if (templateRaw) {
      initial = {
        ...templateRaw,
        // A duplicate is a new, separately-named Move -- never silently reuses the template's own
        // name (which would just hit the duplicate-name error immediately on submit).
        name: '',
        proficiencyIds: (proficiencyRows ?? []).map((r) => r.proficiency_id),
      }
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-24">
      <div className="w-full max-w-sm">
        <Link href={`/campaigns/${id}/custom/moves`} className="text-sm underline">
          ← Custom Moves
        </Link>
      </div>

      <h1 className="text-2xl font-bold">New custom Move</h1>

      <form method="get" className="flex w-full max-w-sm items-end gap-2 rounded border p-3 text-sm">
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="templateId">Start from an existing Move (optional)</label>
          <select id="templateId" name="templateId" defaultValue={templateId ?? ''} className="bg-surface-subtle rounded border px-3 py-2">
            <option value="">None (blank)</option>
            {(templateOptions ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="rounded border px-3 py-2">
          Load
        </button>
      </form>
      {parsedTemplateId && !initial && <p className="w-full max-w-sm text-danger">That Move couldn&apos;t be loaded as a template.</p>}
      {initial && <p className="w-full max-w-sm text-xs text-muted">Loaded as a starting point -- edit anything below, including the name, before creating.</p>}

      {error && <p className="w-full max-w-sm text-danger">{error}</p>}

      <form action={createCustomMove.bind(null, id)} className="flex w-full max-w-sm flex-col gap-3">
        <MoveFields types={types ?? []} proficiencies={proficiencies ?? []} initial={initial} />
        <button type="submit" className="mt-2 rounded bg-accent px-4 py-2 text-accent-foreground">
          Create Move
        </button>
      </form>
    </main>
  )
}
