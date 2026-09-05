import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { TrainerListBoard, type TrainerListRow } from './TrainerListBoard'

export default async function TrainersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const [{ data: gmCampaigns }, { data: memberships }, { data: myTrainers }, { data: assignedPokemonRaw }] = await Promise.all([
    supabase.from('campaigns').select('id, name').eq('gm_user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('campaign_members').select('campaigns(id, name)').eq('user_id', user.id).order('joined_at', { ascending: false }),
    // Yours only -- every row here has a Delete/campaign-assignment control, so this needs to
    // actually mean "my trainers," not the broader set RLS alone would return. The campaign page
    // is still where the full party roster lives.
    // [[Improvement - Inconsistency with Trainers vs Pokemon]]: used to also filter out is_npc
    // rows entirely (an NPC only ever showed up under its Campaign's own NPC page), while an NPC's
    // Pokemon had no equivalent exclusion from the Pokemon list -- a real asymmetry. Now includes
    // NPCs too, rendered in their own section by TrainerListBoard.
    supabase
      .from('trainers')
      .select('id, name, level, classes(name), origins(name), campaign_id, campaigns(name), is_npc')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    // Just for the per-trainer Pokemon count shown in the delete confirmation.
    supabase.from('trainers_pokemon').select('trainer_id, trainers!inner(user_id)').eq('trainers.user_id', user.id),
  ])

  const memberCampaigns = (memberships ?? [])
    .map((m) => m.campaigns)
    .filter((c): c is { id: string; name: string } => c !== null)

  // Matches createTrainer's own rule -- a trainer can be assigned to any campaign its owner GMs or
  // is a joined member of.
  const assignableCampaignsForTrainer = [...(gmCampaigns ?? []), ...memberCampaigns]

  const pokemonCountByTrainer = new Map<string, number>()
  for (const tp of assignedPokemonRaw ?? []) {
    pokemonCountByTrainer.set(tp.trainer_id, (pokemonCountByTrainer.get(tp.trainer_id) ?? 0) + 1)
  }

  const trainerRows: TrainerListRow[] = (myTrainers ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    level: t.level,
    className: t.classes?.name ?? null,
    originName: t.origins?.name ?? null,
    campaignId: t.campaign_id,
    campaignName: t.campaigns?.name ?? null,
    pokemonCount: pokemonCountByTrainer.get(t.id) ?? 0,
    isNpc: t.is_npc,
  }))

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-24">
      <div className="w-full max-w-2xl">
        <Link href="/dashboard" className="text-sm underline">
          ← Dashboard
        </Link>
      </div>

      <div className="flex w-full max-w-2xl items-center justify-between">
        <h1 className="text-2xl font-bold">Trainers</h1>
        <Link href="/trainers/new" className="rounded bg-accent px-4 py-2 text-sm text-accent-foreground">
          + New trainer
        </Link>
      </div>

      {error && <p className="w-full max-w-2xl text-danger">{error}</p>}

      <TrainerListBoard trainers={trainerRows} assignableCampaigns={assignableCampaignsForTrainer as unknown as { id: string; name: string }[]} />
    </main>
  )
}
