import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  loadQualifyingMilestones,
  loadTrainerDerived,
  loadPendingMilestone,
  loadClassBuilderData,
  computeEffectiveStats,
  computeMaxHp,
} from '@/lib/pta3/trainerFeatures'
import { loadTrainerSkillTalents, loadTrainerBaseSkillTalents, loadCreationSkillTalentOptions } from '@/lib/pta3/skillTalents'
import { loadClassFavoredStats } from '@/lib/pta3/classFavoredStats'
import { TrainerStateProvider, type StatBreakdown } from '@/app/(authenticated)/trainers/[id]/TrainerInteractive'
import { ClassBuilder } from '@/app/(authenticated)/trainers/[id]/build/ClassBuilder'

const STAT_FIELDS = ['attack', 'defense', 'special_attack', 'special_defense', 'speed'] as const

// NPC's Class Builder -- mirrors trainers/[id]/build/page.tsx. No "Continue to starter Pokémon" link
// here at all -- NPCs never go through that flow, same as createNpc's own redirect already skips it
// (a player-only ceremony an NPC doesn't need).
export default async function NpcBuildPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; trainerId: string }>
  searchParams: Promise<{ level?: string }>
}) {
  const { id: campaignId, trainerId: id } = await params
  const { level: levelParam } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: trainer } = await supabase
    .from('trainers')
    .select(
      `
      id, name, level, current_hp, temporary_hp, user_id, campaign_id, is_npc,
      base_attack, base_defense, base_special_attack, base_special_defense, base_speed,
      class_id, origin_id,
      classes(name),
      origins(name, lifestyle),
      campaigns(id, name, gm_user_id)
    `,
    )
    .eq('id', id)
    .single()

  if (!trainer) {
    redirect('/dashboard')
  }

  if (!trainer.is_npc || trainer.campaign_id !== campaignId) {
    notFound()
  }

  const isOwner = trainer.user_id === user.id
  const isGM = trainer.campaigns?.gm_user_id === user.id

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

  const [
    { advancedClasses, activeFeatures, passiveFeatures },
    { hasPendingMilestone, nextMilestoneLevel },
    { data: skills },
    { data: classes },
    { data: origins },
    skillTalents,
    baseSkillTalents,
    { classOptions: classTalentOptions, originGroups: originTalentGroups },
    classFavoredStats,
    builderData,
  ] = await Promise.all([
    loadTrainerDerived(supabase, id, { classId: trainer.class_id, level: trainer.level }),
    loadPendingMilestone(supabase, { trainerId: id, classId: trainer.class_id, level: trainer.level }),
    supabase.from('skills').select('id, name, stats(name)').order('name'),
    // [[Class can't be edited when editing subclass or level]]: lets the Class Builder page offer a
    // Class control too, not just Info's -- same picker, same option list.
    supabase.from('classes').select('id, name').order('name'),
    // [[Improvement - Move Trainer editing (Name, Origin, Talents, Stats) to the build page]]: the
    // full Origins list, for the new Origin picker relocated here from the old Info card.
    supabase.from('origins').select('id, name, lifestyle').order('name'),
    loadTrainerSkillTalents(supabase, id),
    loadTrainerBaseSkillTalents(supabase, id),
    loadCreationSkillTalentOptions(supabase),
    loadClassFavoredStats(supabase),
    loadClassBuilderData(supabase, id, {
      classId: trainer.class_id,
      originId: trainer.origin_id,
      originName: trainer.origins?.name ?? null,
      level: trainer.level,
    }),
  ])

  const { data: featureUses } = await supabase.from('trainer_feature_uses').select('feature_id, uses_remaining').eq('trainer_id', id)
  const usesRemainingByFeature = Object.fromEntries((featureUses ?? []).map((fu) => [fu.feature_id, fu.uses_remaining]))

  const milestoneSubclassIds = [...new Set(milestones.map((m) => m.subclass_id))]
  const { data: milestoneSubclasses } =
    milestoneSubclassIds.length > 0 ? await supabase.from('subclasses').select('id, name').in('id', milestoneSubclassIds) : { data: [] }
  const subclassNameByMilestoneId = new Map((milestoneSubclasses ?? []).map((s) => [s.id, s.name]))
  const increasesByStat: Record<string, { level: number; subclassName: string }[]> = Object.fromEntries(STAT_FIELDS.map((f) => [f, []]))
  for (const m of milestones) {
    const subclassName = subclassNameByMilestoneId.get(m.subclass_id) ?? 'Unknown'
    increasesByStat[m.stat_a]?.push({ level: m.level, subclassName })
    increasesByStat[m.stat_b]?.push({ level: m.level, subclassName })
  }
  const statBreakdown = Object.fromEntries(
    STAT_FIELDS.map((f) => [f, { base: baseStats[f as keyof typeof baseStats], increases: increasesByStat[f] }]),
  ) as StatBreakdown

  const basePath = `/campaigns/${campaignId}/npcs/${id}`

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-24">
      <div className="w-full max-w-3xl">
        <Link href={basePath} className="text-sm underline">
          ← {trainer.name}
        </Link>
      </div>

      <div className="w-full max-w-3xl">
        <h1 className="text-2xl font-bold">{trainer.name}'s Class Builder</h1>
      </div>

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
        <ClassBuilder
          trainerId={id}
          classes={classes ?? []}
          origins={origins ?? []}
          canEditName={isOwner || isGM}
          canEditGmTier={isGM}
          classTalentOptions={classTalentOptions}
          originTalentGroups={originTalentGroups}
          initialBaseClassSkillIds={baseSkillTalents.classSkillIds}
          initialBaseOriginSkillIds={baseSkillTalents.originSkillIds}
          initialCards={builderData.cards}
          initialHigherLevelPreview={builderData.higherLevelPreview}
          statBreakdown={statBreakdown}
          skills={(skills ?? []) as unknown as { id: number; name: string; stats: { name: string } | null }[]}
          initialTalents={Object.fromEntries(skillTalents)}
          favoredStatNames={classFavoredStats[trainer.class_id] ?? []}
          originFeatures={builderData.originFeatures}
          focusLevel={levelParam ? Number(levelParam) : undefined}
        />
      </TrainerStateProvider>
    </main>
  )
}
