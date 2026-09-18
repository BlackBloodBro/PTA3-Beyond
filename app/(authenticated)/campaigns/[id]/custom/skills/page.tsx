import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function CampaignSkillsPage({
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

  const { data: skillsRaw } = await supabase.from('skills').select('id, name, stats(name)').eq('campaign_id', id).order('name')

  const skills = (skillsRaw ?? []) as unknown as { id: number; name: string; stats: { name: string } | null }[]

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-24">
      <div className="w-full max-w-2xl">
        <Link href={`/campaigns/${id}/custom`} className="text-sm underline">
          ← Customization
        </Link>
      </div>

      <div className="flex w-full max-w-2xl items-center justify-between">
        <h1 className="text-2xl font-bold">Custom Skills</h1>
        <Link href={`/campaigns/${id}/custom/skills/new`} className="rounded bg-accent px-4 py-2 text-sm text-accent-foreground">
          + New skill
        </Link>
      </div>

      <p className="w-full max-w-2xl text-sm text-muted">
        Homebrew Trainer skills for this Campaign only, alongside the global catalog -- your Trainers can pick these as Skill Talents.
      </p>

      {error && <p className="w-full max-w-2xl text-danger">{error}</p>}

      {skills.length === 0 ? (
        <p className="w-full max-w-2xl text-sm text-muted">No custom skills yet.</p>
      ) : (
        <ul className="flex w-full max-w-2xl flex-col gap-2">
          {skills.map((s) => (
            <li key={s.id}>
              <Link href={`/campaigns/${id}/custom/skills/${s.id}`} className="block rounded border-accent bg-accent/10 p-3 hover:bg-accent/20">
                <span className="font-semibold underline">{s.name}</span>
                {s.stats && <span className="ml-2 text-sm text-muted">{s.stats.name}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
