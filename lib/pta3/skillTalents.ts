import type { createClient } from '@/lib/supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

export type SkillOption = { id: number; name: string }
export type OriginSkillTalentGroup = { pickCount: number; skills: SkillOption[] }

// 1 pick = Talented (+2), 2 picks (from two different sources) = Expert (+5). Never stored directly
// -- always derived from picked_count so there's only one source of truth.
export function talentBonus(pickedCount: number): number {
  return pickedCount >= 2 ? 5 : 2
}

// Every Class's flat 6-skill (pick 2) list, and every Origin's pick-groups -- small enough (30 +
// ~112 rows total) to load in full upfront rather than re-fetching per selection, matching how
// TrainerForm already receives the full classes/origins lists with no live server round-trip.
export async function loadCreationSkillTalentOptions(supabase: SupabaseClient): Promise<{
  classOptions: Record<number, SkillOption[]>
  originGroups: Record<number, OriginSkillTalentGroup[]>
}> {
  const [{ data: classRows }, { data: groupRows }] = await Promise.all([
    supabase.from('classes_skill_talents').select('class_id, skills(id, name)').order('class_id'),
    supabase
      .from('origins_skill_talent_groups')
      .select('id, origin_id, pick_count, sort_order, origins_skill_talent_group_options(skills(id, name))')
      .order('origin_id')
      .order('sort_order'),
  ])

  const classOptions: Record<number, SkillOption[]> = {}
  for (const row of (classRows ?? []) as unknown as { class_id: number; skills: SkillOption }[]) {
    ;(classOptions[row.class_id] ??= []).push(row.skills)
  }

  const originGroups: Record<number, OriginSkillTalentGroup[]> = {}
  for (const row of (groupRows ?? []) as unknown as {
    origin_id: number
    pick_count: number
    origins_skill_talent_group_options: { skills: SkillOption }[]
  }[]) {
    ;(originGroups[row.origin_id] ??= []).push({
      pickCount: row.pick_count,
      skills: row.origins_skill_talent_group_options.map((o) => o.skills),
    })
  }

  return { classOptions, originGroups }
}

// Every Advanced Class's flat 2-skill (pick 1) list for one base Class, keyed by subclass_id --
// mirrors loadAdvancedClassOptions' "load everything for this class upfront" shape so the picker
// can react to the chosen Advanced Class client-side with no extra round trip.
export async function loadSubclassSkillTalentOptions(
  supabase: SupabaseClient,
  subclassIds: number[],
): Promise<Record<number, SkillOption[]>> {
  if (subclassIds.length === 0) return {}
  const { data } = await supabase
    .from('subclasses_skill_talents')
    .select('subclass_id, skills(id, name)')
    .in('subclass_id', subclassIds)

  const options: Record<number, SkillOption[]> = {}
  for (const row of (data ?? []) as unknown as { subclass_id: number; skills: SkillOption }[]) {
    ;(options[row.subclass_id] ??= []).push(row.skills)
  }
  return options
}

// A Trainer's current picks, skill_id -> picked_count (1 or 2) -- used both to show the derived
// bonus on the Skills section and to keep a level-up/creation picker from offering a skill that's
// already at the 2-pick cap.
export async function loadTrainerSkillTalents(supabase: SupabaseClient, trainerId: string): Promise<Map<number, number>> {
  const { data } = await supabase.from('trainer_skill_talents').select('skill_id, picked_count').eq('trainer_id', trainerId)
  return new Map((data ?? []).map((r) => [r.skill_id, r.picked_count]))
}

// Shared validation for a Class's flat 2-of-6 pick plus every one of an Origin's pick-groups --
// re-derives what's actually eligible server-side rather than trusting the submitted ids, since a
// picker's own client-side caps can be bypassed. Used both at Trainer creation (validateCreation
// SkillTalentPicks below) and by the build page's Talent re-pick action (updateTrainerSkillTalents,
// app/trainers/actions.ts), which already has its picks as plain arrays rather than FormData.
export async function validateSkillTalentPickSets(
  supabase: SupabaseClient,
  classId: number,
  originId: number,
  classPicked: number[],
  originPicked: number[],
): Promise<{ error: string } | { skillIds: number[] }> {
  const { classOptions, originGroups } = await loadCreationSkillTalentOptions(supabase)

  const classEligible = new Set((classOptions[classId] ?? []).map((s) => s.id))
  if (classPicked.length !== 2 || new Set(classPicked).size !== 2 || !classPicked.every((id) => classEligible.has(id))) {
    return { error: 'Pick exactly 2 Class Skill Talents' }
  }

  const groups = originGroups[originId] ?? []
  for (const group of groups) {
    const groupEligible = new Set(group.skills.map((s) => s.id))
    const pickedInGroup = originPicked.filter((id) => groupEligible.has(id))
    if (pickedInGroup.length !== group.pickCount || new Set(pickedInGroup).size !== group.pickCount) {
      return { error: 'Pick the required number of Origin Skill Talents for each option group' }
    }
  }
  const allGroupEligible = new Set(groups.flatMap((g) => g.skills.map((s) => s.id)))
  if (!originPicked.every((id) => allGroupEligible.has(id))) {
    return { error: 'Invalid Origin Skill Talent selection' }
  }

  return { skillIds: [...classPicked, ...originPicked] }
}

// Thin FormData-reading wrapper around validateSkillTalentPickSets, kept separate so createTrainer's
// call site doesn't have to know the two field names below.
export async function validateCreationSkillTalentPicks(
  supabase: SupabaseClient,
  classId: number,
  originId: number,
  formData: FormData,
): Promise<{ error: string } | { skillIds: number[] }> {
  return validateSkillTalentPickSets(
    supabase,
    classId,
    originId,
    formData.getAll('classTalentSkillIds').map(Number),
    formData.getAll('originTalentSkillIds').map(Number),
  )
}

// [[Improvement - Move Trainer editing (Name, Origin, Talents, Stats) to the build page]]: a
// Trainer's current base Class Talent picks (2) and base Origin Talent picks (however many groups
// require), split by source -- distinct from loadTrainerSkillTalents' combined per-skill counts,
// which can't tell a base pick apart from a milestone-granted one. Used to prefill the build page's
// Talent re-pick section.
export async function loadTrainerBaseSkillTalents(
  supabase: SupabaseClient,
  trainerId: string,
): Promise<{ classSkillIds: number[]; originSkillIds: number[] }> {
  const { data } = await supabase.from('trainer_base_skill_talents').select('skill_id, source').eq('trainer_id', trainerId)
  const classSkillIds = (data ?? []).filter((r) => r.source === 'class').map((r) => r.skill_id)
  const originSkillIds = (data ?? []).filter((r) => r.source === 'origin').map((r) => r.skill_id)
  return { classSkillIds, originSkillIds }
}

// [[Improvement - Move Trainer editing (Name, Origin, Talents, Stats) to the build page]]: replaces
// one source's (base Class or base Origin) tracked picks wholesale -- releases whichever previously-
// tracked skill ids aren't in nextSkillIds (via removeSkillTalentPick) and applies whichever are new
// (via applySkillTalentPicks), then rewrites trainer_base_skill_talents' rows for this source to match.
// Passing an empty nextSkillIds releases every pick for that source without applying anything new --
// how updateTrainerInfo forces a re-pick when Class or Origin actually changes.
export async function replaceBaseSkillTalents(
  supabase: SupabaseClient,
  trainerId: string,
  source: 'class' | 'origin',
  nextSkillIds: number[],
): Promise<{ error: string } | { ok: true }> {
  const { data: existingRows } = await supabase
    .from('trainer_base_skill_talents')
    .select('skill_id')
    .eq('trainer_id', trainerId)
    .eq('source', source)
  const previousSkillIds = (existingRows ?? []).map((r) => r.skill_id)

  for (const skillId of previousSkillIds) {
    if (nextSkillIds.includes(skillId)) continue
    const result = await removeSkillTalentPick(supabase, trainerId, skillId)
    if ('error' in result) return result
  }

  const toApply = nextSkillIds.filter((id) => !previousSkillIds.includes(id))
  if (toApply.length > 0) {
    const result = await applySkillTalentPicks(supabase, trainerId, toApply)
    if ('error' in result) return result
  }

  const { error: deleteError } = await supabase
    .from('trainer_base_skill_talents')
    .delete()
    .eq('trainer_id', trainerId)
    .eq('source', source)
  if (deleteError) return { error: deleteError.message }

  if (nextSkillIds.length > 0) {
    const { error: insertError } = await supabase
      .from('trainer_base_skill_talents')
      .insert(nextSkillIds.map((skillId) => ({ trainer_id: trainerId, skill_id: skillId, source })))
    if (insertError) return { error: insertError.message }
  }

  return { ok: true }
}

// Shared write path for both Trainer creation (Class + Origin picks together) and a level-up's
// Advanced Class pick (one skill at a time) -- takes a flat list of skill ids being picked *right
// now* (a skill appearing twice means it's being granted from two sources in the same submission,
// e.g. the same skill chosen from both the Class list and an Origin group at creation) and folds
// each one into the Trainer's existing picked_count, capped at 2. Picks that would push a skill
// past the cap are silently dropped rather than erroring -- the caller's picker UI is expected to
// have already excluded already-capped skills, so this is a defensive backstop, not the primary gate.
export async function applySkillTalentPicks(supabase: SupabaseClient, trainerId: string, skillIds: number[]): Promise<{ error: string } | { ok: true }> {
  if (skillIds.length === 0) return { ok: true }

  const existing = await loadTrainerSkillTalents(supabase, trainerId)
  const nextCounts = new Map(existing)
  for (const skillId of skillIds) {
    const current = nextCounts.get(skillId) ?? 0
    if (current >= 2) continue
    nextCounts.set(skillId, current + 1)
  }

  const rows = [...nextCounts.entries()]
    .filter(([skillId, count]) => count !== (existing.get(skillId) ?? 0))
    .map(([skillId, picked_count]) => ({ trainer_id: trainerId, skill_id: skillId, picked_count }))

  if (rows.length === 0) return { ok: true }

  const { error } = await supabase.from('trainer_skill_talents').upsert(rows, { onConflict: 'trainer_id,skill_id' })
  if (error) return { error: error.message }
  return { ok: true }
}

// [[Class can't be edited when editing subclass or level]]: the inverse of applySkillTalentPicks,
// used only by saveMilestone's update branch to undo a specific milestone's own previous pick before
// applying its replacement -- a fresh pick (the insert branch) has nothing to undo. Deletes the row
// once its count reaches 0 rather than leaving a picked_count: 0 row around, matching how a skill
// that was never picked has no row at all.
export async function removeSkillTalentPick(supabase: SupabaseClient, trainerId: string, skillId: number): Promise<{ error: string } | { ok: true }> {
  const { data: row } = await supabase
    .from('trainer_skill_talents')
    .select('picked_count')
    .eq('trainer_id', trainerId)
    .eq('skill_id', skillId)
    .maybeSingle()
  if (!row) return { ok: true }

  const nextCount = row.picked_count - 1
  if (nextCount <= 0) {
    const { error } = await supabase.from('trainer_skill_talents').delete().eq('trainer_id', trainerId).eq('skill_id', skillId)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase.from('trainer_skill_talents').update({ picked_count: nextCount }).eq('trainer_id', trainerId).eq('skill_id', skillId)
    if (error) return { error: error.message }
  }
  return { ok: true }
}
