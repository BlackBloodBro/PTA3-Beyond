import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadSharedSnapshot } from '@/lib/pta3/sharedInventory'
import { SharedInventoryBoard, type SharedTrainerOption } from './SharedInventoryBoard'

// [[Feature - Shared currency and inventory]]: the Campaign's shared fund and item pool. Every Campaign member can see it;
// moving things in or out is done "as" one of the viewer's own Trainers (the GM can act as any Trainer in the Campaign,
// NPCs included).
export default async function SharedInventoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // RLS returns null for a Campaign the viewer isn't a member of.
  const { data: campaign } = await supabase.from('campaigns').select('id, name, gm_user_id').eq('id', id).maybeSingle()
  if (!campaign) redirect('/dashboard')
  const isGM = campaign.gm_user_id === user.id

  let trainerQuery = supabase.from('trainers').select('id, name, is_npc, money').eq('campaign_id', id).order('name')
  if (!isGM) trainerQuery = trainerQuery.eq('user_id', user.id).eq('is_npc', false)
  const [{ data: trainerRows }, shared] = await Promise.all([trainerQuery, loadSharedSnapshot(supabase, id)])

  const trainers: SharedTrainerOption[] = (trainerRows ?? []).map((t) => ({ id: t.id, name: t.name, isNpc: t.is_npc, money: t.money }))

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-24">
      <div className="w-full max-w-2xl">
        <Link href={`/campaigns/${id}`} className="text-sm underline">
          ← {campaign.name}
        </Link>
      </div>

      <h1 className="w-full max-w-2xl text-2xl font-bold">Shared inventory</h1>
      <p className="w-full max-w-2xl text-sm text-muted">
        The party&apos;s shared fund and item pool. Anyone in the Campaign can see it, and any Trainer can put things in or take them out
        freely -- no approval needed.
      </p>

      <SharedInventoryBoard campaignId={id} initialShared={shared} trainers={trainers} />
    </main>
  )
}
