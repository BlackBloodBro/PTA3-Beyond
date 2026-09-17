import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ConfirmButton } from '@/components/ConfirmButton'
import { updateCustomItemCategory, deleteCustomItemCategory } from '../actions'
import { ItemCategoryFields } from '../ItemCategoryFields'

export default async function EditCustomItemCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; itemCategoryId: string }>
  searchParams: Promise<{ error?: string; saved?: string }>
}) {
  const { id, itemCategoryId: itemCategoryIdRaw } = await params
  const { error, saved } = await searchParams
  const itemCategoryId = Number(itemCategoryIdRaw)
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

  const { data: category } = await supabase
    .from('item_categories')
    .select('id, name, description')
    .eq('id', itemCategoryId)
    .eq('campaign_id', id)
    .maybeSingle()

  if (!category) {
    redirect(`/campaigns/${id}/custom/item-categories`)
  }

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-24">
      <div className="w-full max-w-sm">
        <Link href={`/campaigns/${id}/custom/item-categories`} className="text-sm underline">
          ← Custom Item Categories
        </Link>
      </div>

      <div className="flex w-full max-w-sm items-center justify-between">
        <h1 className="text-2xl font-bold">{category.name}</h1>
        <div className="flex items-center gap-2">
          <Link href={`/campaigns/${id}/custom/item-categories/new?templateId=${itemCategoryId}`} className="rounded border px-3 py-2 text-sm">
            Duplicate
          </Link>
          <form action={deleteCustomItemCategory.bind(null, id, itemCategoryId)}>
            <ConfirmButton
              confirmMessage={`Permanently delete "${category.name}"? Any of your custom items filed under it will lose that category. This cannot be undone.`}
              className="rounded border border-danger px-3 py-2 text-sm text-danger"
            >
              Delete
            </ConfirmButton>
          </form>
        </div>
      </div>

      {error && <p className="w-full max-w-sm text-danger">{error}</p>}
      {saved && <p className="w-full max-w-sm text-success">Saved.</p>}

      <form action={updateCustomItemCategory.bind(null, id, itemCategoryId)} className="flex w-full max-w-sm flex-col gap-3">
        <ItemCategoryFields initial={category} />
        <button type="submit" className="mt-2 rounded bg-accent px-4 py-2 text-accent-foreground">
          Save changes
        </button>
      </form>
    </main>
  )
}
