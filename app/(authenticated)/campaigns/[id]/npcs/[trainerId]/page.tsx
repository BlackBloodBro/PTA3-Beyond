import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { deleteTrainer, restPokemonCenter, restSleep } from '@/app/(authenticated)/trainers/actions'
import { ConfirmButton } from '@/components/ConfirmButton'
import { RollInputButton } from '@/components/RollInputButton'
import { PokemonSprite } from '@/components/PokemonSprite'
import { computePokemonLevel, computeLoyaltyTier } from '@/lib/pta3/pokemonLevel'
import { computeLevelEligibleEvolutionSet } from '@/lib/pta3/evolution'
import { MAX_TEAM_SIZE } from '@/lib/pta3/pokemonTeam'
import { pokemonHref } from '@/lib/pta3/pokemonPaths'
import { isBookmarked } from '@/lib/pta3/bookmarks'
import { BookmarkToggle } from '@/components/BookmarkToggle'
import { NpcLabelsSection } from '@/app/(authenticated)/trainers/[id]/NpcLabelsSection'
import type { LabelColor } from '@/lib/pta3/labelColors'
import { loadTrainerDerived, loadPendingMilestone, loadQualifyingMilestones, computeEffectiveStats, computeMaxHp } from '@/lib/pta3/trainerFeatures'
import { loadTrainerSkillTalents } from '@/lib/pta3/skillTalents'
import {
  TrainerStateProvider,
  TrainerNameHeading,
  PendingMilestoneBanner,
  TrainerInfoSection,
  TrainerHpSection,
  StatsSection,
  SkillsSection,
  ActiveFeaturesSection,
  PassiveFeaturesSection,
  type StatBreakdown,
} from '@/app/(authenticated)/trainers/[id]/TrainerInteractive'

const STAT_FIELDS = ['attack', 'defense', 'special_attack', 'special_defense', 'speed'] as const

// Matches the user's exact boundaries: >50% green, >1/6 and <=50% orange, <=1/6 red.
function hpColorClass(current: number, max: number): string {
  if (max <= 0) return 'text-muted'
  const ratio = current / max
  if (ratio > 0.5) return 'text-success'
  if (ratio > 1 / 6) return 'text-warning'
  return 'text-danger'
}

// Mirrors trainers/[id]/page.tsx almost exactly -- same shared TrainerInteractive components and
// derivation helpers, just under a campaign-scoped path so the sidebar highlights "Campaigns"
// instead of "Trainers" (see [[Give NPCs their own campaign-scoped page]]). Deliberately not
// deduplicated further than this: the two pages differ in params shape, the guard below, the back
// link, and basePath, which isn't enough shared surface to be worth a generic wrapper.
export default async function NpcPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; trainerId: string }>
  searchParams: Promise<{ error?: string; message?: string }>
}) {
  const { id: campaignId, trainerId: id } = await params
  const { error, message } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // No .eq('user_id', ...) filter here -- RLS already scopes this to the trainer's owner OR the
  // GM of the campaign it belongs to (if any), so relying on RLS lets a GM view a player's sheet
  // without needing separate query branches.
  const { data: trainer } = await supabase
    .from('trainers')
    .select(
      `
      id, name, level, current_hp, temporary_hp, user_id, campaign_id, is_npc,
      base_attack, base_defense, base_special_attack, base_special_defense, base_speed,
      class_id, origin_id,
      classes(name),
      origins(name, lifestyle),
      campaigns(id, name, gm_user_id),
      trainer_labels(campaign_labels(id, name, color))
    `,
    )
    .eq('id', id)
    .single()

  if (!trainer) {
    redirect('/dashboard')
  }

  // A non-NPC (or an NPC belonging to a different campaign than the URL claims) doesn't resolve
  // here -- this namespace is exclusively for this campaign's own NPCs.
  if (!trainer.is_npc || trainer.campaign_id !== campaignId) {
    notFound()
  }

  const basePath = `/campaigns/${campaignId}/npcs/${id}`

  const isOwner = trainer.user_id === user.id
  const isGM = trainer.campaigns?.gm_user_id === user.id
  const campaign = trainer.campaign_id && trainer.campaigns ? { id: trainer.campaigns.id, name: trainer.campaigns.name } : null
  const bookmarked = await isBookmarked(supabase, user.id, 'trainer', id)

  // Only fetched when actually needed to render the Labels section below.
  const { data: campaignLabels } =
    isGM && trainer.campaign_id
      ? await supabase.from('campaign_labels').select('id, name, color').eq('campaign_id', trainer.campaign_id).order('name')
      : { data: null }
  const selectedLabelIds = (trainer.trainer_labels ?? [])
    .map((tl) => tl.campaign_labels?.id)
    .filter((v): v is string => Boolean(v))

  // The one query everything derived below is built from -- see lib/pta3/trainerFeatures.ts for why
  // this replaces the old raw-column approach (stats/advanced-classes/max-HP are never stored as a
  // running total, only ever recomputed from this list against the trainer's current level).
  const milestones = await loadQualifyingMilestones(supabase, id, trainer.level)

  const baseStats = {
    attack: trainer.base_attack,
    defense: trainer.base_defense,
    special_attack: trainer.base_special_attack,
    special_defense: trainer.base_special_defense,
    speed: trainer.base_speed,
  }
  const effectiveStats = computeEffectiveStats(baseStats, milestones)
  const maxHp = computeMaxHp(milestones)

  // Shared with updateTrainerInfo so the trainer page and the "no reload" Info edit form derive
  // advanced-class display names and the active/passive Features lists exactly the same way.
  const [{ advancedClasses, activeFeatures, passiveFeatures }, { hasPendingMilestone, nextMilestoneLevel }] = await Promise.all([
    loadTrainerDerived(supabase, id, { classId: trainer.class_id, level: trainer.level }),
    loadPendingMilestone(supabase, { trainerId: id, classId: trainer.class_id, level: trainer.level }),
  ])

  const [{ data: skills }, skillTalents] = await Promise.all([
    supabase.from('skills').select('id, name, stats(name)').order('name'),
    loadTrainerSkillTalents(supabase, id),
  ])

  // Powers the Stats section's tooltip breakdown -- base is now the true point-buy base (base_attack
  // etc. are never mutated after creation), so no reconstruction is needed; increases come straight
  // from the qualifying-milestones list already loaded above.
  const milestoneSubclassIds = [...new Set(milestones.map((m) => m.subclass_id))]
  const { data: milestoneSubclasses } =
    milestoneSubclassIds.length > 0
      ? await supabase.from('subclasses').select('id, name').in('id', milestoneSubclassIds)
      : { data: [] }
  const subclassNameByMilestoneId = new Map((milestoneSubclasses ?? []).map((s) => [s.id, s.name]))

  const increasesByStat: Record<string, { level: number; subclassName: string }[]> = Object.fromEntries(
    STAT_FIELDS.map((f) => [f, []]),
  )
  for (const m of milestones) {
    const subclassName = subclassNameByMilestoneId.get(m.subclass_id) ?? 'Unknown'
    increasesByStat[m.stat_a]?.push({ level: m.level, subclassName })
    increasesByStat[m.stat_b]?.push({ level: m.level, subclassName })
  }
  const statBreakdown = Object.fromEntries(
    STAT_FIELDS.map((f) => [f, { base: baseStats[f as keyof typeof baseStats], increases: increasesByStat[f] }]),
  ) as StatBreakdown

  // Options for the Info section's Edit form -- Class/Background stay freeform GM/owner overrides;
  // Subclasses are no longer settable here (only through resolveMilestone), so no subclass list is
  // fetched for this form anymore.
  const [{ data: classes }, { data: origins }] = await Promise.all([
    supabase.from('classes').select('id, name').order('name'),
    supabase.from('origins').select('id, name, lifestyle').order('name'),
  ])

  const { data: featureUses } = await supabase
    .from('trainer_feature_uses')
    .select('feature_id, uses_remaining')
    .eq('trainer_id', id)

  const usesRemainingByFeature = Object.fromEntries((featureUses ?? []).map((fu) => [fu.feature_id, fu.uses_remaining]))

  // Team only -- an NPC's off-Team Pokemon (party_slot null) live in the PC page instead.
  const [{ data: trainersPokemon }, { data: loyaltyRows }] = await Promise.all([
    supabase
      .from('trainers_pokemon')
      .select(
        `
      obtain_method_id,
      pokemon(
        id, nickname, current_hp, ev_hp, bonus_base_hp, is_shiny, current_exp, loyalty_points, pokedex_id,
        pokedex(name, base_hp, sprite_code, growth_rate_id)
      )
    `,
      )
      .eq('trainer_id', id)
      .not('party_slot', 'is', null)
      .order('party_slot'),
    supabase.from('loyalties').select('name, sort_order, min_points'),
  ])

  // Same derivation as the Pokemon detail page -- level is never stored, so the Team list needs to
  // compute it per Pokemon exactly the same way. Loyalty tier is likewise always derived from LP,
  // never stored, per [[Add a Loyalty editor]].
  const team = await Promise.all(
    (trainersPokemon ?? []).map(async (tp) => {
      // trainers_pokemon.pokemon_id is a primary key, so this reverse embed comes back as a single
      // object at runtime (same quirk documented throughout this codebase), not the array TS infers.
      const p = tp.pokemon as unknown as {
        id: string
        nickname: string | null
        current_hp: number
        ev_hp: number
        bonus_base_hp: number
        is_shiny: boolean
        current_exp: number
        loyalty_points: number
        pokedex_id: number
        pokedex: { name: string; base_hp: number; sprite_code: string; growth_rate_id: number | null }
      }
      const { level } = await computePokemonLevel(supabase, {
        currentExp: p.current_exp,
        isShiny: p.is_shiny,
        loyaltyPoints: p.loyalty_points,
        obtainMethodId: tp.obtain_method_id,
        growthRateId: p.pokedex!.growth_rate_id,
      })
      const loyaltyName = computeLoyaltyTier(p.loyalty_points, loyaltyRows ?? [])?.name ?? null
      return { ...p, level, loyaltyName, maxHp: p.pokedex!.base_hp + p.bonus_base_hp + p.ev_hp * 6 }
    }),
  )

  // [[Add Evolution functionality]]: gold-highlights a Team card whose level meets a level-based
  // evolution requirement, same "load once, check in memory" shape as the PC board and global
  // Pokemon list use.
  const evolutionEligibleIds = await computeLevelEligibleEvolutionSet(
    supabase,
    team.map((p) => ({ pokemonId: p.id, pokedexId: p.pokedex_id, level: p.level })),
  )

  const { data: trainerMoves } = await supabase
    .from('trainer_moves')
    .select('uses_remaining, resets_on, moves(name)')
    .eq('trainer_id', id)

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-24">
      <div className="w-full max-w-6xl">
        <Link href={`/campaigns/${campaignId}/npcs`} className="text-sm underline">
          ← NPCs
        </Link>
      </div>

      {error && <p className="w-full max-w-6xl text-danger">{error}</p>}
      {message && <p className="w-full max-w-6xl text-success">{message}</p>}

      <TrainerStateProvider
        trainerId={id}
        basePath={basePath}
        isOwner={isOwner}
        isGM={isGM}
        initialName={trainer.name}
        initialLevel={trainer.level}
        initialCurrentHp={trainer.current_hp}
        initialTemporaryHp={trainer.temporary_hp}
        initialMaxHp={maxHp}
        initialStats={effectiveStats}
        initialBaseStats={baseStats}
        initialAdvancedClasses={advancedClasses}
        initialActiveFeatures={activeFeatures}
        initialPassiveFeatures={passiveFeatures}
        initialUsesRemainingByFeature={usesRemainingByFeature}
        initialClassId={trainer.class_id}
        initialClassName={trainer.classes?.name ?? ''}
        initialOriginId={trainer.origin_id}
        initialOriginName={trainer.origins?.name ?? ''}
        initialLifestyle={trainer.origins?.lifestyle ?? null}
        initialHasPendingMilestone={hasPendingMilestone}
        initialNextMilestoneLevel={nextMilestoneLevel}
      >
      <PendingMilestoneBanner />

      <div className="flex w-full max-w-6xl items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <TrainerNameHeading />
          {!isOwner && <span className="text-sm font-normal text-muted">(GM view)</span>}
          <BookmarkToggle entityType="trainer" entityId={id} initialBookmarked={bookmarked} />
        </h1>
        <div className="flex gap-2">
          <Link href={`${basePath}/pc`} className="rounded border px-4 py-2 text-sm">
            PC
          </Link>
          <Link href={`${basePath}/bag`} className="rounded border px-4 py-2 text-sm">
            Inventory
          </Link>
          {isOwner && (
            <form action={deleteTrainer.bind(null, id)}>
              <ConfirmButton
                confirmMessage={`Permanently delete ${trainer.name}? This cannot be undone.`}
                className="rounded border border-danger px-4 py-2 text-sm text-danger"
              >
                Delete
              </ConfirmButton>
            </form>
          )}
        </div>
      </div>

      {isGM && (
        <NpcLabelsSection
          trainerId={id}
          campaignId={campaignId}
          initialLabels={(campaignLabels ?? []).map((l) => ({ id: l.id, name: l.name, color: l.color as LabelColor }))}
          initialSelectedLabelIds={selectedLabelIds}
        />
      )}

      <div className="flex w-full max-w-6xl items-start gap-4">
        <aside className="flex w-64 shrink-0 flex-col gap-4">
          <TrainerInfoSection trainerId={id} campaign={campaign} classes={classes ?? []} origins={origins ?? []} />

          <TrainerHpSection trainerId={id} />

          <section className="rounded border border-accent bg-accent/10 p-4">
            <h2 className="mb-2 font-semibold">Rest</h2>
            <div className="flex flex-wrap gap-2">
              <form action={restSleep.bind(null, id)}>
                <RollInputButton
                  promptMessage="Roll a d6 and enter the result (1-6). You heal that much HP, each Pokémon heals 1/6 of its max HP, and rest-based features recharge."
                  min={1}
                  max={6}
                  fieldName="roll"
                  formAction={restSleep.bind(null, id)}
                  className="rounded border px-4 py-2 text-sm"
                >
                  Sleep
                </RollInputButton>
              </form>
              <form action={restPokemonCenter.bind(null, id)}>
                <ConfirmButton
                  confirmMessage="Visit the Pokémon Center? This instantly heals all your Pokémon's HP (not move uses, not your own HP)."
                  className="rounded border px-4 py-2 text-sm"
                >
                  Pokémon Center
                </ConfirmButton>
              </form>
            </div>
            <p className="mt-2 text-xs text-muted">
              Sleep: trainer heals 1d6 and rest-based features recharge; each Pokémon heals 1/6 of its
              max HP. Pokémon Center: instantly fully heals all Pokémon HP only (not move uses, not
              the trainer).
            </p>
          </section>
        </aside>

        <div className="flex flex-1 flex-col gap-4">
        <StatsSection breakdown={statBreakdown} />

        <SkillsSection
          skills={(skills ?? []) as unknown as { id: number; name: string; stats: { name: string } | null }[]}
          talents={Object.fromEntries(skillTalents)}
        />

        <ActiveFeaturesSection trainerId={id} />

        <PassiveFeaturesSection />

        <section className="rounded border border-accent bg-accent/10 p-4">
          <h2 className="mb-2 font-semibold">Trainer Moves</h2>
          {(trainerMoves ?? []).length === 0 ? (
            <p className="text-sm text-muted">None yet.</p>
          ) : (
            <ul className="list-disc pl-5">
              {(trainerMoves ?? []).map((tm, i) => (
                <li key={i}>{tm.moves!.name}</li>
              ))}
            </ul>
          )}
        </section>
        </div>

        <aside className="w-64 shrink-0">
          <section className="rounded border border-accent bg-accent/10 p-4">
            <h2 className="mb-2 font-semibold">
              Team ({team.length}/{MAX_TEAM_SIZE})
            </h2>
            {team.length === 0 ? (
              <p className="text-sm text-muted">No Pokémon yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {team.map((p, i) => (
                  <li
                    key={i}
                    className={`flex items-center gap-2 rounded p-2 ${evolutionEligibleIds.has(p.id) ? 'border-2 border-warning bg-warning/10' : 'border'}`}
                  >
                    <PokemonSprite spriteCode={p.pokedex!.sprite_code} shiny={p.is_shiny} alt={p.pokedex!.name} size={40} />
                    <div className="min-w-0 flex-1 text-sm">
                      <Link href={pokemonHref({ id: p.id, hasOwner: true, campaignId })} className="block truncate font-medium underline">
                        {p.nickname ? `${p.nickname} (${p.pokedex!.name})` : p.pokedex!.name}
                      </Link>
                      <p className="text-xs text-muted">
                        Level {p.level} · Loyalty: {p.loyaltyName ?? '—'}
                      </p>
                      <p className={`font-semibold ${hpColorClass(p.current_hp, p.maxHp)}`}>
                        {p.current_hp} / {p.maxHp} HP
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
      </TrainerStateProvider>
    </main>
  )
}
