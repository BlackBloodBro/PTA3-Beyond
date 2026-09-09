'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadQualifyingMilestones, computeEffectiveStats, loadTrainerDerived, type StatColumn } from '@/lib/pta3/trainerFeatures'
import { statModifier } from '@/lib/pta3/pointBuy'
import { loadPokemonEffectiveStats, loadPokemonEffectiveType } from '@/lib/pta3/pokemonStats'
import { resolveAccuracyStat, stabBonus, effectivenessFor, adjustDiceCount, type TypeMatchupInfo, type TypeImmunityInfo } from '@/lib/pta3/combatMath'
import { grantPokemonTemporaryHp } from '@/app/(authenticated)/pokemon/actions'

export type AccuracyResult =
  | { error: string }
  | {
      hit: boolean
      roll: number
      toHitModifier: number
      targetNumber: number
      targetStatLabel: string
      moveName: string
      moveDescription: string | null
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
    supabase.from('moves').select('name, damage_stat, damage_dice, description, types(name)').eq('id', moveId).single(),
  ])
  // Same reverse-embed quirk documented throughout this codebase -- types comes back as a single
  // object at runtime, not the array TS infers.
  const move = moveRaw as unknown as {
    name: string
    damage_stat: string
    damage_dice: string | null
    description: string | null
    types: { name: string } | null
  } | null

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
    moveDescription: move.description,
    isDamageMove,
    damageDice,
    damageModifier,
    effectivenessLabel,
    isImmune,
  }
}

export type AffirmationResult = { granted: number; triggers: ('ko' | 'critical')[] }

// [[Feature - Grant temporary HP on Affirmation (Ace trainer)]]: called right after a hit's damage is
// applied, once both triggers this Feature cares about are actually knowable -- a KO only exists once
// the target's resulting HP is in hand, a critical hit (per the user, 2026-09-09: a natural 20 on the
// Accuracy Check's d20, no modifier) is already known from the same roll the player already entered.
// No new UI at all -- both signals come from data the app already has. Per the user: the bonus is
// always the *higher* of the Trainer's own Attack/Special Attack modifier, regardless of which stat the
// triggering Move actually used (unlike resolveAccuracyStat's per-Move split) -- and each true trigger
// grants independently, stacking via grantPokemonTemporaryHp's own existing additive behavior (so a hit
// that's both a KO and a crit grants twice, once per trigger).
export async function maybeGrantAffirmationBonus(attackerPokemonId: string, isKo: boolean, isCrit: boolean): Promise<AffirmationResult> {
  const none: AffirmationResult = { granted: 0, triggers: [] }
  if (!isKo && !isCrit) return none

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // A Pokemon has at most one current owning Trainer (trainers_pokemon is keyed by pokemon_id) --
  // none for a Wild Pokemon, which can't have resolved any Trainer Feature.
  const { data: link } = await supabase.from('trainers_pokemon').select('trainer_id').eq('pokemon_id', attackerPokemonId).maybeSingle()
  if (!link) return none

  const { data: trainer } = await supabase
    .from('trainers')
    .select('class_id, level, base_attack, base_defense, base_special_attack, base_special_defense, base_speed')
    .eq('id', link.trainer_id)
    .maybeSingle()
  if (!trainer || trainer.class_id === null) return none

  // Same "check the owning Trainer's resolved Features by name" pattern
  // [[Feature - Apply unconditional Class Feature stat bonuses]] already uses -- Affirmation is
  // unconditional/passive (requires_activation: false), so it can show up in either list depending on
  // how a future Feature-audit pass categorizes it; checking both is cheap and correct either way.
  const { activeFeatures, passiveFeatures } = await loadTrainerDerived(supabase, link.trainer_id, { classId: trainer.class_id, level: trainer.level })
  if (![...activeFeatures, ...passiveFeatures].some((f) => f.name === 'Affirmation')) return none

  const milestones = await loadQualifyingMilestones(supabase, link.trainer_id, trainer.level)
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
  const bonus = Math.max(statModifier(effective.attack), statModifier(effective.special_attack))
  if (bonus <= 0) return none

  const triggers: ('ko' | 'critical')[] = []
  if (isKo) triggers.push('ko')
  if (isCrit) triggers.push('critical')

  for (const _trigger of triggers) {
    await grantPokemonTemporaryHp(attackerPokemonId, bonus)
  }

  return { granted: bonus * triggers.length, triggers }
}
