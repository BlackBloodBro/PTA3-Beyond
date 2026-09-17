import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createCustomItemCategory } from '../actions'
import { ItemCategoryFields, type ItemCategoryFieldsInitial } from '../ItemCategoryFields'

export default async function NewCustomItemCategoryPage({
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

  // [[Feature - GM Custom - Item Category]]: every item category this GM's own session can see --
  // global catalog + this Campaign's own customs, via the same RLS that already scopes every other
  // picker. Backs the "start from an existing category" template picker below.
  const { data: templateOptions } = await supabase.from('item_categories').select('id, name').order('name')

  let initial: ItemCategoryFieldsInitial | undefined

  const parsedTemplateId = templateId ? Number(templateId) : null
  if (parsedTemplateId) {
    const { data: templateRaw } = await supabase.from('item_categories').select('name, description').eq('id', parsedTemplateId).maybeSingle()

    if (templateRaw) {
      initial = {
        ...templateRaw,
        // A duplicate is a new, separately-named category -- never silently reuses the template's own
        // name (which would just hit the duplicate-name error immediately on submit).
        name: '',
      }
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-24">
      <div className="w-full max-w-sm">
        <Link href={`/campaigns/${id}/custom/item-categories`} className="text-sm underline">
          ← Custom Item Categories
        </Link>
      </div>

      <h1 className="text-2xl font-bold">New custom item category</h1>

      <form method="get" className="flex w-full max-w-sm items-end gap-2 rounded border p-3 text-sm">
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="templateId">Start from an existing category (optional)</label>
          <select id="templateId" name="templateId" defaultValue={templateId ?? ''} className="bg-surface-subtle rounded border px-3 py-2">
            <option value="">None (blank)</option>
            {(templateOptions ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="rounded border px-3 py-2">
          Load
        </button>
      </form>
      {parsedTemplateId && !initial && <p className="w-full max-w-sm text-danger">That category couldn&apos;t be loaded as a template.</p>}
      {initial && <p className="w-full max-w-sm text-xs text-muted">Loaded as a starting point -- edit anything below, including the name, before creating.</p>}

      {error && <p className="w-full max-w-sm text-danger">{error}</p>}

      <form action={createCustomItemCategory.bind(null, id)} className="flex w-full max-w-sm flex-col gap-3">
        <ItemCategoryFields initial={initial} />
        <button type="submit" className="mt-2 rounded bg-accent px-4 py-2 text-accent-foreground">
          Create category
        </button>
      </form>
    </main>
  )
}
