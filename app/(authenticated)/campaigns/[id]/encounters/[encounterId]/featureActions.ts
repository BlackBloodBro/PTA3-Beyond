'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

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
