import type { createClient } from '@/lib/supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

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
    loyaltyId: number | null
    obtainMethodId: number | null
    growthRateId: number | null
  },
): Promise<{ level: number; effectiveExp: number }> {
  const [{ data: loyalty }, { data: obtainMethod }, { data: growthRate }, { data: shinyModifiers }] = await Promise.all([
    params.loyaltyId
      ? supabase.from('loyalties').select('modifier').eq('id', params.loyaltyId).maybeSingle()
      : Promise.resolve({ data: null }),
    params.obtainMethodId
      ? supabase.from('obtain_methods').select('modifier').eq('id', params.obtainMethodId).maybeSingle()
      : Promise.resolve({ data: null }),
    params.growthRateId
      ? supabase.from('growth_rates').select('exp_modifier').eq('id', params.growthRateId).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('exp_modifiers_shiny').select('name, modifier'),
  ])

  const loyaltyModifier = loyalty?.modifier ?? 1
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
