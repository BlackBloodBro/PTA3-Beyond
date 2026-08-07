import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TrainerForm } from '@/app/(authenticated)/trainers/new/TrainerForm'
import { loadCreationSkillTalentOptions } from '@/lib/pta3/skillTalents'

export default async function NewNpcPage({
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

  const [{ data: classes }, { data: origins }, skillTalentOptions] = await Promise.all([
    supabase.from('classes').select('id, name').order('name'),
    supabase.from('origins').select('id, name, lifestyle').order('name'),
    loadCreationSkillTalentOptions(supabase),
  ])

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-24">
      <div className="w-full max-w-md">
        <Link href={`/campaigns/${id}/npcs`} className="text-sm underline">
          ← NPCs
        </Link>
      </div>
      <h1 className="text-2xl font-bold">Create an NPC for {campaign.name}</h1>
      {error && <p className="text-danger">{error}</p>}
      <TrainerForm
        variant="npc"
        campaignId={id}
        classes={classes ?? []}
        origins={origins ?? []}
        campaigns={[]}
        classTalentOptions={skillTalentOptions.classOptions}
        originTalentGroups={skillTalentOptions.originGroups}
      />
    </main>
  )
}
