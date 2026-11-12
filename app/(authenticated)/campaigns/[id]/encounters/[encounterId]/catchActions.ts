'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadCampaignEvDisabled, computePokemonMaxHp } from '@/lib/pta3/pokemonEv'
import {
  TIMER_BALL_BONUS_BY_TIER,
  TIMER_BALL_NAME,
  ballBonusFromStoredModifier,
  catchHpTierId,
  computeCatchTarget,
} from '@/lib/pta3/catching'

export type CatchAttemptResult = { error: string } | { success: boolean; roll: number; targetPercent: number }

// [[Feature - Create Pokemon catching mechanic]]: throw a Poke Ball at an enemy wild Pokemon in an active
// Encounter. The app computes the odds; the player rolls a physical d100 and types it in (no server RNG),
// same convention as attack resolution and Sleep. Success = roll <= target%. Everything that changes state
// -- consuming the Ball, adding the Pokemon to the thrower's roster as "Caught", removing it from the
// Encounter, moving the turn on -- happens in one atomic call to resolve_catch_attempt(), which also
// re-checks who may act (a member can't otherwise delete an enemy combatant or move the turn counter).
export async function attemptCatch(input: {
  encounterId: string
  combatantId: string
  trainerId: string
  trainersItemId: string
  // Ball-specific, entered by the thrower: whether the Ball's own condition (e.g. "if the Pokemon is in
  // water") holds, and for a Timer Ball how long the encounter has lasted (0 / 1 / 2 minutes).
  conditionMet: boolean
  timerTier: 0 | 1 | 2
  roll: number
}): Promise<CatchAttemptResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const roll = Math.floor(Number(input.roll))
  if (!Number.isInteger(roll) || roll < 1 || roll > 100) return { error: 'Enter the d100 result, a whole number from 1 to 100' }

  const { data: encounter } = await supabase
    .from('encounters')
    .select('id, campaign_id, status, catch_battle_start_id')
    .eq('id', input.encounterId)
    .maybeSingle()
  if (!encounter) return { error: 'Encounter not found' }
  if (encounter.status !== 'active') return { error: 'The encounter is not active' }

  const { data: combatantRaw } = await supabase
    .from('encounter_combatants')
    .select('id, side, pokemon_id, pokemon(id, current_hp, bonus_base_hp, ev_hp, pokedex(catch_rate, base_hp))')
    .eq('id', input.combatantId)
    .eq('encounter_id', input.encounterId)
    .maybeSingle()
  const combatant = combatantRaw as unknown as {
    id: string
    side: string
    pokemon_id: string | null
    pokemon: { id: string; current_hp: number; bonus_base_hp: number; ev_hp: number; pokedex: { catch_rate: number; base_hp: number } | null } | null
  } | null
  if (!combatant || combatant.side !== 'enemy' || !combatant.pokemon || !combatant.pokemon.pokedex) return { error: 'That is not a wild Pokémon in this encounter' }

  const { data: ballRaw } = await supabase
    .from('trainers_items')
    .select('id, quantity, trainer_id, items(id, name)')
    .eq('id', input.trainersItemId)
    .eq('trainer_id', input.trainerId)
    .maybeSingle()
  const ball = ballRaw as unknown as { id: string; quantity: number; items: { id: number; name: string } | null } | null
  if (!ball || !ball.items || ball.quantity < 1) return { error: 'That Ball is not in this Trainer’s bag' }

  const [{ data: ballModifier }, { data: hpRows }, { data: battleStartRow }, { data: afflictionRows }, evsDisabled] = await Promise.all([
    supabase.from('pokeball_catch_modifiers').select('modifier, condition').eq('item_id', ball.items.id).maybeSingle(),
    supabase.from('catch_modifiers_hp').select('id, modifier'),
    encounter.catch_battle_start_id
      ? supabase.from('catch_modifiers_battle_start').select('modifier').eq('id', encounter.catch_battle_start_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('pokemon_afflictions').select('afflictions(catch_modifier)').eq('pokemon_id', combatant.pokemon.id),
    loadCampaignEvDisabled(supabase, encounter.campaign_id),
  ])
  if (!ballModifier) return { error: 'That item is not a Poké Ball that can be thrown' }

  const maxHp = computePokemonMaxHp(combatant.pokemon.pokedex.base_hp, combatant.pokemon.bonus_base_hp, combatant.pokemon.ev_hp, evsDisabled)
  const hpModifier = (hpRows ?? []).find((r) => r.id === catchHpTierId(combatant.pokemon!.current_hp, maxHp))?.modifier ?? 0

  // A Ball with no condition always applies; one with a condition only when the thrower says it holds. The
  // Timer Ball's "condition" is really a duration tier, so it uses that instead.
  const conditionApplies = !ballModifier.condition || input.conditionMet
  const ballBonus =
    ball.items.name === TIMER_BALL_NAME
      ? TIMER_BALL_BONUS_BY_TIER[input.timerTier] ?? 0
      : conditionApplies
        ? ballBonusFromStoredModifier(ballModifier.modifier)
        : 0

  // The single most catch-favourable active Affliction (a Pokémon normally only has one at a time), else 0.
  const afflictionModifier = Math.max(
    0,
    ...((afflictionRows ?? []) as unknown as { afflictions: { catch_modifier: number | null } | null }[]).map((r) => r.afflictions?.catch_modifier ?? 0),
  )

  const { targetPercent } = computeCatchTarget({
    catchRate: combatant.pokemon.pokedex.catch_rate,
    hpModifier,
    battleStartModifier: battleStartRow?.modifier ?? 0,
    ballBonus,
    afflictionModifier,
  })
  const success = roll <= targetPercent

  const { error } = await supabase.rpc('resolve_catch_attempt', {
    target_encounter_id: input.encounterId,
    target_combatant_id: input.combatantId,
    acting_trainer_id: input.trainerId,
    acting_trainers_item_id: input.trainersItemId,
    caught: success,
  })
  if (error) return { error: error.message }

  return { success, roll, targetPercent: Math.round(targetPercent * 10) / 10 }
}

// GM-only: how this Encounter started, which feeds every catch attempt in it. A plain form action.
export async function setEncounterBattleStart(encounterId: string, campaignId: string, formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const id = Number(formData.get('battleStartId'))
  if (!Number.isInteger(id) || id < 1) redirect(`/campaigns/${campaignId}/encounters/${encounterId}?error=${encodeURIComponent('Choose how the battle started')}`)

  const { error } = await supabase.from('encounters').update({ catch_battle_start_id: id }).eq('id', encounterId)
  if (error) redirect(`/campaigns/${campaignId}/encounters/${encounterId}?error=${encodeURIComponent(error.message)}`)

  redirect(`/campaigns/${campaignId}/encounters/${encounterId}`)
}
