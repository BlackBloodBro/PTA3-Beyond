'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadQualifyingMilestones, computeEffectiveStats, type StatColumn } from '@/lib/pta3/trainerFeatures'
import { loadPokemonEffectiveStats, loadPokemonEffectiveType } from '@/lib/pta3/pokemonStats'
import { resolveAccuracyStat, stabBonus, effectivenessFor, adjustDiceCount, type TypeMatchupInfo, type TypeImmunityInfo } from '@/lib/pta3/combatMath'

export type AccuracyResult =
  | { error: string }
  | {
      hit: boolean
      roll: number
      toHitModifier: number
      targetNumber: number
      targetStatLabel: string
      moveName: string
      isDamageMove: boolean
      damageDice: string | null
      damageModifier: number
      effectivenessLabel: string | null
      isImmune: boolean
    }

const TARGET_STAT_LABELS: Record<StatColumn, string> = {
  attack: 'Attack',
  defense: 'Defense',
  special_attack: 'Special Attack',
  special_defense: 'Special Defense',
  speed: 'Speed',
}

// [[Feature - Add attack resolution to combat encounters]]: the app's whole job here is computing
// every modifier/target-number -- the player still rolls a physical d20 and types the result in (no
// server-side RNG), same "physical dice" convention as catching/Sleep's own HP roll. Pure read +
// computation, no mutation -- applying damage on a hit is a separate step (see the client component)
// that calls the *existing* adjustPokemonHp/adjustTrainerHp actions directly, so this needs no new
// RLS of its own beyond the read-visibility grants added alongside it
// (20260908130000_attack_resolution_target_visibility.sql).
export async function resolveAccuracy(
  attackerCombatantId: string,
  targetCombatantId: string,
  moveId: number,
  d20Roll: number,
): Promise<AccuracyResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  if (!Number.isInteger(d20Roll) || d20Roll < 1 || d20Roll > 20) {
    return { error: 'Enter the d20 result (1-20)' }
  }

  const [{ data: attackerCombatant }, { data: targetCombatant }, { data: moveRaw }] = await Promise.all([
    supabase.from('encounter_combatants').select('pokemon_id').eq('id', attackerCombatantId).single(),
    supabase.from('encounter_combatants').select('trainer_id, pokemon_id').eq('id', targetCombatantId).single(),
    supabase.from('moves').select('name, damage_stat, damage_dice, types(name)').eq('id', moveId).single(),
  ])
  // Same reverse-embed quirk documented throughout this codebase -- types comes back as a single
  // object at runtime, not the array TS infers.
  const move = moveRaw as unknown as { name: string; damage_stat: string; damage_dice: string | null; types: { name: string } | null } | null

  // Attacker scope is Pokemon-only for this FR (see the FR's own note) -- a Trainer's separate
  // trainer_moves system isn't covered here.
  if (!attackerCombatant?.pokemon_id) {
    return { error: 'Attacker not found' }
  }
  if (!targetCombatant || (!targetCombatant.trainer_id && !targetCombatant.pokemon_id)) {
    return { error: 'Target not found' }
  }
  if (!move) {
    return { error: 'Move not found' }
  }

  const attackerStatRows = await loadPokemonEffectiveStats(supabase, attackerCombatant.pokemon_id)
  if (!attackerStatRows) {
    return { error: 'Could not read the attacking Pokemon' }
  }
  const { modifier: toHitModifier, targetStatKey } = resolveAccuracyStat(move.damage_stat, attackerStatRows)

  let targetNumber: number
  let targetType1: string | null = null
  let targetType2: string | null = null

  if (targetCombatant.pokemon_id) {
    const targetStatRows = await loadPokemonEffectiveStats(supabase, targetCombatant.pokemon_id)
    if (!targetStatRows) {
      return { error: 'Could not read the target Pokemon' }
    }
    targetNumber = targetStatRows.find((s) => s.key === targetStatKey)!.value
    const targetType = await loadPokemonEffectiveType(supabase, targetCombatant.pokemon_id)
    targetType1 = targetType?.type1 ?? null
    targetType2 = targetType?.type2 ?? null
  } else {
    const { data: trainer } = await supabase
      .from('trainers')
      .select('level, base_attack, base_defense, base_special_attack, base_special_defense, base_speed')
      .eq('id', targetCombatant.trainer_id!)
      .single()
    if (!trainer) {
      return { error: 'Could not read the target Trainer' }
    }
    const milestones = await loadQualifyingMilestones(supabase, targetCombatant.trainer_id!, trainer.level)
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
    targetNumber = effective[targetStatKey]
    // A Trainer has no type -- STAB/effectiveness only ever apply against a Pokemon target, left null.
  }

  const hit = d20Roll + toHitModifier >= targetNumber
  const isDamageMove = move.damage_dice !== null

  let damageDice: string | null = null
  let damageModifier = 0
  let effectivenessLabel: string | null = null
  let isImmune = false

  if (isDamageMove) {
    const attackerType = await loadPokemonEffectiveType(supabase, attackerCombatant.pokemon_id)
    const stab = stabBonus(move.types?.name, attackerType?.type1 ?? undefined, attackerType?.type2 ?? undefined)
    damageModifier = toHitModifier + stab
    damageDice = move.damage_dice

    if (targetType1) {
      const [{ data: typeMatchupsRaw }, { data: typeImmunitiesRaw }] = await Promise.all([
        supabase.from('type_matchups').select('attacking_type:types!attacking_type_id(name), defending_type:types!defending_type_id(name), modifier'),
        supabase.from('type_immunities').select('attacking_type:types!attacking_type_id(name), defending_type:types!defending_type_id(name)'),
      ])
      const typeMatchups = ((typeMatchupsRaw ?? []) as unknown as { attacking_type: { name: string }; defending_type: { name: string }; modifier: number }[]).map(
        (m) => ({ attacking_type: m.attacking_type.name, defending_type: m.defending_type.name, modifier: m.modifier }),
      ) as TypeMatchupInfo[]
      const typeImmunities = ((typeImmunitiesRaw ?? []) as unknown as { attacking_type: { name: string }; defending_type: { name: string } }[]).map((i) => ({
        attacking_type: i.attacking_type.name,
        defending_type: i.defending_type.name,
      })) as TypeImmunityInfo[]

      const effectiveness = effectivenessFor(move.types?.name, targetType1, targetType2 ?? undefined, typeMatchups, typeImmunities)
      isImmune = effectiveness?.immune ?? false
      // Immune always means 0 damage, full stop -- matching the Pokemon page's own display
      // precedence (checks `.immune` before trusting the adjusted dice count at all), since
      // effectivenessFor's `dice: 0` for an immune result is a sentinel, not "no dice adjustment."
      damageDice = isImmune ? null : move.damage_dice ? adjustDiceCount(move.damage_dice, effectiveness?.dice ?? 0) : null
      effectivenessLabel = effectiveness?.label ?? null
    }
  }

  return {
    hit,
    roll: d20Roll,
    toHitModifier,
    targetNumber,
    targetStatLabel: TARGET_STAT_LABELS[targetStatKey],
    moveName: move.name,
    isDamageMove,
    damageDice,
    damageModifier,
    effectivenessLabel,
    isImmune,
  }
}
