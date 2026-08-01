import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TrainerForm } from './TrainerForm'

export default async function NewTrainerPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; campaignId?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const [{ data: classes }, { data: origins }, { data: gmCampaigns }, { data: memberships }] = await Promise.all([
    supabase.from('classes').select('id, name').order('name'),
    supabase.from('origins').select('id, name, lifestyle').order('name'),
    supabase.from('campaigns').select('id, name').eq('gm_user_id', user.id),
    supabase.from('campaign_members').select('campaigns(id, name)').eq('user_id', user.id),
  ])

  const campaigns = [
    ...(gmCampaigns ?? []),
    ...(memberships ?? [])
      .map((m) => m.campaigns)
      .filter((c): c is { id: string; name: string } => c !== null),
  ]

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-24">
      <h1 className="text-2xl font-bold">Create a Trainer</h1>
      {params.error && <p className="text-danger">{params.error}</p>}
      <TrainerForm classes={classes ?? []} origins={origins ?? []} campaigns={campaigns} defaultCampaignId={params.campaignId} />
    </main>
  )
}
