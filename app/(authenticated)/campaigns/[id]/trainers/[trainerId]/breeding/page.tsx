import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadCampaignBreedingCandidates, trainerHasBaseClassFeature } from '@/lib/pta3/breeding'
import { BreedingBoard } from '@/app/(authenticated)/breeding/BreedingBoard'

// [[Feature - Add a Pokemon Breeding Check mechanic]]: reached from this Trainer's own page (not a
// Campaign-wide page -- moved here per the user, 2026-09-03) -- the initiating Trainer is fixed to
// this URL's own `[trainerId]`, not auto-picked, so a GM looking at one specific player's sheet
// (or the player themselves) always attempts as that exact Trainer. Candidates are still the whole
// Campaign's roster, same as before.
export default async function CampaignTrainerBreedingPage({ params }: { params: Promise<{ id: string; trainerId: string }> }) {
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

  if (trainer.is_npc || trainer.campaign_id !== campaignId) {
    notFound()
  }

  const isOwner = trainer.user_id === user.id
  const isGM = trainer.campaigns?.gm_user_id === user.id
  if (!isOwner && !isGM) {
    redirect(`/campaigns/${campaignId}/trainers/${id}`)
  }

  const [candidates, hasUnexpectedHatch, hasEggFinder] = await Promise.all([
    loadCampaignBreedingCandidates(supabase, campaignId),
    trainerHasBaseClassFeature(supabase, id, 'Unexpected Hatch'),
    trainerHasBaseClassFeature(supabase, id, 'Egg Finder'),
  ])

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-24">
      <div className="w-full max-w-2xl">
        <Link href={`/campaigns/${campaignId}/trainers/${id}`} className="text-sm underline">
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
        hasEggFinder={hasEggFinder}
      />
    </main>
  )
}
