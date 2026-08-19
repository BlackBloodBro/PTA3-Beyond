import type { createClient } from '@/lib/supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

// Pure formula extracted so a client component (the Pokemon-creation form's live "this EXP -> level
// N" preview, [[Bug - Improve Wild Pokemon creation and editing]]) can derive the same result from
// preloaded reference data without a server round trip per keystroke. Must stay in lockstep with
// computePokemonLevel/computePokemonLevelsBulk's formula below -- same multiplication, same
// floor-before-compare, same fallback-to-1.
export function deriveLevelFromModifiers(
  params: { currentExp: number; loyaltyModifier: number; obtainModifier: number; growthModifier: number; shinyModifier: number },
  levelRows: { level_number: number; cumulative_exp: number }[],
): { level: number; effectiveExp: number } {
  const effectiveExp = params.currentExp * params.loyaltyModifier * params.obtainModifier * params.growthModifier * params.shinyModifier
  const flooredExp = Math.floor(effectiveExp)
  const levelRow = [...levelRows].sort((a, b) => b.level_number - a.level_number).find((lr) => lr.cumulative_exp <= flooredExp)
  return { level: levelRow?.level_number ?? 1, effectiveExp }
}

export type LoyaltyTierInfo = { sort_order: number; min_points: number }

// The highest-sort_order loyalties row whose min_points threshold a given LP total has reached --
// the direct Loyalty analogue of exp-to-level, just with no further modifiers of its own. Generic so
// callers can pass richer rows (id/name/modifier included) and get them back typed. Null only if
// tierRows is empty (loyalties seed data missing) -- every real LP total (including 0) matches the
// bottom tier's min_points = 0 row.
export function computeLoyaltyTier<T extends LoyaltyTierInfo>(loyaltyPoints: number, tierRows: T[]): T | null {
  return [...tierRows].sort((a, b) => b.sort_order - a.sort_order).find((t) => t.min_points <= loyaltyPoints) ?? null
}

// Pokemon level is never stored -- it's always derived from current_exp and four multiplicative
// modifiers (homebrew formula, confirmed with the user): effective_exp = current_exp ×
// growth_rate.exp_modifier × obtain_method.modifier × shiny_modifier × loyalty_modifier, then
// level = the highest levels.level_number whose cumulative_exp is at or below that. Any input
// changing (a battle's exp award, a loyalty shift, re-assigning obtain method, even editing
// shininess) is reflected immediately next render, since there's no cached value to go stale.
export async function computePokemonLevel(
  supabase: SupabaseClient,
  params: {
    currentExp: number
    isShiny: boolean
    loyaltyPoints: number
    obtainMethodId: number | null
    growthRateId: number | null
  },
): Promise<{ level: number; effectiveExp: number }> {
  const [{ data: loyaltyRows }, { data: obtainMethod }, { data: growthRate }, { data: shinyModifiers }] = await Promise.all([
    supabase.from('loyalties').select('modifier, sort_order, min_points'),
    params.obtainMethodId
      ? supabase.from('obtain_methods').select('modifier').eq('id', params.obtainMethodId).maybeSingle()
      : Promise.resolve({ data: null }),
    params.growthRateId
      ? supabase.from('growth_rates').select('exp_modifier').eq('id', params.growthRateId).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('exp_modifiers_shiny').select('name, modifier'),
  ])

  const loyaltyModifier = computeLoyaltyTier(params.loyaltyPoints, loyaltyRows ?? [])?.modifier ?? 1
  const obtainModifier = obtainMethod?.modifier ?? 1
  const growthModifier = growthRate?.exp_modifier ?? 1
  const shinyRow = (shinyModifiers ?? []).find((r) => r.name === (params.isShiny ? 'Yes' : 'No'))
  const shinyModifier = shinyRow?.modifier ?? 1

  const effectiveExp = params.currentExp * loyaltyModifier * obtainModifier * growthModifier * shinyModifier

  // levels.cumulative_exp is bigint (whole numbers only), but effectiveExp is a product of
  // decimal modifiers and is almost always fractional -- floor it before comparing, both because
  // Postgres rejects a fractional literal against a bigint column and because a Pokemon shouldn't
  // reach the next level early just from rounding.
  const { data: levelRow } = await supabase
    .from('levels')
    .select('level_number')
    .lte('cumulative_exp', Math.floor(effectiveExp))
    .order('level_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  return { level: levelRow?.level_number ?? 1, effectiveExp }
}

// Bulk variant for pages that render many Pokemon at once (the PC, 50-100+ rows) -- the per-Pokemon
// version above does ~5 round trips each, fine for the Trainer page's 6-Pokemon Team loop but ~500
// queries at PC scale. Fetches each small reference table ONCE and computes every Pokemon's level in
// memory instead, using the exact same formula/floor/fallback-to-1 logic as computePokemonLevel.
export async function computePokemonLevelsBulk(
  supabase: SupabaseClient,
  pokemonList: {
    pokemonId: string
    currentExp: number
    isShiny: boolean
    loyaltyPoints: number
    obtainMethodId: number | null
    growthRateId: number | null
  }[],
): Promise<Map<string, { level: number; effectiveExp: number }>> {
  const [{ data: loyaltyRows }, { data: obtainMethods }, { data: growthRates }, { data: shinyModifiers }, { data: levels }] =
    await Promise.all([
      supabase.from('loyalties').select('modifier, sort_order, min_points'),
      supabase.from('obtain_methods').select('id, modifier'),
      supabase.from('growth_rates').select('id, exp_modifier'),
      supabase.from('exp_modifiers_shiny').select('name, modifier'),
      // Ordered descending once here so each Pokemon's lookup below is a simple in-memory scan for
      // the first row at or below its effective exp -- matches the single-row query's
      // `.order('level_number', desc).limit(1)` semantics exactly.
      supabase.from('levels').select('level_number, cumulative_exp').order('level_number', { ascending: false }),
    ])

  const obtainModifierById = new Map((obtainMethods ?? []).map((o) => [o.id, o.modifier]))
  const growthModifierById = new Map((growthRates ?? []).map((g) => [g.id, g.exp_modifier]))
  const shinyModifierByName = new Map((shinyModifiers ?? []).map((r) => [r.name, r.modifier]))
  const levelRows = levels ?? []

  const result = new Map<string, { level: number; effectiveExp: number }>()
  for (const p of pokemonList) {
    const loyaltyModifier = computeLoyaltyTier(p.loyaltyPoints, loyaltyRows ?? [])?.modifier ?? 1
    const obtainModifier = (p.obtainMethodId !== null ? obtainModifierById.get(p.obtainMethodId) : undefined) ?? 1
    const growthModifier = (p.growthRateId !== null ? growthModifierById.get(p.growthRateId) : undefined) ?? 1
    const shinyModifier = shinyModifierByName.get(p.isShiny ? 'Yes' : 'No') ?? 1

    const effectiveExp = p.currentExp * loyaltyModifier * obtainModifier * growthModifier * shinyModifier
    const flooredExp = Math.floor(effectiveExp)
    const levelRow = levelRows.find((lr) => lr.cumulative_exp <= flooredExp)

    result.set(p.pokemonId, { level: levelRow?.level_number ?? 1, effectiveExp })
  }
  return result
}
