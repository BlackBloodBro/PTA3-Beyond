import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { deleteTrainer } from '@/app/(authenticated)/trainers/actions'
import { ConfirmButton } from '@/components/ConfirmButton'
import { trainerHref } from '@/lib/pta3/trainerPaths'
import { TrainerCampaignControl } from './TrainerCampaignControl'

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
    // is still where the full party roster lives. is_npc = false keeps any trainer you've
    // converted into an NPC out of here too -- once converted it's managed from that campaign's
    // own NPC page instead, same reasoning as excluding NPCs from the campaign page's Players list.
    supabase
      .from('trainers')
      .select('id, name, level, classes(name), origins(name), campaign_id, campaigns(name)')
      .eq('user_id', user.id)
      .eq('is_npc', false)
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

      <div className="flex w-full max-w-2xl flex-col gap-4">
        {(myTrainers ?? []).length === 0 ? (
          <p className="text-sm text-muted">You don&apos;t have any trainers yet.</p>
        ) : (
          (myTrainers ?? []).map((t) => {
            const pokemonCount = pokemonCountByTrainer.get(t.id) ?? 0
            return (
              <div key={t.id} className="rounded border-accent bg-accent/10 p-4">
                <div className="flex items-center justify-between gap-2">
                  <Link href={trainerHref({ id: t.id, is_npc: false, campaign_id: t.campaign_id })} className="text-lg font-semibold underline">
                    {t.name}
                  </Link>
                  <form action={deleteTrainer.bind(null, t.id)}>
                    <ConfirmButton
                      confirmMessage={`Permanently delete ${t.name}? This cannot be undone.${
                        pokemonCount > 0
                          ? ` Their ${pokemonCount} Pokémon will become unassigned, not deleted.`
                          : ''
                      }`}
                      className="rounded border border-danger px-3 py-1 text-sm text-danger"
                    >
                      Delete
                    </ConfirmButton>
                  </form>
                </div>
                <p className="text-sm text-muted">
                  Level {t.level} {t.classes?.name} — {t.origins?.name}
                </p>
                <TrainerCampaignControl
                  trainerId={t.id}
                  initialCampaignId={t.campaign_id}
                  initialCampaignName={t.campaigns?.name ?? null}
                  assignableCampaigns={assignableCampaignsForTrainer as unknown as { id: string; name: string }[]}
                />
              </div>
            )
          })
        )}
      </div>
    </main>
  )
}
