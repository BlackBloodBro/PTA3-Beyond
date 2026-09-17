import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ConfirmButton } from '@/components/ConfirmButton'
import { updateCustomMove, deleteCustomMove } from '../actions'
import { MoveFields } from '../MoveFields'

export default async function EditCustomMovePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; moveId: string }>
  searchParams: Promise<{ error?: string; saved?: string }>
}) {
  const { id, moveId: moveIdRaw } = await params
  const { error, saved } = await searchParams
  const moveId = Number(moveIdRaw)
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

  const { data: move } = await supabase
    .from('moves')
    .select('id, name, type_id, damage_stat, range, frequency, damage_dice, description')
    .eq('id', moveId)
    .eq('campaign_id', id)
    .maybeSingle()

  if (!move) {
    redirect(`/campaigns/${id}/custom/moves`)
  }

  const [{ data: types }, { data: proficiencies }, { data: proficiencyRows }] = await Promise.all([
    supabase.from('types').select('id, name').neq('name', 'Special/Variable').order('name'),
    supabase.from('proficiencies').select('id, name').order('name'),
    supabase.from('moves_proficiencies').select('proficiency_id').eq('move_id', moveId),
  ])

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-24">
      <div className="w-full max-w-sm">
        <Link href={`/campaigns/${id}/custom/moves`} className="text-sm underline">
          ← Custom Moves
        </Link>
      </div>

      <div className="flex w-full max-w-sm items-center justify-between">
        <h1 className="text-2xl font-bold">{move.name}</h1>
        <div className="flex items-center gap-2">
          <Link href={`/campaigns/${id}/custom/moves/new?templateId=${moveId}`} className="rounded border px-3 py-2 text-sm">
            Duplicate
          </Link>
          <form action={deleteCustomMove.bind(null, id, moveId)}>
            <ConfirmButton confirmMessage={`Permanently delete "${move.name}"? This cannot be undone.`} className="rounded border border-danger px-3 py-2 text-sm text-danger">
              Delete
            </ConfirmButton>
          </form>
        </div>
      </div>

      {error && <p className="w-full max-w-sm text-danger">{error}</p>}
      {saved && <p className="w-full max-w-sm text-success">Saved.</p>}

      <form action={updateCustomMove.bind(null, id, moveId)} className="flex w-full max-w-sm flex-col gap-3">
        <MoveFields
          types={types ?? []}
          proficiencies={proficiencies ?? []}
          initial={{
            ...move,
            proficiencyIds: (proficiencyRows ?? []).map((r) => r.proficiency_id),
          }}
        />
        <button type="submit" className="mt-2 rounded bg-accent px-4 py-2 text-accent-foreground">
          Save changes
        </button>
      </form>
    </main>
  )
}
