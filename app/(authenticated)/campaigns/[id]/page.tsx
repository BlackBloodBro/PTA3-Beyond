import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { deleteCampaign, leaveCampaign, removePlayer } from '@/app/(authenticated)/campaigns/actions'
import { ConfirmButton } from '@/components/ConfirmButton'
import { loadQualifyingMilestones, computeMaxHp } from '@/lib/pta3/trainerFeatures'
import { trainerHref } from '@/lib/pta3/trainerPaths'
import { pokemonHref } from '@/lib/pta3/pokemonPaths'
import { isBookmarked } from '@/lib/pta3/bookmarks'
import { BookmarkToggle } from '@/components/BookmarkToggle'
import { CampaignInfoSection } from './CampaignInfoSection'
import { SellPricePercentSection } from './SellPricePercentSection'

export default async function CampaignPage({
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

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, name, description, invite_code, gm_user_id, sell_price_percent')
    .eq('id', id)
    .single()

  if (!campaign) {
    redirect('/dashboard')
  }

  const isGM = campaign.gm_user_id === user.id

  const bookmarked = await isBookmarked(supabase, user.id, 'campaign', id)

  // No .eq('user_id', ...) filter here -- RLS already returns the right set for each role:
  // the GM sees every trainer in the campaign, a player sees their own trainer plus fellow
  // players' trainers, with the GM's own trainer(s) excluded from that second policy by design.
  // is_npc = false additionally keeps NPCs out of this Players list -- they get their own
  // GM-only section below.
  const { data: trainersRaw } = await supabase
    .from('trainers')
    .select(
      'id, name, level, current_hp, user_id, classes(name), trainers_pokemon(pokemon(id, nickname, current_hp, pokedex(name)))',
    )
    .eq('campaign_id', id)
    .eq('is_npc', false)
    .not('trainers_pokemon.party_slot', 'is', null)

  // Max HP is never stored (see lib/pta3/trainerFeatures.ts) -- recompute it per trainer from their
  // qualifying milestones.
  const trainers = await Promise.all(
    (trainersRaw ?? []).map(async (t) => ({
      ...t,
      maxHp: computeMaxHp(await loadQualifyingMilestones(supabase, t.id, t.level)),
    })),
  )

  // GM-only summary counts for the NPCs / Wild Pokémon sections -- lightweight head-only queries,
  // the actual rows live on their own dedicated (searchable/filterable) pages.
  let npcCount = 0
  let wildPokemonCount = 0
  if (isGM) {
    const [{ count: npcCountRaw }, { data: poolForCount }] = await Promise.all([
      supabase.from('trainers').select('id', { count: 'exact', head: true }).eq('campaign_id', id).eq('is_npc', true),
      supabase.from('pokemon').select('id, trainers_pokemon(trainer_id)').eq('campaign_id', id).eq('created_by_user_id', user.id),
    ])
    npcCount = npcCountRaw ?? 0
    wildPokemonCount = (poolForCount ?? []).filter((p) => !p.trainers_pokemon).length
  }

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-24">
      <div className="flex w-full max-w-2xl items-center justify-between">
        <Link href="/campaigns" className="text-sm underline">
          ← Campaigns
        </Link>
        <BookmarkToggle entityType="campaign" entityId={id} initialBookmarked={bookmarked} />
      </div>

      {error && <p className="w-full max-w-2xl text-danger">{error}</p>}

      <CampaignInfoSection
        campaignId={id}
        isGM={isGM}
        initialName={campaign.name}
        initialDescription={campaign.description}
      />
      {isGM && (
        <div className="flex w-full max-w-2xl flex-col gap-2">
          <p className="text-sm">
            Invite code: <span className="font-mono font-semibold">{campaign.invite_code}</span>
          </p>
          <SellPricePercentSection campaignId={id} initialPercent={campaign.sell_price_percent} />
        </div>
      )}

      {isGM && (
        <div className="flex w-full max-w-2xl gap-3">
          <Link href={`/campaigns/${id}/npcs`} className="flex-1 rounded border-accent bg-accent/10 p-3 hover:bg-accent/20">
            <span className="text-lg font-semibold">{npcCount} NPCs</span>
            <span className="block text-sm text-muted underline">View all</span>
          </Link>
          <Link href={`/campaigns/${id}/wild-pokemon`} className="flex-1 rounded border-accent bg-accent/10 p-3 hover:bg-accent/20">
            <span className="text-lg font-semibold">{wildPokemonCount} Wild Pokémon</span>
            <span className="block text-sm text-muted underline">View all</span>
          </Link>
        </div>
      )}

      <div className="flex w-full max-w-2xl flex-col gap-4">
        <h2 className="text-lg font-semibold">{isGM ? 'Players' : 'Trainers in this Campaign'}</h2>

        {(trainers ?? []).length === 0 ? (
          <p className="text-sm text-muted">
            {isGM
              ? 'No trainers have joined this campaign yet.'
              : "You don't have a trainer in this campaign yet. Create one and assign it here."}
          </p>
        ) : (
          (trainers ?? []).map((t) => {
            const isMine = t.user_id === user.id
            const isGMsTrainer = t.user_id === campaign.gm_user_id

            return (
              <div key={t.id} className="rounded border-accent bg-accent/10 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">
                    <Link href={trainerHref({ id: t.id, is_npc: false, campaign_id: id })} className="underline">
                      {t.name}
                    </Link>
                  </h3>
                  <div className="flex gap-2">
                    {isMine && (
                      <form action={leaveCampaign.bind(null, t.id)}>
                        <ConfirmButton
                          confirmMessage={`Remove ${t.name} from this campaign? They'll keep the trainer, just not assigned here anymore.`}
                          className="rounded border px-3 py-1 text-sm"
                        >
                          Leave campaign
                        </ConfirmButton>
                      </form>
                    )}
                    {isGM && !isGMsTrainer && (
                      <form action={removePlayer.bind(null, id, t.user_id)}>
                        <ConfirmButton
                          confirmMessage={`Remove this player from the campaign? Their trainer(s) will be unassigned from it.`}
                          className="rounded border px-3 py-1 text-sm text-danger"
                        >
                          Remove player
                        </ConfirmButton>
                      </form>
                    )}
                  </div>
                </div>
                <p className="text-sm text-muted">
                  Level {t.level} {t.classes?.name} — {t.current_hp}/{t.maxHp} HP
                </p>
                {t.trainers_pokemon.length > 0 && (
                  <ul className="mt-1 list-disc pl-5 text-sm">
                    {t.trainers_pokemon.map((tp, i) => (
                      <li key={i}>
                        <Link href={pokemonHref({ id: tp.pokemon!.id, hasOwner: true, campaignId: id })} className="underline">
                          {tp.pokemon!.nickname
                            ? `${tp.pokemon!.nickname} (${tp.pokemon!.pokedex!.name})`
                            : tp.pokemon!.pokedex!.name}
                        </Link>{' '}
                        — {tp.pokemon!.current_hp} HP
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })
        )}

        {!isGM && (
          <Link href={`/trainers/new?campaignId=${id}`} className="rounded bg-accent px-4 py-2 text-center text-accent-foreground">
            Create a trainer for this campaign
          </Link>
        )}
      </div>

      {isGM && (
        <form action={deleteCampaign.bind(null, id)}>
          <ConfirmButton
            confirmMessage={`Permanently delete "${campaign.name}"? This cannot be undone.`}
            className="rounded border border-danger px-4 py-2 text-sm text-danger"
          >
            Delete campaign
          </ConfirmButton>
        </form>
      )}
    </main>
  )
}
