import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ConfirmButton } from '@/components/ConfirmButton'
import { updateCustomType, deleteCustomType, loadOtherVisibleTypes, loadTypeMatchupState } from '../actions'
import { TypeFields, type TypeFieldsInitial } from '../TypeFields'

export default async function EditCustomTypePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; typeId: string }>
  searchParams: Promise<{ error?: string; saved?: string }>
}) {
  const { id, typeId: typeIdRaw } = await params
  const { error, saved } = await searchParams
  const typeId = Number(typeIdRaw)
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

  const { data: type } = await supabase.from('types').select('id, name').eq('id', typeId).eq('campaign_id', id).maybeSingle()

  if (!type) {
    redirect(`/campaigns/${id}/custom/types`)
  }

  const otherTypes = await loadOtherVisibleTypes(supabase, typeId)
  const { selfChoice, matchupsByOtherTypeId } = await loadTypeMatchupState(supabase, typeId, otherTypes.map((t) => t.id))

  const initial: TypeFieldsInitial = { name: type.name, selfChoice, matchupsByOtherTypeId }

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-24">
      <div className="w-full max-w-sm">
        <Link href={`/campaigns/${id}/custom/types`} className="text-sm underline">
          ← Custom Types
        </Link>
      </div>

      <div className="flex w-full max-w-sm items-center justify-between">
        <h1 className="text-2xl font-bold">{type.name}</h1>
        <div className="flex items-center gap-2">
          <Link href={`/campaigns/${id}/custom/types/new?templateId=${typeId}`} className="rounded border px-3 py-2 text-sm">
            Duplicate
          </Link>
          <form action={deleteCustomType.bind(null, id, typeId)}>
            <ConfirmButton confirmMessage={`Permanently delete "${type.name}"? This cannot be undone.`} className="rounded border border-danger px-3 py-2 text-sm text-danger">
              Delete
            </ConfirmButton>
          </form>
        </div>
      </div>

      {error && <p className="w-full max-w-sm text-danger">{error}</p>}
      {saved && <p className="w-full max-w-sm text-success">Saved.</p>}

      <form action={updateCustomType.bind(null, id, typeId)} className="flex w-full max-w-sm flex-col gap-3">
        <TypeFields otherTypes={otherTypes} initial={initial} />
        <button type="submit" className="mt-2 rounded bg-accent px-4 py-2 text-accent-foreground">
          Save changes
        </button>
      </form>
    </main>
  )
}
