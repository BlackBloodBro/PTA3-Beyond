import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { HomebrewItemsList } from '../HomebrewItemsList'

export default async function CampaignItemsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams
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

  const { data: itemsRaw } = await supabase
    .from('items')
    .select('id, name, buyable, price, items_item_categories(item_categories(name))')
    .eq('campaign_id', id)
    .order('name')

  // Same reverse-embed quirk documented throughout this codebase -- items_item_categories is genuinely
  // one-to-many so it comes back as an array (no cast needed for that specifically).
  type ItemRow = { id: number; name: string; buyable: boolean; price: number | null; items_item_categories: { item_categories: { name: string } | null }[] }
  const items = ((itemsRaw ?? []) as unknown as ItemRow[]).map((it) => ({
    id: it.id,
    name: it.name,
    buyable: it.buyable,
    price: it.price,
    categoryNames: it.items_item_categories.map((c) => c.item_categories?.name).filter((n): n is string => !!n),
  }))

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-24">
      <div className="w-full max-w-2xl">
        <Link href={`/campaigns/${id}/custom`} className="text-sm underline">
          ← Customization
        </Link>
      </div>

      <div className="flex w-full max-w-2xl items-center justify-between">
        <h1 className="text-2xl font-bold">Custom Items</h1>
        <Link href={`/campaigns/${id}/custom/items/new`} className="rounded bg-accent px-4 py-2 text-sm text-accent-foreground">
          + New item
        </Link>
      </div>

      <p className="w-full max-w-2xl text-sm text-muted">
        Homebrew items for this Campaign only, alongside the global catalog -- your players will see these in the Bag&apos;s Catalog and
        Inventory.
      </p>

      {error && <p className="w-full max-w-2xl text-danger">{error}</p>}

      {items.length === 0 ? (
        <p className="w-full max-w-2xl text-sm text-muted">No custom items yet.</p>
      ) : (
        <HomebrewItemsList campaignId={id} items={items} />
      )}
    </main>
  )
}
