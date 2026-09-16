import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createCustomItem } from '../actions'
import { ItemFields, type ItemFieldsInitial } from '../ItemFields'

export default async function NewCustomItemPage({
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

  const [{ data: types }, { data: categories }, { data: templateOptions }] = await Promise.all([
    supabase.from('types').select('id, name').neq('name', 'Special/Variable').order('name'),
    supabase.from('item_categories').select('id, name').order('name'),
    // [[Feature - GM Custom - Items]]: every item this GM's own session can see -- global catalog +
    // this Campaign's own customs, via the same RLS that already scopes loadItemCatalog -- backs the
    // "start from an existing item" template picker below.
    supabase.from('items').select('id, name').order('name'),
  ])

  // Resolved once here (server-side) rather than passed as a client prop -- lets a bad/inaccessible
  // templateId (RLS hides someone else's Campaign's customs) just silently fall back to blank, no
  // separate error path needed.
  let initial: ItemFieldsInitial | undefined

  const parsedTemplateId = templateId ? Number(templateId) : null
  if (parsedTemplateId) {
    const [{ data: templateRaw }, { data: categoryRows }, { data: boost }] = await Promise.all([
      supabase.from('items').select('name, description, buyable, price, stackable, holdable').eq('id', parsedTemplateId).maybeSingle(),
      supabase.from('items_item_categories').select('item_category_id').eq('item_id', parsedTemplateId),
      supabase.from('held_item_boosts').select('boosted_type_id, boost_amount').eq('item_id', parsedTemplateId).maybeSingle(),
    ])

    if (templateRaw) {
      initial = {
        ...templateRaw,
        // A duplicate is a new, separately-named item -- never silently reuses the template's own
        // name (which would just hit the duplicate-name error immediately on submit).
        name: '',
        categoryIds: (categoryRows ?? []).map((r) => r.item_category_id),
        boostedTypeId: boost?.boosted_type_id ?? null,
        boostAmount: boost?.boost_amount ?? null,
      }
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-24">
      <div className="w-full max-w-sm">
        <Link href={`/campaigns/${id}/custom/items`} className="text-sm underline">
          ← Custom Items
        </Link>
      </div>

      <h1 className="text-2xl font-bold">New custom item</h1>

      <form method="get" className="flex w-full max-w-sm items-end gap-2 rounded border p-3 text-sm">
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="templateId">Start from an existing item (optional)</label>
          <select id="templateId" name="templateId" defaultValue={templateId ?? ''} className="bg-surface-subtle rounded border px-3 py-2">
            <option value="">None (blank)</option>
            {(templateOptions ?? []).map((it) => (
              <option key={it.id} value={it.id}>
                {it.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="rounded border px-3 py-2">
          Load
        </button>
      </form>
      {parsedTemplateId && !initial && <p className="w-full max-w-sm text-danger">That item couldn&apos;t be loaded as a template.</p>}
      {initial && <p className="w-full max-w-sm text-xs text-muted">Loaded as a starting point -- edit anything below, including the name, before creating.</p>}

      {error && <p className="w-full max-w-sm text-danger">{error}</p>}

      <form action={createCustomItem.bind(null, id)} className="flex w-full max-w-sm flex-col gap-3">
        <ItemFields types={types ?? []} categories={categories ?? []} initial={initial} />
        <button type="submit" className="mt-2 rounded bg-accent px-4 py-2 text-accent-foreground">
          Create item
        </button>
      </form>
    </main>
  )
}
