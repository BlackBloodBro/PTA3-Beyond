import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadCampaignBreedingCandidates, trainerHasBaseClassFeature } from '@/lib/pta3/breeding'
import { BreedingBoard } from '@/app/(authenticated)/breeding/BreedingBoard'

// [[Feature - Add a Pokemon Breeding Check mechanic]]: the NPC variant of the campaign player
// Trainer's own Breeding page -- same whole-Campaign-roster candidates, initiating as this specific
// NPC (fixed to the URL, not auto-picked), reached only by that NPC's owning GM.
export default async function CampaignNpcBreedingPage({ params }: { params: Promise<{ id: string; trainerId: string }> }) {
  const { id: campaignId, trainerId: id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: trainer } = await supabase
    .from('trainers')
    .select('id, name, user_id, is_npc, campaign_id, campaigns(gm_user_id)')
    .eq('id', id)
    .single()

  if (!trainer) {
    redirect('/dashboard')
  }

  if (!trainer.is_npc || trainer.campaign_id !== campaignId) {
    notFound()
  }

  const isGM = trainer.campaigns?.gm_user_id === user.id
  if (!isGM) {
    redirect(`/campaigns/${campaignId}/npcs/${id}`)
  }

  const [candidates, hasUnexpectedHatch] = await Promise.all([
    loadCampaignBreedingCandidates(supabase, campaignId),
    trainerHasBaseClassFeature(supabase, id, 'Unexpected Hatch'),
  ])

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-24">
      <div className="w-full max-w-2xl">
        <Link href={`/campaigns/${campaignId}/npcs/${id}`} className="text-sm underline">
          ← {trainer.name}
        </Link>
      </div>

      <div className="w-full max-w-2xl">
        <h1 className="text-2xl font-bold">Breeding</h1>
      </div>

      <BreedingBoard
        campaignId={campaignId}
        initiatingTrainerId={id}
        initiatingTrainerName={trainer.name}
        candidates={candidates}
        hasUnexpectedHatch={hasUnexpectedHatch}
      />
    </main>
  )
}
