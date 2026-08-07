import type { createClient } from '@/lib/supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

// Every Class's 2 Favored Stats (by `stats.name`), keyed by class_id -- small enough to load in full
// upfront, matching the "load everything, filter client-side" shape used for Skill Talent options.
export async function loadClassFavoredStats(supabase: SupabaseClient): Promise<Record<number, string[]>> {
  const { data } = await supabase.from('class_favored_stats').select('class_id, stats(name)').order('class_id')

  const byClass: Record<number, string[]> = {}
  for (const row of (data ?? []) as unknown as { class_id: number; stats: { name: string } }[]) {
    ;(byClass[row.class_id] ??= []).push(row.stats.name)
  }
  return byClass
}
