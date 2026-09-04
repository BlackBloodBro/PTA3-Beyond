'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { grantItem } from '@/app/(authenticated)/trainers/[id]/bag/actions'
import { breedingTargetNumber, type FriendshipContext } from '@/lib/pta3/breeding'
import { computeLoyaltyTier } from '@/lib/pta3/pokemonLevel'
import { trainerHasBaseClassFeature } from '@/lib/pta3/trainerFeatures'
import { resolveBaseSpeciesId } from '@/lib/pta3/evolution'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

type ParentInfo = {
  id: string
  gender: string | null
  pokedexId: number
  loyaltyPoints: number
  natureId: number | null
  trainerId: string
  trainerIsNpc: boolean
  campaignId: string | null
}

async function loadParent(supabase: SupabaseClient, pokemonId: string): Promise<ParentInfo | { error: string }> {
  const { data } = await supabase
    .from('pokemon')
    .select('id, gender, pokedex_id, loyalty_points, nature_id, trainers_pokemon(trainer_id, trainers(id, is_npc, campaign_id))')
    .eq('id', pokemonId)
    .maybeSingle()

  if (!data) return { error: 'Pokemon not found' }

  // trainers_pokemon.pokemon_id is a primary key, so this reverse embed (and the nested forward
  // embed to trainers inside it) both come back as single objects at runtime, not the arrays TS
  // infers -- same quirk documented throughout this codebase.
  const link = data.trainers_pokemon as unknown as { trainer_id: string; trainers: { id: string; is_npc: boolean; campaign_id: string | null } | null } | null

  if (!link || !link.trainers) {
    return { error: 'Both Pokemon must belong to a Trainer to attempt a Breeding Check' }
  }

  return {
    id: data.id,
    gender: data.gender,
    pokedexId: data.pokedex_id,
    loyaltyPoints: data.loyalty_points,
    natureId: data.nature_id,
    trainerId: link.trainer_id,
    trainerIsNpc: link.trainers.is_npc,
    campaignId: link.trainers.campaign_id,
  }
}

// Server-side re-validation of every eligibility gate -- the picker UI only ever offers pairs that
// already look eligible, but that's a convenience filter, never the actual authorization, same
// "never trust the client's own filtering alone" principle as everywhere else in this app.
//
// [[Feature - Add a Pokemon Breeding Check mechanic]]: `campaignId` is null for a campaign-less
// Trainer -- found during Testing (per the user) that a campaign-less Trainer had no way to breed at
// all. Without a Campaign there's no "any Trainer in the same Campaign" pool and no GM to arbitrate an
// NPC pairing, so the only sensible scope is the initiating Trainer's own two Pokemon, paired with each
// other -- a narrower rule than the Campaign case's "own at least one of the two."
async function validateEligibility(
  supabase: SupabaseClient,
  campaignId: string | null,
  initiatingTrainerId: string,
  a: ParentInfo,
  b: ParentInfo,
  hoursOfPrivacy: number,
): Promise<{ error: string } | { ok: true }> {
  if (campaignId) {
    if (a.campaignId !== campaignId || b.campaignId !== campaignId) {
      return { error: 'Both Pokemon must belong to a Trainer in this Campaign' }
    }
    if (a.trainerId !== initiatingTrainerId && b.trainerId !== initiatingTrainerId) {
      return { error: 'You must own at least one of the two Pokemon' }
    }
  } else if (a.trainerId !== initiatingTrainerId || b.trainerId !== initiatingTrainerId) {
    return { error: 'Without a Campaign, you can only breed your own Pokemon with each other' }
  }
  const genders = [a.gender, b.gender].sort()
  if (genders[0] !== 'female' || genders[1] !== 'male') {
    return { error: 'The two Pokemon must have opposite genders (one Male, one Female)' }
  }
  if (hoursOfPrivacy < 4) {
    return { error: 'The pair needs at least 4 hours of privacy to attempt a Breeding Check' }
  }

  const [{ data: afflictionsA }, { data: afflictionsB }] = await Promise.all([
    supabase.from('pokemon_afflictions').select('affliction_id').eq('pokemon_id', a.id),
    supabase.from('pokemon_afflictions').select('affliction_id').eq('pokemon_id', b.id),
  ])
  if ((afflictionsA ?? []).length > 0 || (afflictionsB ?? []).length > 0) {
    return { error: 'Neither Pokemon can have an active Affliction' }
  }

  if (a.pokedexId !== b.pokedexId) {
    const [{ data: groupsA }, { data: groupsB }] = await Promise.all([
      supabase.from('pokedex_egg_groups').select('egg_group_id').eq('pokedex_id', a.pokedexId),
      supabase.from('pokedex_egg_groups').select('egg_group_id').eq('pokedex_id', b.pokedexId),
    ])
    const groupIdsA = new Set((groupsA ?? []).map((g) => g.egg_group_id))
    const sharesGroup = (groupsB ?? []).some((g) => groupIdsA.has(g.egg_group_id))
    if (!sharesGroup) {
      const hasUnlikelyPairings = await trainerHasBaseClassFeature(supabase, initiatingTrainerId, 'Unlikely Pairings')
      if (!hasUnlikelyPairings) {
        return { error: 'The two Pokemon must share an Egg Group (unless you have Unlikely Pairings)' }
      }
    }
  }

  return { ok: true }
}

export type BreedingCheckResult =
  | { error: string }
  | { success: false; targetNumber: number; roll: number }
  | { success: true; targetNumber: number; roll: number; eggPokedexId: number; eggNatureId: number | null }

// [[Feature - Add a Pokemon Breeding Check mechanic]]: the initiating Trainer attempts a Breeding
// Check between two Pokemon. `roll` is the player's own physically-rolled d100 result (best of three
// if they have Egg Finder -- the app only ever needs the one final number, same trust-the-table's-own-
// dice convention as Sleep's HP roll). `coinFlipHeads` is only consulted if the initiating Trainer has
// Unexpected Hatch resolved AND the check succeeds. Matchmaker's guaranteed-success/full-trait-control
// override is deliberately not built here -- flagged as its own small follow-up once this base
// mechanic exists, same shape as every other Feature-on-top-of-a-base-mechanic pattern this session.
export async function attemptBreedingCheck(
  campaignId: string | null,
  initiatingTrainerId: string,
  pokemonIdA: string,
  pokemonIdB: string,
  hoursOfPrivacy: number,
  roll: number,
  coinFlipHeads: boolean,
): Promise<BreedingCheckResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 4 is the minimum to attempt at all; privacyBonus's own formula already caps the bonus at 9 hours
  // (+10) regardless, so clamping here just keeps the stored/displayed value consistent with what the
  // UI offers -- never trust the client's own <input min/max> alone, same principle as every other
  // gate in this action.
  const clampedHours = Math.max(4, Math.min(9, Math.floor(hoursOfPrivacy)))

  const [a, b] = await Promise.all([loadParent(supabase, pokemonIdA), loadParent(supabase, pokemonIdB)])
  if ('error' in a) return a
  if ('error' in b) return b

  const eligible = await validateEligibility(supabase, campaignId, initiatingTrainerId, a, b, clampedHours)
  if ('error' in eligible) return eligible

  const { data: loyaltyRows } = await supabase.from('loyalties').select('name, sort_order, min_points')
  const tierA = computeLoyaltyTier(a.loyaltyPoints, loyaltyRows ?? [])?.sort_order ?? 0
  const tierB = computeLoyaltyTier(b.loyaltyPoints, loyaltyRows ?? [])?.sort_order ?? 0

  const friendship: FriendshipContext = {
    aTrainerIsNpc: a.trainerIsNpc,
    bTrainerIsNpc: b.trainerIsNpc,
    sameTrainer: a.trainerId === b.trainerId,
    samePokedexId: a.pokedexId === b.pokedexId,
  }

  const targetNumber = breedingTargetNumber({ hoursOfPrivacy: clampedHours, loyaltyTierA: tierA, loyaltyTierB: tierB, friendship })
  const clampedRoll = Math.max(1, Math.min(100, Math.floor(roll)))

  if (clampedRoll > targetNumber) {
    return { success: false, targetNumber, roll: clampedRoll }
  }

  // Species: the FIRST species in the mother's (female parent's) evolution line by default --
  // Unexpected Hatch's coin flip can swap to the father's line instead, only ever consulted when that
  // Feature is actually resolved. Corrected 2026-09-04, per the user: an Egg from an evolved parent
  // should still hatch into the base form of that line, not the parent's own (possibly-evolved) species.
  const mother = a.gender === 'female' ? a : b
  const father = a.gender === 'female' ? b : a
  const hasUnexpectedHatch = await trainerHasBaseClassFeature(supabase, initiatingTrainerId, 'Unexpected Hatch')
  const chosenParentPokedexId = hasUnexpectedHatch && coinFlipHeads ? father.pokedexId : mother.pokedexId
  const eggPokedexId = await resolveBaseSpeciesId(supabase, chosenParentPokedexId)

  // Nature: randomly one of the two parents' own natures -- not stated as a player-rolled mechanic
  // (unlike the main check and Unexpected Hatch's own explicit coin flip), so resolved server-side.
  const eggNatureId = Math.random() < 0.5 ? a.natureId : b.natureId

  const { data: eggItem } = await supabase.from('items').select('id').eq('name', 'Egg').maybeSingle()
  if (!eggItem) {
    return { error: 'Egg item not found in the catalog' }
  }

  const grantResult = await grantItem(initiatingTrainerId, eggItem.id, 1, eggPokedexId, null, eggNatureId)
  if ('error' in grantResult) {
    return { error: grantResult.error }
  }

  return { success: true, targetNumber, roll: clampedRoll, eggPokedexId, eggNatureId }
}
