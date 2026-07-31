import type { createClient } from '@/lib/supabase/server'

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
