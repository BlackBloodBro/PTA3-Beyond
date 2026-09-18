import type { SupabaseClient } from '@supabase/supabase-js'

// [[Feature - GM can restrict global catalog entries from a Campaign]]: the ids a Campaign's GM has
// excluded from their world -- shared by every player-facing species picker/browser that needs to
// knock them out, and by the GM-facing toggle list itself. `null`/no campaign context always means
// "nothing excluded" (there's no Campaign to exclude from), matching every other Campaign-scoping
// loader's own "undefined/null changes nothing or means global-only" convention in this codebase.
export async function loadExcludedPokedexIds(supabase: SupabaseClient, campaignId: string | null | undefined): Promise<number[]> {
  if (!campaignId) return []
  const { data } = await supabase.from('campaign_excluded_pokedex').select('pokedex_id').eq('campaign_id', campaignId)
  return (data ?? []).map((r) => r.pokedex_id)
}
