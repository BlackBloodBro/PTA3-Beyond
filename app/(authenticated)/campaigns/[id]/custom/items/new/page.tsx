import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createCustomItem } from '../actions'
import { ItemFields } from '../ItemFields'

export default async function NewCustomItemPage({
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

  const [{ data: types }, { data: categories }] = await Promise.all([
    supabase.from('types').select('id, name').neq('name', 'Special/Variable').order('name'),
    supabase.from('item_categories').select('id, name').order('name'),
  ])

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-24">
      <div className="w-full max-w-sm">
        <Link href={`/campaigns/${id}/custom/items`} className="text-sm underline">
          ← Custom Items
        </Link>
      </div>

      <h1 className="text-2xl font-bold">New custom item</h1>

      {error && <p className="w-full max-w-sm text-danger">{error}</p>}

      <form action={createCustomItem.bind(null, id)} className="flex w-full max-w-sm flex-col gap-3">
        <ItemFields types={types ?? []} categories={categories ?? []} />
        <button type="submit" className="mt-2 rounded bg-accent px-4 py-2 text-accent-foreground">
          Create item
        </button>
      </form>
    </main>
  )
}
