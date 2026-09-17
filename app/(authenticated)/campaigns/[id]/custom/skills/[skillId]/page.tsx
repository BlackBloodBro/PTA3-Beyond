import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ConfirmButton } from '@/components/ConfirmButton'
import { updateCustomSkill, deleteCustomSkill } from '../actions'
import { SkillFields } from '../SkillFields'

export default async function EditCustomSkillPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; skillId: string }>
  searchParams: Promise<{ error?: string; saved?: string }>
}) {
  const { id, skillId: skillIdRaw } = await params
  const { error, saved } = await searchParams
  const skillId = Number(skillIdRaw)
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

  const [{ data: skill }, { data: stats }] = await Promise.all([
    supabase.from('skills').select('id, name, stat_id').eq('id', skillId).eq('campaign_id', id).maybeSingle(),
    supabase.from('stats').select('id, name').order('id'),
  ])

  if (!skill) {
    redirect(`/campaigns/${id}/custom/skills`)
  }

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-24">
      <div className="w-full max-w-sm">
        <Link href={`/campaigns/${id}/custom/skills`} className="text-sm underline">
          ← Custom Skills
        </Link>
      </div>

      <div className="flex w-full max-w-sm items-center justify-between">
        <h1 className="text-2xl font-bold">{skill.name}</h1>
        <div className="flex items-center gap-2">
          <Link href={`/campaigns/${id}/custom/skills/new?templateId=${skillId}`} className="rounded border px-3 py-2 text-sm">
            Duplicate
          </Link>
          <form action={deleteCustomSkill.bind(null, id, skillId)}>
            <ConfirmButton confirmMessage={`Permanently delete "${skill.name}"? This cannot be undone.`} className="rounded border border-danger px-3 py-2 text-sm text-danger">
              Delete
            </ConfirmButton>
          </form>
        </div>
      </div>

      {error && <p className="w-full max-w-sm text-danger">{error}</p>}
      {saved && <p className="w-full max-w-sm text-success">Saved.</p>}

      <form action={updateCustomSkill.bind(null, id, skillId)} className="flex w-full max-w-sm flex-col gap-3">
        <SkillFields stats={stats ?? []} initial={skill} />
        <button type="submit" className="mt-2 rounded bg-accent px-4 py-2 text-accent-foreground">
          Save changes
        </button>
      </form>
    </main>
  )
}
