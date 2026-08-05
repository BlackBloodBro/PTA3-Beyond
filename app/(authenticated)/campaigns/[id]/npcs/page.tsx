import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { convertTrainerToNpc } from '@/app/(authenticated)/campaigns/[id]/actions'
import { ConfirmButton } from '@/components/ConfirmButton'
import { type LabelColor } from '@/lib/pta3/labelColors'
import { NpcList, type Npc } from './NpcList'

export default async function CampaignNpcsPage({
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

  const { data: allLabels } = await supabase
    .from('campaign_labels')
    .select('id, name, color')
    .eq('campaign_id', id)
    .order('name')

  // Candidates for "convert an existing trainer" below -- the GM's own regular trainers (not
  // already an NPC anywhere), regardless of which campaign (if any) they're currently in.
  const { data: convertibleTrainers } = await supabase
    .from('trainers')
    .select('id, name')
    .eq('user_id', user.id)
    .eq('is_npc', false)
    .order('name')

  // Search/label filtering happens live, client-side, in NpcList -- fetch the full NPC roster here.
  const { data: npcs } = await supabase
    .from('trainers')
    .select('id, name, level, classes(name), trainer_labels(campaign_labels(id, name, color))')
    .eq('campaign_id', id)
    .eq('is_npc', true)
    .order('name')

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-24">
      <div className="w-full max-w-2xl">
        <Link href={`/campaigns/${id}`} className="text-sm underline">
          ← {campaign.name}
        </Link>
      </div>

      <div className="flex w-full max-w-2xl items-center justify-between">
        <h1 className="text-2xl font-bold">NPCs</h1>
        <Link href={`/campaigns/${id}/npcs/new`} className="rounded bg-accent px-4 py-2 text-sm text-accent-foreground">
          + New NPC
        </Link>
      </div>

      {error && <p className="w-full max-w-2xl text-danger">{error}</p>}

      {(convertibleTrainers ?? []).length > 0 && (
        <form
          action={convertTrainerToNpc.bind(null, id)}
          className="flex w-full max-w-2xl flex-wrap items-center gap-2 rounded border-accent bg-accent/10 p-3 text-sm"
        >
          <label htmlFor="trainerId" className="font-medium">
            Turn an existing trainer into an NPC here
          </label>
          <select id="trainerId" name="trainerId" required defaultValue="" className="bg-surface-subtle rounded border p-2">
            <option value="" disabled>
              Choose a trainer...
            </option>
            {(convertibleTrainers ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <ConfirmButton
            confirmMessage="Convert this trainer into an NPC here? It will move into this campaign and become GM-only -- hidden from fellow players, and off the global Trainers list."
            className="rounded border px-3 py-2"
          >
            Convert
          </ConfirmButton>
        </form>
      )}

      <NpcList
        campaignId={id}
        initialNpcs={(npcs ?? []) as unknown as Npc[]}
        initialLabels={(allLabels ?? []).map((l) => ({ id: l.id, name: l.name, color: l.color as LabelColor }))}
      />
    </main>
  )
}
