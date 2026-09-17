import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createCustomType, loadOtherVisibleTypes, loadTypeMatchupState } from '../actions'
import { TypeFields, type TypeFieldsInitial } from '../TypeFields'

export default async function NewCustomTypePage({
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

  const otherTypes = await loadOtherVisibleTypes(supabase)

  let initial: TypeFieldsInitial | undefined

  const parsedTemplateId = templateId ? Number(templateId) : null
  if (parsedTemplateId) {
    const { data: templateRaw } = await supabase.from('types').select('name').eq('id', parsedTemplateId).maybeSingle()

    if (templateRaw) {
      // Pre-fills this new Type's whole matchup set from the template's own -- still an explicit,
      // reviewable set of picks (per "force a walkthrough"), just starting from a real chart instead
      // of blank. otherTypes here excludes nothing, so the template's own self-matchup is looked up
      // separately from its matchups against every other visible Type.
      const { selfChoice, matchupsByOtherTypeId } = await loadTypeMatchupState(supabase, parsedTemplateId, otherTypes.map((t) => t.id))
      initial = {
        // A duplicate is a new, separately-named Type -- never silently reuses the template's own name.
        name: '',
        selfChoice,
        matchupsByOtherTypeId,
      }
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-24">
      <div className="w-full max-w-sm">
        <Link href={`/campaigns/${id}/custom/types`} className="text-sm underline">
          ← Custom Types
        </Link>
      </div>

      <h1 className="text-2xl font-bold">New custom type</h1>

      <form method="get" className="flex w-full max-w-sm items-end gap-2 rounded border p-3 text-sm">
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="templateId">Start from an existing Type (optional)</label>
          <select id="templateId" name="templateId" defaultValue={templateId ?? ''} className="bg-surface-subtle rounded border px-3 py-2">
            <option value="">None (blank)</option>
            {otherTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="rounded border px-3 py-2">
          Load
        </button>
      </form>
      {parsedTemplateId && !initial && <p className="w-full max-w-sm text-danger">That Type couldn&apos;t be loaded as a template.</p>}
      {initial && (
        <p className="w-full max-w-sm text-xs text-muted">
          Loaded the template&apos;s full matchup chart as a starting point -- review and adjust anything below, including the name, before
          creating.
        </p>
      )}

      {error && <p className="w-full max-w-sm text-danger">{error}</p>}

      <form action={createCustomType.bind(null, id)} className="flex w-full max-w-sm flex-col gap-3">
        <TypeFields otherTypes={otherTypes} initial={initial} />
        <button type="submit" className="mt-2 rounded bg-accent px-4 py-2 text-accent-foreground">
          Create type
        </button>
      </form>
    </main>
  )
}
