'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadEggSnapshot, type EggSnapshot } from '@/lib/pta3/eggs'
import {
  parseEggHatchRate,
  computeSleepsRequired,
  naturalEdgeBonus,
  computeNaturalEdgeStatOptions,
  type NaturalEdgeStatChoice,
  type NaturalEdgeStatOption,
} from '@/lib/pta3/eggHatching'
import { trainerHasBaseClassFeature, loadQualifyingMilestones, computeEffectiveStats } from '@/lib/pta3/trainerFeatures'
import { statModifier } from '@/lib/pta3/pointBuy'
import { pickRandomNatureId } from '@/lib/pta3/nature'
import { pickRandomGender } from '@/lib/pta3/gender'
import { pickFlavorPreferences } from '@/lib/pta3/flavors'
import { findNextOpenSlot } from '@/lib/pta3/pokemonTeam'
import { setOriginalTrainerIfUnset } from '@/lib/pta3/pokemonOrigin'
import { addToBag } from '@/app/(authenticated)/trainers/[id]/bag/actions'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

// [[Feature - Add Egg hatching logic]]: "A normal Trainer can only hatch 1 Egg at a time" -- no class
// distinction on the cap itself, only Hatcher's speed reduction is class-specific (per the FR's own
// resolved assumption). trainersItemId is the specific Egg stack row to consume one unit from --
// its own pokedex_id/nature_id (already chosen at grant/Breeding-Check time) carry straight onto the
// new pokemon_eggs row.
export async function startHatchingEgg(trainerId: string, trainersItemId: string): Promise<{ error: string } | EggSnapshot> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: existing } = await supabase.from('pokemon_eggs').select('id').eq('trainer_id', trainerId).maybeSingle()
  if (existing) {
    return { error: 'This Trainer already has an Egg hatching — only one at a time' }
  }

  const { data: row } = await supabase
    .from('trainers_items')
    .select('id, quantity, pokedex_id, nature_id, items!inner(name)')
    .eq('id', trainersItemId)
    .eq('trainer_id', trainerId)
    .maybeSingle()

  if (!row || row.items?.name !== 'Egg') {
    return { error: 'Egg not found in this Bag' }
  }
  if (row.pokedex_id === null) {
    return { error: 'This Egg has no species chosen yet — re-grant it with a species selected first' }
  }

  const { data: species } = await supabase.from('pokedex').select('egg_hatch_rate').eq('id', row.pokedex_id).maybeSingle()
  const rawDays = species ? parseEggHatchRate(species.egg_hatch_rate) : null
  if (rawDays === null) {
    return { error: 'This species’ Egg Hatch Rate could not be read' }
  }

  const hasHatcher = await trainerHasBaseClassFeature(supabase, trainerId, 'Hatcher')
  const sleepsRequired = computeSleepsRequired(rawDays, hasHatcher)

  const { error: insertError } = await supabase.from('pokemon_eggs').insert({
    trainer_id: trainerId,
    trainers_item_id: row.id,
    pokedex_id: row.pokedex_id,
    inherited_nature_id: row.nature_id,
    sleeps_required: sleepsRequired,
  })
  if (insertError) return { error: insertError.message }

  // Consumes one unit of the Egg stack immediately -- same "used up on selection" logic as every
  // other consumable (discardItem/useItem's own quantity-then-delete shape).
  if (row.quantity > 1) {
    const { error } = await supabase.from('trainers_items').update({ quantity: row.quantity - 1 }).eq('id', row.id)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase.from('trainers_items').delete().eq('id', row.id)
    if (error) return { error: error.message }
  }

  return loadEggSnapshot(supabase, trainerId)
}

// [[Feature - Add a 'Stop hatching' functionality for the hatching section]]: abandons the in-progress
// Egg and returns it to the Bag, so a Trainer can start hatching a different one. Deleting the
// `pokemon_eggs` row is what "resets the days" -- sleeps_completed lives only on that row, so there's
// nothing else to clear. Deliberately doesn't try to restore the exact original `trainers_items` row
// this Egg was consumed from (it may already be gone, e.g. if that stack was down to quantity 1) --
// `addToBag` re-stacks it (or inserts a fresh row) by species/nature, same as any other Egg grant.
export async function stopHatchingEgg(trainerId: string): Promise<{ error: string } | EggSnapshot> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: egg } = await supabase
    .from('pokemon_eggs')
    .select('id, pokedex_id, inherited_nature_id')
    .eq('trainer_id', trainerId)
    .maybeSingle()
  if (!egg) return { error: 'No Egg is currently hatching' }

  const { data: eggItem } = await supabase.from('items').select('id').eq('name', 'Egg').maybeSingle()
  if (!eggItem) return { error: 'Egg item not found' }

  const addResult = await addToBag(supabase, trainerId, eggItem.id, null, egg.pokedex_id, 1, egg.inherited_nature_id)
  if ('error' in addResult) return addResult

  const { error: deleteError } = await supabase.from('pokemon_eggs').delete().eq('id', egg.id)
  if (deleteError) return { error: deleteError.message }

  return loadEggSnapshot(supabase, trainerId)
}

const NATURAL_EDGE_BONUS_COLUMN: Record<NaturalEdgeStatChoice, string> = {
  attack: 'bonus_base_atk',
  defense: 'bonus_base_def',
  special_attack: 'bonus_base_sp_atk',
  special_defense: 'bonus_base_sp_def',
  speed: 'bonus_base_speed',
}

export type NaturalEdgePreview = {
  natureName: string
  options: NaturalEdgeStatOption[]
}

// Renders the Hatch screen's stat-preview table for a Natural Edge Trainer, per the user (2026-09-04):
// shows each of the 5 candidate stats' actual total (base + Nature, matching the Pokémon page's own
// computeStatRows convention) both as-is and with the bonus applied, so the pick is informed rather
// than blind. Only ever called for a Trainer who actually has Natural Edge -- the caller's UI gates it.
//
// Side effect, deliberately: if the Egg's nature isn't already fixed (a GM-granted/manually-tagged Egg
// with no inherited nature), this rolls and LOCKS IN a real nature onto the `pokemon_eggs` row right
// now, rather than only when Hatch is actually confirmed. Natural Edge's own text requires knowing the
// nature before picking a stat, so the player needs to see a real, final nature here -- rolling a
// *different* one later at confirm time would make this whole preview meaningless. `hatchEgg` below
// then finds `inherited_nature_id` already set and reuses it rather than rolling again, so the two
// calls can never disagree.
export async function previewNaturalEdgeHatch(trainerId: string, eggId: string): Promise<{ error: string } | NaturalEdgePreview> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: egg } = await supabase
    .from('pokemon_eggs')
    .select('id, pokedex_id, inherited_nature_id')
    .eq('id', eggId)
    .eq('trainer_id', trainerId)
    .maybeSingle()
  if (!egg) return { error: 'Egg not found' }

  let natureId = egg.inherited_nature_id
  if (natureId === null) {
    natureId = await pickRandomNatureId(supabase)
    if (natureId !== null) {
      const { error } = await supabase.from('pokemon_eggs').update({ inherited_nature_id: natureId }).eq('id', eggId)
      if (error) return { error: error.message }
    }
  }

  const { data: nature } = natureId
    ? await supabase
        .from('natures')
        .select('name, increased:stats!increased_stat_id(name), decreased:stats!decreased_stat_id(name)')
        .eq('id', natureId)
        .maybeSingle()
    : { data: null }
  const natureRow = nature as unknown as { name: string; increased: { name: string } | null; decreased: { name: string } | null } | null

  const { data: species } = await supabase
    .from('pokedex')
    .select('base_atk, base_def, base_sp_atk, base_sp_def, base_speed')
    .eq('id', egg.pokedex_id)
    .maybeSingle()
  if (!species) return { error: 'Species not found' }

  const bonus = await computeNaturalEdgeBonus(supabase, trainerId)
  const options = computeNaturalEdgeStatOptions(
    {
      attack: species.base_atk,
      defense: species.base_def,
      special_attack: species.base_sp_atk,
      special_defense: species.base_sp_def,
      speed: species.base_speed,
    },
    natureRow?.increased?.name ?? null,
    natureRow?.decreased?.name ?? null,
    bonus,
  )

  return { natureName: natureRow?.name ?? 'Unknown', options }
}

export type HatchResult = { error: string } | { ok: true; pokemonId: string; snapshot: EggSnapshot }

// The explicit "Hatch" completion action, per this FR's resolved design: creates the real `pokemon`
// row (species/nature already known) and deletes the `pokemon_eggs` row -- also where Natural Edge's
// stat pick happens, in the same flow/moment ("after you know the Pokémon's nature"), not a separate
// follow-up step. `naturalEdgeChoice` is required (and validated) only when the Trainer actually has
// Natural Edge -- the caller's UI only ever renders/submits it after the player has seen
// `previewNaturalEdgeHatch`'s preview, which is also what locks in a random nature if the Egg didn't
// already carry one.
export async function hatchEgg(
  trainerId: string,
  eggId: string,
  naturalEdgeChoice?: { targetStat: NaturalEdgeStatChoice } | null,
): Promise<HatchResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: egg } = await supabase
    .from('pokemon_eggs')
    .select('id, pokedex_id, inherited_nature_id, sleeps_completed, sleeps_required')
    .eq('id', eggId)
    .eq('trainer_id', trainerId)
    .maybeSingle()

  if (!egg) return { error: 'Egg not found' }
  if (egg.sleeps_completed < egg.sleeps_required) {
    return { error: 'This Egg is not ready to hatch yet' }
  }

  const { data: species } = await supabase.from('pokedex').select('base_hp').eq('id', egg.pokedex_id).maybeSingle()
  if (!species) return { error: 'Species not found' }

  const hasNaturalEdge = await trainerHasBaseClassFeature(supabase, trainerId, 'Natural Edge')
  if (hasNaturalEdge && !naturalEdgeChoice) {
    return { error: 'Choose a stat for Natural Edge before hatching' }
  }

  // Bred via [[Feature - Add a Pokemon Breeding Check mechanic]] carries a pre-chosen nature through;
  // a GM-granted/manually-tagged Egg gets the usual fully-random roll instead. For a Natural Edge
  // Trainer this is already locked in by `previewNaturalEdgeHatch` (called before this), so this
  // `pickRandomNatureId` fallback only ever actually rolls for a Trainer without Natural Edge, who
  // skips the preview screen entirely.
  const natureId = egg.inherited_nature_id ?? (await pickRandomNatureId(supabase))
  // Natural Breeder's gender-pick override is explicitly out of this FR's scope (flagged, not built)
  // -- always randomly rolled for now, same as every other Pokemon-creation flow.
  const gender = pickRandomGender()

  const [{ data: obtainMethod }, { data: startingLoyalty }] = await Promise.all([
    supabase.from('obtain_methods').select('id').eq('name', 'Hatched').maybeSingle(),
    // Per the user (2026-09-04): "most hatched Pokemon start at loyalty 2 once they imprint on you" --
    // this is the `loyalties` table's own tier-2 description text, not an invented rule. Looked up by
    // `sort_order` rather than hardcoding the point value, so this stays correct if the loyalty scale
    // is ever retuned.
    supabase.from('loyalties').select('min_points').eq('sort_order', 2).maybeSingle(),
  ])

  // Generate the id up front -- same RETURNING-requires-SELECT-policy reasoning as the starter and
  // GM-creation Pokemon flows (a freshly inserted row has no trainers_pokemon link yet to pass the
  // owner-can-view policy).
  const pokemonId = crypto.randomUUID()
  const { error: pokemonError } = await supabase.from('pokemon').insert({
    id: pokemonId,
    pokedex_id: egg.pokedex_id,
    current_hp: species.base_hp,
    nature_id: natureId,
    gender,
    loyalty_points: startingLoyalty?.min_points ?? 0,
  })
  if (pokemonError) return { error: pokemonError.message }

  // The trainers_pokemon link has to exist before anything below tries to UPDATE this pokemon row --
  // "Owners can update their pokemon" RLS is granted via that join, unlike INSERT (any authenticated
  // user) or pokemon_flavor_preferences (which has its own "creator of a not-yet-linked pokemon"
  // policy for exactly this ordering). A hatched Pokemon joins the Team if there's an open slot,
  // otherwise the PC -- same findNextOpenSlot-decides shape as the starter flow, just without that
  // flow's "always Team" assumption (a Trainer hatching an Egg usually already has Pokemon).
  const { data: existingSlots } = await supabase.from('trainers_pokemon').select('party_slot').eq('trainer_id', trainerId)
  const nextSlot = findNextOpenSlot((existingSlots ?? []).map((r) => r.party_slot))

  const { error: linkError } = await supabase.from('trainers_pokemon').insert({
    trainer_id: trainerId,
    pokemon_id: pokemonId,
    obtain_method_id: obtainMethod?.id ?? null,
    party_slot: nextSlot,
  })
  if (linkError) return { error: linkError.message }

  await setOriginalTrainerIfUnset(supabase, pokemonId, trainerId, obtainMethod?.id ?? null)

  if (hasNaturalEdge && naturalEdgeChoice) {
    const bonus = await computeNaturalEdgeBonus(supabase, trainerId)
    if (bonus > 0) {
      const column = NATURAL_EDGE_BONUS_COLUMN[naturalEdgeChoice.targetStat]
      const { error: bonusError } = await supabase.from('pokemon').update({ [column]: bonus }).eq('id', pokemonId)
      if (bonusError) return { error: bonusError.message }
    }
  }

  const flavorPrefs = await pickFlavorPreferences(supabase)
  if (flavorPrefs.length > 0) {
    await supabase.from('pokemon_flavor_preferences').insert(flavorPrefs.map((p) => ({ pokemon_id: pokemonId, flavor_id: p.flavorId, liked: p.liked })))
  }

  const { error: deleteError } = await supabase.from('pokemon_eggs').delete().eq('id', eggId)
  if (deleteError) return { error: deleteError.message }

  const snapshot = await loadEggSnapshot(supabase, trainerId)
  return { ok: true, pokemonId, snapshot }
}

async function computeNaturalEdgeBonus(supabase: SupabaseClient, trainerId: string): Promise<number> {
  const { data: trainer } = await supabase
    .from('trainers')
    .select('level, base_attack, base_defense, base_special_attack, base_special_defense, base_speed')
    .eq('id', trainerId)
    .maybeSingle()
  if (!trainer) return 0

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
  // Always the higher of the two, per the user (2026-09-04) -- no picker needed, this is now fully
  // determined by the Trainer's own stats.
  return naturalEdgeBonus(statModifier(effective.defense), statModifier(effective.special_defense))
}
