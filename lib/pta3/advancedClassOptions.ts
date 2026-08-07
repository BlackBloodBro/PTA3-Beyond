import type { createClient } from '@/lib/supabase/server'
import { loadSubclassSkillTalentOptions, type SkillOption } from '@/lib/pta3/skillTalents'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

export const STAT_OPTIONS = [
  { value: 'attack', label: 'Attack' },
  { value: 'defense', label: 'Defense' },
  { value: 'special_attack', label: 'Special Attack' },
  { value: 'special_defense', label: 'Special Defense' },
  { value: 'speed', label: 'Speed' },
] as const

export const STAT_LABELS: Record<string, string> = Object.fromEntries(STAT_OPTIONS.map((s) => [s.value, s.label]))

// Shared by the level-up page (resolving the next pending milestone) and the milestone edit page
// (changing an already-resolved one) -- both need the same "which subclasses/stats/types can this
// class's milestone form offer" logic, differing only in which subclass ids count as already held.
export async function loadAdvancedClassOptions(
  supabase: SupabaseClient,
  classId: number,
  heldSubclassIds: number[],
): Promise<{
  subclassOptions: { value: string; label: string }[]
  statOptions: { value: string; label: string }[]
  typeAceId: number | null
  typeOptions: { id: number; name: string }[]
  // Skill Talent options keyed by the exact same `subclassChoice` value the picker's <select> uses
  // ('stat_ace' or a specific subclass id as a string) -- all 5 Stat ace rows share one identical
  // Skill Talent list, so this collapses them to the single 'stat_ace' key the picker already has,
  // rather than making the picker resolve "which of the 5 rows" itself.
  skillTalentOptionsByChoice: Record<string, SkillOption[]>
}> {
  const { data: eligibleSubclasses } = await supabase
    .from('subclasses')
    .select('id, name')
    .eq('class_id', classId)
    .not('id', 'in', `(${heldSubclassIds.join(',') || 0})`)
    .order('name')

  // "Stat ace (attack)" / "(defense)" / etc. stay 5 distinct rows underneath (their features
  // genuinely differ per stat), but are presented as one combined "Stat ace" choice with a stat
  // sub-picker -- the caller maps the choice back to whichever of the 5 rows matches.
  const statAceRows = (eligibleSubclasses ?? []).filter((s) => s.name.startsWith('Stat ace'))
  const otherSubclasses = (eligibleSubclasses ?? []).filter((s) => !s.name.startsWith('Stat ace'))

  const statOptions = statAceRows
    .map((s) => {
      const match = s.name.match(/\(([^)]+)\)/)
      const value = match?.[1].replace(' ', '_')
      return value ? { value, label: STAT_LABELS[value] ?? value } : null
    })
    .filter((o): o is { value: string; label: string } => o !== null)

  const subclassOptions = [
    ...otherSubclasses.map((s) => ({ value: String(s.id), label: s.name })),
    ...(statAceRows.length > 0 ? [{ value: 'stat_ace', label: 'Stat ace' }] : []),
  ].sort((a, b) => a.label.localeCompare(b.label))

  const typeAce = otherSubclasses.find((s) => s.name === 'Type ace')
  let typeOptions: { id: number; name: string }[] = []
  if (typeAce) {
    const { data } = await supabase.from('types').select('id, name').neq('name', 'Special/Variable').order('name')
    typeOptions = data ?? []
  }

  const bySubclassId = await loadSubclassSkillTalentOptions(
    supabase,
    (eligibleSubclasses ?? []).map((s) => s.id),
  )
  const skillTalentOptionsByChoice: Record<string, SkillOption[]> = {}
  for (const s of otherSubclasses) {
    if (bySubclassId[s.id]) skillTalentOptionsByChoice[String(s.id)] = bySubclassId[s.id]
  }
  if (statAceRows.length > 0) {
    // Identical list across all 5 rows (confirmed during Design -- eligibility doesn't vary by
    // which stat was picked), so any one of them stands in for the combined 'stat_ace' choice.
    skillTalentOptionsByChoice.stat_ace = bySubclassId[statAceRows[0].id] ?? []
  }

  return { subclassOptions, statOptions, typeAceId: typeAce?.id ?? null, typeOptions, skillTalentOptionsByChoice }
}
