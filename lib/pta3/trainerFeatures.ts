import type { createClient } from '@/lib/supabase/server'
import { loadAdvancedClassOptions } from '@/lib/pta3/advancedClassOptions'
import { loadTrainerSkillTalents, type SkillOption } from '@/lib/pta3/skillTalents'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

export type TrainerFeature = {
  id: number
  name: string
  description: string
  level_required: number
  requires_activation: boolean
  max_uses: number | null
  uses_reset_on: string | null
}

export type TrainerAdvancedClass = {
  name: string
  level: number
  // The trainer's overall level this was granted at (trainer_milestones.level) -- distinct from
  // `level` above (this subclass's own relative level) -- used to link to the milestone edit page.
  grantedAtLevel: number
}

export type StatColumn = 'attack' | 'defense' | 'special_attack' | 'special_defense' | 'speed'

export const STAT_COLUMNS: StatColumn[] = ['attack', 'defense', 'special_attack', 'special_defense', 'speed']

export type TrainerMilestoneRow = {
  level: number
  subclass_id: number
  stat_a: StatColumn
  stat_b: StatColumn
  chosen_stat: StatColumn | null
  chosen_type_id: number | null
}

// Flat HP gain applied at a class's milestone levels (see resolveMilestone), per the user's
// explicit correction -- not a 1d4 roll as an earlier migration comment had assumed.
export const MILESTONE_HP_GAIN = 4

// Every trainer starts at a flat 20 max HP (trainers.max_hp's own former DB default, before max HP
// became fully computed rather than stored), rising only in MILESTONE_HP_GAIN steps as milestones
// are resolved -- there's no stat/level formula involved.
export const BASE_MAX_HP = 20

// The single query everything below is built from: every trainer_milestones row this trainer has
// actually "earned" at their CURRENT level. A milestone resolved at level 7 stops counting the
// moment level drops back below 7 (it's just excluded by the .lte filter) and starts counting again
// the moment level rises back to 7+ -- no separate undo/redo bookkeeping needed, since the row itself
// never moves. This is what makes stats/advanced-classes/max-HP "foolproof" against level-down: they
// are never stored as a running total, only ever recomputed from this list.
export async function loadQualifyingMilestones(
  supabase: SupabaseClient,
  trainerId: string,
  level: number,
): Promise<TrainerMilestoneRow[]> {
  const { data } = await supabase
    .from('trainer_milestones')
    .select('level, subclass_id, stat_a, stat_b, chosen_stat, chosen_type_id')
    .eq('trainer_id', trainerId)
    .lte('level', level)
    .order('level')
  return (data ?? []) as TrainerMilestoneRow[]
}

export function computeEffectiveStats(
  base: Record<StatColumn, number>,
  milestones: TrainerMilestoneRow[],
): Record<StatColumn, number> {
  const effective = { ...base }
  for (const m of milestones) {
    effective[m.stat_a] += 1
    effective[m.stat_b] += 1
  }
  return effective
}

export function computeMaxHp(milestones: TrainerMilestoneRow[]): number {
  return BASE_MAX_HP + milestones.length * MILESTONE_HP_GAIN
}

// Shared by the trainer page (initial render) and updateTrainerInfo (recomputing after a Class or
// Level change, either of which can shift which subclass features are unlocked) so the two never
// drift out of sync. Every advanced-class slot levels up on its own track starting at 1 the moment
// it's granted (trainer_milestones records what level it was granted at), so a raw trainer level
// change can shift which subclass features are unlocked even when no milestone was crossed this
// time -- this always has to be recomputed, not just on milestone hits.
export async function loadTrainerDerived(
  supabase: SupabaseClient,
  trainerId: string,
  params: { classId: number; level: number },
): Promise<{
  advancedClasses: TrainerAdvancedClass[]
  features: TrainerFeature[]
  activeFeatures: TrainerFeature[]
  passiveFeatures: TrainerFeature[]
}> {
  const milestones = await loadQualifyingMilestones(supabase, trainerId, params.level)
  const advancedClassIds = milestones.map((m) => m.subclass_id)

  const chosenTypeIdBySubclass = new Map(
    milestones.filter((m) => m.chosen_type_id !== null).map((m) => [m.subclass_id, m.chosen_type_id as number]),
  )

  let typeNameById = new Map<number, string>()
  if (chosenTypeIdBySubclass.size > 0) {
    const { data: types } = await supabase
      .from('types')
      .select('id, name')
      .in('id', Array.from(chosenTypeIdBySubclass.values()))
    typeNameById = new Map((types ?? []).map((t) => [t.id, t.name]))
  }

  let advancedClasses: TrainerAdvancedClass[] = []
  if (advancedClassIds.length > 0) {
    const { data: subclasses } = await supabase.from('subclasses').select('id, name').in('id', advancedClassIds)
    const nameById = new Map((subclasses ?? []).map((s) => [s.id, s.name]))
    // Iterate milestones (already in level order, i.e. grant order) rather than the subclasses query
    // result, whose row order the .in() filter doesn't guarantee.
    advancedClasses = milestones
      .map((m) => {
        const name = nameById.get(m.subclass_id)
        if (!name) return null
        const chosenTypeId = chosenTypeIdBySubclass.get(m.subclass_id)
        const typeName = chosenTypeId !== undefined ? typeNameById.get(chosenTypeId) : undefined
        return {
          name: typeName ? `${name} (${typeName})` : name,
          level: params.level - m.level + 1,
          grantedAtLevel: m.level,
        }
      })
      .filter((v): v is TrainerAdvancedClass => v !== null)
  }

  const { data: baseFeatures } = await supabase
    .from('features')
    .select('id, name, description, level_required, requires_activation, max_uses, uses_reset_on')
    .eq('class_id', params.classId)
    .is('subclass_id', null)
    .lte('level_required', params.level)

  let subclassFeatures: TrainerFeature[] = []
  if (milestones.length > 0) {
    const perSubclass = await Promise.all(
      milestones.map(async (m) => {
        const subclassLevel = params.level - m.level + 1
        const { data } = await supabase
          .from('features')
          .select('id, name, description, level_required, requires_activation, max_uses, uses_reset_on')
          .eq('subclass_id', m.subclass_id)
          .lte('level_required', subclassLevel)
        return data ?? []
      }),
    )
    subclassFeatures = perSubclass.flat()
  }

  const features: TrainerFeature[] = [...(baseFeatures ?? []), ...subclassFeatures].sort(
    (a, b) => a.level_required - b.level_required,
  )

  return {
    advancedClasses,
    features,
    activeFeatures: features.filter((f) => f.requires_activation),
    passiveFeatures: features.filter((f) => !f.requires_activation),
  }
}

// Shared by the trainer page (initial render), updateTrainerInfo, resolveMilestone, and the
// level-up page -- whether this trainer has reached a milestone level that hasn't been resolved yet.
// "Resolved" is checked by existence of a trainer_milestones row at that EXACT level (its primary key
// is (trainer_id, level)), not by counting how many are currently qualifying -- that's what makes
// leveling back up past a milestone that was already resolved before (then temporarily lost to a
// level-down) silently restore it instead of re-prompting: the row never went away, it just stopped
// (and now starts again) counting toward loadQualifyingMilestones.
export async function loadPendingMilestone(
  supabase: SupabaseClient,
  params: { trainerId: string; classId: number; level: number },
): Promise<{ hasPendingMilestone: boolean; nextMilestoneLevel: number | null }> {
  const [{ data: milestoneLevels }, { data: existing }] = await Promise.all([
    supabase
      .from('features')
      .select('level_required')
      .eq('class_id', params.classId)
      .is('subclass_id', null)
      .eq('name', 'Advanced class')
      .order('level_required'),
    supabase.from('trainer_milestones').select('level').eq('trainer_id', params.trainerId),
  ])

  const existingLevels = new Set((existing ?? []).map((m) => m.level))

  for (const row of milestoneLevels ?? []) {
    if (row.level_required > params.level) break
    if (!existingLevels.has(row.level_required)) {
      return { hasPendingMilestone: true, nextMilestoneLevel: row.level_required }
    }
  }

  return { hasPendingMilestone: false, nextMilestoneLevel: null }
}

export type ClassBuilderCard =
  | { kind: 'feature'; feature: TrainerFeature; subclassName: string | null }
  | {
      kind: 'milestone'
      name: string
      description: string
      triggerLevel: number
      resolved: boolean
      // present only when resolved -- lets the card pre-fill AdvancedClassPicker + the 2 stat selects.
      current: {
        subclassId: number
        chosenStat: StatColumn | null
        chosenTypeId: number | null
        statA: StatColumn
        statB: StatColumn
      } | null
      // Computed server-side per card (not shared/filtered client-side) since eligibility genuinely
      // differs per milestone -- excludes every OTHER milestone's already-chosen subclass, same as
      // resolveMilestone/editMilestone always scoped it, so e.g. a Stat Ace stat already taken by
      // another card's resolved choice is correctly missing from this card's own sub-picker too.
      // Resolved cards get an empty skillTalentOptionsByChoice, same "no talent editing on edit"
      // precedent editMilestone always had.
      options: {
        subclassOptions: { value: string; label: string }[]
        statOptions: { value: string; label: string }[]
        typeAceId: number | null
        typeOptions: { id: number; name: string }[]
        skillTalentOptionsByChoice: Record<string, SkillOption[]>
        heldSkillTalents: Record<number, number>
      }
    }

// The /build page's data source -- a sibling of loadTrainerDerived/loadPendingMilestone rather than a
// replacement, since the trainer sheet and updateTrainerInfo only ever need the current-level view and
// shouldn't pay for the extra higher-level query on every save. Unlike loadTrainerDerived (which drops
// anything above the trainer's current level), this fetches every base-Class feature unconditionally
// and partitions it into "unlocked" cards vs. a higher-level preview -- and unlike loadPendingMilestone
// (which stops at the single earliest pending level), this surfaces every pending milestone at once,
// since the Class Builder can have several simultaneously-pending "!" cards (e.g. a trainer jumped
// straight from level 1 to 11).
export async function loadClassBuilderData(
  supabase: SupabaseClient,
  trainerId: string,
  params: { classId: number; originId: number; level: number },
): Promise<{
  cards: ClassBuilderCard[]
  higherLevelPreview: { name: string; levelRequired: number }[]
  pendingMilestoneLevels: number[]
  originFeatures: TrainerFeature[]
}> {
  const [{ data: baseFeaturesData }, { data: allMilestonesData }, { data: originFeaturesData }] = await Promise.all([
    supabase
      .from('features')
      .select('id, name, description, level_required, requires_activation, max_uses, uses_reset_on')
      .eq('class_id', params.classId)
      .is('subclass_id', null)
      .order('level_required'),
    // ALL of this trainer's milestones, not just qualifying ones -- a milestone trigger at level 7
    // with the trainer currently at level 5 is neither resolved nor pending yet, it just doesn't
    // render as a card at all until level reaches 7.
    supabase.from('trainer_milestones').select('level, subclass_id, stat_a, stat_b, chosen_stat, chosen_type_id').eq('trainer_id', trainerId),
    supabase
      .from('features')
      .select('id, name, description, level_required, requires_activation, max_uses, uses_reset_on')
      .eq('origin_id', params.originId),
  ])

  const baseFeatures = (baseFeaturesData ?? []) as TrainerFeature[]
  const allMilestones = (allMilestonesData ?? []) as TrainerMilestoneRow[]
  const milestoneByLevel = new Map(allMilestones.map((m) => [m.level, m]))
  const triggerRows = baseFeatures.filter((f) => f.name === 'Advanced class')
  const qualifyingMilestones = allMilestones.filter((m) => m.level <= params.level)

  const higherLevelPreview = baseFeatures
    .filter((f) => f.level_required > params.level)
    .map((f) => ({ name: f.name, levelRequired: f.level_required }))

  const pendingMilestoneLevels = triggerRows
    .filter((f) => f.level_required <= params.level && !milestoneByLevel.has(f.level_required))
    .map((f) => f.level_required)

  const heldSkillTalents = Object.fromEntries(await loadTrainerSkillTalents(supabase, trainerId))

  const unlocked: { card: ClassBuilderCard; unlockLevel: number }[] = []

  for (const f of baseFeatures) {
    if (f.level_required > params.level || f.name === 'Advanced class') continue
    unlocked.push({ card: { kind: 'feature', feature: f, subclassName: null }, unlockLevel: f.level_required })
  }

  await Promise.all(
    triggerRows
      .filter((trigger) => trigger.level_required <= params.level)
      .map(async (trigger) => {
        const m = milestoneByLevel.get(trigger.level_required)
        // Excludes every OTHER milestone's chosen subclass (not this card's own, if resolved) --
        // same scoping resolveMilestone/editMilestone always used.
        const heldSubclassIds = qualifyingMilestones.filter((q) => q.level !== trigger.level_required).map((q) => q.subclass_id)
        const options = await loadAdvancedClassOptions(supabase, params.classId, heldSubclassIds)
        unlocked.push({
          card: {
            kind: 'milestone',
            name: trigger.name,
            description: trigger.description,
            triggerLevel: trigger.level_required,
            resolved: !!m,
            current: m ? { subclassId: m.subclass_id, chosenStat: m.chosen_stat, chosenTypeId: m.chosen_type_id, statA: m.stat_a, statB: m.stat_b } : null,
            options: {
              ...options,
              skillTalentOptionsByChoice: m ? {} : options.skillTalentOptionsByChoice,
              heldSkillTalents: m ? {} : heldSkillTalents,
            },
          },
          unlockLevel: trigger.level_required,
        })
      }),
  )

  // Subclass features for every qualifying milestone, gated by the subclass's own relative level --
  // same math loadTrainerDerived already uses -- sorted by the trainer level they actually unlock at
  // (grantedAtLevel + relativeLevel - 1), not the subclass's own relative level number.
  if (qualifyingMilestones.length > 0) {
    const subclassIds = qualifyingMilestones.map((m) => m.subclass_id)
    const { data: subclasses } = await supabase.from('subclasses').select('id, name').in('id', subclassIds)
    const nameById = new Map((subclasses ?? []).map((s) => [s.id, s.name]))

    const perSubclass = await Promise.all(
      qualifyingMilestones.map(async (m) => {
        const subclassLevel = params.level - m.level + 1
        const { data } = await supabase
          .from('features')
          .select('id, name, description, level_required, requires_activation, max_uses, uses_reset_on')
          .eq('subclass_id', m.subclass_id)
          .lte('level_required', subclassLevel)
        return (data ?? []).map((f) => ({
          card: { kind: 'feature' as const, feature: f as TrainerFeature, subclassName: nameById.get(m.subclass_id) ?? null },
          unlockLevel: m.level + f.level_required - 1,
        }))
      }),
    )
    unlocked.push(...perSubclass.flat())
  }

  unlocked.sort((a, b) => a.unlockLevel - b.unlockLevel)

  return {
    cards: unlocked.map((u) => u.card),
    higherLevelPreview,
    pendingMilestoneLevels,
    originFeatures: (originFeaturesData ?? []) as TrainerFeature[],
  }
}
