import type { SupabaseClient } from '@supabase/supabase-js'
import { loadQualifyingMilestones, computeEffectiveStats } from '@/lib/pta3/trainerFeatures'
import { statModifier } from '@/lib/pta3/pointBuy'

// [[Feature - Apply Press's stat boost, damage and loyalty cost in Encounters (Ace trainer)]]: the damage one use of Press
// deals to the Pokemon -- 8 minus the Trainer's higher of Attack / Special Attack modifier (the same "always the higher"
// rule Affirmation uses), never below 0. Shared by the Encounter page (to show it before confirming) and the action that
// applies it, so the two can't drift.
export async function loadPressDamage(supabase: SupabaseClient, trainerId: string): Promise<number | null> {
  const { data: trainer } = await supabase
    .from('trainers')
    .select('level, base_attack, base_defense, base_special_attack, base_special_defense, base_speed')
    .eq('id', trainerId)
    .maybeSingle()
  if (!trainer) return null
  const milestones = await loadQualifyingMilestones(supabase, trainerId, trainer.level)
  const effective = computeEffectiveStats(
    {
      attack: trainer.base_attack,
      defense: trainer.base_defense,
      special_attack: trainer.base_special_attack,
      special_defense: trainer.base_special_defense,
      speed: trainer.base_speed,
    },
    milestones,
  )
  const higher = Math.max(statModifier(effective.attack), statModifier(effective.special_attack))
  return Math.max(0, 8 - higher)
}
