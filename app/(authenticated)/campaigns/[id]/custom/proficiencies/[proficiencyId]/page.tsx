import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ConfirmButton } from '@/components/ConfirmButton'
import { updateCustomProficiency, deleteCustomProficiency } from '../actions'
import { ProficiencyFields } from '../ProficiencyFields'

export default async function EditCustomProficiencyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; proficiencyId: string }>
  searchParams: Promise<{ error?: string; saved?: string }>
}) {
  const { id, proficiencyId: proficiencyIdRaw } = await params
  const { error, saved } = await searchParams
  const proficiencyId = Number(proficiencyIdRaw)
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

  const { data: proficiency } = await supabase
    .from('proficiencies')
    .select('id, name, description')
    .eq('id', proficiencyId)
    .eq('campaign_id', id)
    .maybeSingle()

  if (!proficiency) {
    redirect(`/campaigns/${id}/custom/proficiencies`)
  }

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-24">
      <div className="w-full max-w-sm">
        <Link href={`/campaigns/${id}/custom/proficiencies`} className="text-sm underline">
          ← Custom Proficiencies
        </Link>
      </div>

      <div className="flex w-full max-w-sm items-center justify-between">
        <h1 className="text-2xl font-bold">{proficiency.name}</h1>
        <div className="flex items-center gap-2">
          <Link href={`/campaigns/${id}/custom/proficiencies/new?templateId=${proficiencyId}`} className="rounded border px-3 py-2 text-sm">
            Duplicate
          </Link>
          <form action={deleteCustomProficiency.bind(null, id, proficiencyId)}>
            <ConfirmButton
              confirmMessage={`Permanently delete "${proficiency.name}"? Any of your custom species/Moves requiring it will lose that requirement. This cannot be undone.`}
              className="rounded border border-danger px-3 py-2 text-sm text-danger"
            >
              Delete
            </ConfirmButton>
          </form>
        </div>
      </div>

      {error && <p className="w-full max-w-sm text-danger">{error}</p>}
      {saved && <p className="w-full max-w-sm text-success">Saved.</p>}

      <form action={updateCustomProficiency.bind(null, id, proficiencyId)} className="flex w-full max-w-sm flex-col gap-3">
        <ProficiencyFields initial={proficiency} />
        <button type="submit" className="mt-2 rounded bg-accent px-4 py-2 text-accent-foreground">
          Save changes
        </button>
      </form>
    </main>
  )
}
