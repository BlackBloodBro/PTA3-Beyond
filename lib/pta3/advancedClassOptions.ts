import type { createClient } from '@/lib/supabase/server'

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

  return { subclassOptions, statOptions, typeAceId: typeAce?.id ?? null, typeOptions }
}
