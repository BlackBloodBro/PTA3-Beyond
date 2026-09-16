import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ConfirmButton } from '@/components/ConfirmButton'
import { updateCustomItem, deleteCustomItem } from '../actions'
import { ItemFields } from '../ItemFields'

export default async function EditCustomItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; itemId: string }>
  searchParams: Promise<{ error?: string; saved?: string }>
}) {
  const { id, itemId: itemIdRaw } = await params
  const { error, saved } = await searchParams
  const itemId = Number(itemIdRaw)
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

  const { data: item } = await supabase
    .from('items')
    .select('id, name, description, buyable, price, stackable, holdable')
    .eq('id', itemId)
    .eq('campaign_id', id)
    .maybeSingle()

  if (!item) {
    redirect(`/campaigns/${id}/custom/items`)
  }

  const [{ data: types }, { data: categories }, { data: categoryRows }, { data: boost }] = await Promise.all([
    supabase.from('types').select('id, name').neq('name', 'Special/Variable').order('name'),
    supabase.from('item_categories').select('id, name').order('name'),
    supabase.from('items_item_categories').select('item_category_id').eq('item_id', itemId),
    supabase.from('held_item_boosts').select('boosted_type_id, boost_amount').eq('item_id', itemId).maybeSingle(),
  ])

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-24">
      <div className="w-full max-w-sm">
        <Link href={`/campaigns/${id}/custom/items`} className="text-sm underline">
          ← Custom Items
        </Link>
      </div>

      <div className="flex w-full max-w-sm items-center justify-between">
        <h1 className="text-2xl font-bold">{item.name}</h1>
        <div className="flex items-center gap-2">
          <Link href={`/campaigns/${id}/custom/items/new?templateId=${itemId}`} className="rounded border px-3 py-2 text-sm">
            Duplicate
          </Link>
          <form action={deleteCustomItem.bind(null, id, itemId)}>
            <ConfirmButton
              confirmMessage={`Permanently delete "${item.name}"? Any Trainer already carrying it will keep it, but this can't be used to grant/buy new ones anymore. This cannot be undone.`}
              className="rounded border border-danger px-3 py-2 text-sm text-danger"
            >
              Delete
            </ConfirmButton>
          </form>
        </div>
      </div>

      {error && <p className="w-full max-w-sm text-danger">{error}</p>}
      {saved && <p className="w-full max-w-sm text-success">Saved.</p>}

      <form action={updateCustomItem.bind(null, id, itemId)} className="flex w-full max-w-sm flex-col gap-3">
        <ItemFields
          types={types ?? []}
          categories={categories ?? []}
          initial={{
            ...item,
            categoryIds: (categoryRows ?? []).map((r) => r.item_category_id),
            boostedTypeId: boost?.boosted_type_id ?? null,
            boostAmount: boost?.boost_amount ?? null,
          }}
        />
        <button type="submit" className="mt-2 rounded bg-accent px-4 py-2 text-accent-foreground">
          Save changes
        </button>
      </form>
    </main>
  )
}
