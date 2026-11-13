'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadPressDamage } from '@/lib/pta3/press'
import { adjustPokemonHp } from '@/app/(authenticated)/pokemon/actions'

// [[Feature - Mark a target for Critical advice in Encounters (Researcher)]]: mark a combatant so that, for the rest of the
// encounter, attacks against it are critical hits on a natural 18-20; spends one of the Trainer's 3 uses. One atomic
// use_critical_advice() call re-checks who may act, the Feature and the uses left. A free action: no turn change.
export async function useCriticalAdvice(input: {
  encounterId: string
  trainerId: string
  targetCombatantId: string
}): Promise<{ error: string } | { ok: true }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase.rpc('use_critical_advice', {
    target_encounter_id: input.encounterId,
    acting_trainer_id: input.trainerId,
    target_combatant_id: input.targetCombatantId,
  })
  if (error) return { error: error.message }
  return { ok: true }
}

// [[Feature - Apply Intimidate's stat penalty in Encounters (Ace trainer)]]: use Intimidate on a Pokemon in an active
// Encounter -- -2 to its Attack or Special Attack for the rest of the encounter (stacking), and one of the Trainer's
// 3 uses spent. Everything happens in one atomic use_intimidate() call, which re-checks who may act, that the Trainer
// really has the Feature, and that a use is left. A plain Feature use: it does not advance the turn.
export async function useIntimidate(input: {
  encounterId: string
  trainerId: string
  targetCombatantId: string
  stat: 'attack' | 'special_attack'
}): Promise<{ error: string } | { ok: true }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase.rpc('use_intimidate', {
    target_encounter_id: input.encounterId,
    acting_trainer_id: input.trainerId,
    target_combatant_id: input.targetCombatantId,
    target_stat: input.stat,
  })
  if (error) return { error: error.message }
  return { ok: true }
}

export type PressResult = { pokemonDamage: number; useNumber: number; loyaltyChange: number; fainted: boolean }

// Press one of the Trainer's own Pokemon: +2 to all five stats for the rest of the encounter (stacking), X damage, and a
// Loyalty cost from the second use on. The atomic use_press() call checks who may act, the Feature and the ownership and
// writes the boost + the Loyalty cost; the damage then goes through the ordinary HP path (Temp HP first, "Fainted"
// triggers). A plain Feature use: it does not advance the turn.
export async function usePress(input: {
  encounterId: string
  trainerId: string
  targetCombatantId: string
}): Promise<{ error: string } | PressResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const damage = await loadPressDamage(supabase, input.trainerId)
  if (damage === null) return { error: 'Trainer not found' }

  const { data, error } = await supabase.rpc('use_press', {
    target_encounter_id: input.encounterId,
    acting_trainer_id: input.trainerId,
    target_combatant_id: input.targetCombatantId,
  })
  if (error) return { error: error.message }
  const outcome = data as { pokemonId: string; useNumber: number; loyaltyChange: number }

  let fainted = false
  if (damage > 0) {
    const { data: before } = await supabase.from('pokemon').select('current_hp').eq('id', outcome.pokemonId).maybeSingle()
    const hit = await adjustPokemonHp(outcome.pokemonId, -1, damage)
    if ('error' in hit) {
      return { error: `Press boosted the Pokémon's stats, but the damage could not be applied: ${hit.error}` }
    }
    fainted = (before?.current_hp ?? 0) > 0 && hit.currentHp === 0
  }

  return { pokemonDamage: damage, useNumber: outcome.useNumber, loyaltyChange: outcome.loyaltyChange, fainted }
}
