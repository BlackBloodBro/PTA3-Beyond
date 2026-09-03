import type { SupabaseClient } from '@supabase/supabase-js'
import { computeLoyaltyTier } from './pokemonLevel'

export type BreedingCandidate = {
  id: string
  name: string
  speciesName: string
  pokedexId: number
  gender: string | null
  loyaltyTier: number
  trainerId: string
  trainerName: string
  trainerIsNpc: boolean
}

// [[Feature - Add a Pokemon Breeding Check mechanic]]: maps a Pokemon's current Loyalty tier
// (computeLoyaltyTier's own sort_order, 0-5, already shown as "Tier: N" everywhere else in this app)
// to its Breeding Check roll bonus. Applied once per parent Pokemon (twice total per attempt).
export const LOYALTY_TIER_BREEDING_BONUS: Record<number, number> = { 0: -5, 1: -3, 2: 0, 3: 2, 4: 5, 5: 8 }

// +2 per hour of privacy beyond the required 4, capped at +10 (reached at 9 total hours) -- per the
// user's exact rule text.
export function privacyBonus(hoursOfPrivacy: number): number {
  return Math.min(10, Math.max(0, Math.floor(hoursOfPrivacy) - 4) * 2)
}

export type FriendshipContext = {
  aTrainerIsNpc: boolean
  bTrainerIsNpc: boolean
  sameTrainer: boolean
  samePokedexId: boolean
}

// Resolved with the user (2026-09-03): the single highest applicable tier, not additive stacking --
// Unfamiliar/Familiar/Friends/Romantic read as one ascending scale.
export function friendshipBonus(ctx: FriendshipContext): number {
  if (ctx.samePokedexId) return 8 // Romantic
  if (ctx.sameTrainer) return 5 // Friends
  if (!ctx.aTrainerIsNpc && !ctx.bTrainerIsNpc) return 2 // Familiar
  return 0 // Unfamiliar
}

// Base target number a physically-rolled d100 must land equal-or-under -- the app computes this,
// the table rolls for real, same convention as Sleep's HP-recovery d6.
export function breedingTargetNumber(params: {
  hoursOfPrivacy: number
  loyaltyTierA: number
  loyaltyTierB: number
  friendship: FriendshipContext
}): number {
  return (
    15 +
    privacyBonus(params.hoursOfPrivacy) +
    (LOYALTY_TIER_BREEDING_BONUS[params.loyaltyTierA] ?? 0) +
    (LOYALTY_TIER_BREEDING_BONUS[params.loyaltyTierB] ?? 0) +
    friendshipBonus(params.friendship)
  )
}

// [[Feature - Apply unconditional Class Feature stat bonuses]]'s own established pattern: check a
// Trainer's resolved base-Class Features by name (class_id + level_required <= level), not a stored
// flag. Only ever base-Class Features here (subclass_id null) -- every Breeder Feature this mechanic
// cares about (Egg Finder, Unexpected Hatch, Unlikely Pairings, Matchmaker) is base-Class, not
// Subclass-gated.
export async function trainerHasBaseClassFeature(supabase: SupabaseClient, trainerId: string, featureName: string): Promise<boolean> {
  const { data: trainer } = await supabase.from('trainers').select('class_id, level').eq('id', trainerId).maybeSingle()
  if (!trainer) return false
  const { data: feature } = await supabase
    .from('features')
    .select('id')
    .eq('class_id', trainer.class_id)
    .is('subclass_id', null)
    .eq('name', featureName)
    .lte('level_required', trainer.level)
    .maybeSingle()
  return !!feature
}

// [[Feature - Add a Pokemon Breeding Check mechanic]]: every Pokemon belonging to a *player* Trainer in
// a Campaign -- the breeding pool a Campaign Trainer picks from, shared by both the player-Trainer and
// NPC "Breeding" page variants (same shape as BagBoard.tsx being shared across its own 3 page.tsx
// variants) so the query/mapping isn't duplicated. Deliberately excludes NPC-owned Pokemon at the query
// level, not just in the UI -- per the user (2026-09-03), a player Trainer shouldn't be able to select
// an NPC's Pokemon at all for now (an earlier opt-in "Include NPC Pokemon" toggle was tried and then
// deliberately removed); a real flow for picking an NPC's Pokemon is being designed separately as its
// own Concept.
export async function loadCampaignBreedingCandidates(supabase: SupabaseClient, campaignId: string): Promise<BreedingCandidate[]> {
  const [{ data: pokemonRows }, { data: loyaltyRows }] = await Promise.all([
    supabase
      .from('trainers_pokemon')
      .select(
        `
        trainer_id,
        pokemon(id, nickname, gender, pokedex_id, loyalty_points, nature_id, pokedex(name)),
        trainers!inner(id, name, is_npc, campaign_id)
      `,
      )
      .eq('trainers.campaign_id', campaignId)
      .eq('trainers.is_npc', false),
    supabase.from('loyalties').select('name, sort_order, min_points'),
  ])

  // Reverse/forward-embed quirk documented throughout this codebase -- `pokemon` and `trainers` both
  // come back as single objects at runtime here, not the arrays TS infers from a plural table name.
  type Row = {
    trainer_id: string
    pokemon: { id: string; nickname: string | null; gender: string | null; pokedex_id: number; loyalty_points: number; nature_id: number | null; pokedex: { name: string } | null } | null
    trainers: { id: string; name: string; is_npc: boolean; campaign_id: string | null } | null
  }

  return ((pokemonRows ?? []) as unknown as Row[])
    .filter((r) => r.pokemon && r.trainers)
    .map((r) => ({
      id: r.pokemon!.id,
      name: r.pokemon!.nickname ?? r.pokemon!.pokedex?.name ?? 'Unknown',
      speciesName: r.pokemon!.pokedex?.name ?? 'Unknown',
      pokedexId: r.pokemon!.pokedex_id,
      gender: r.pokemon!.gender,
      loyaltyTier: computeLoyaltyTier(r.pokemon!.loyalty_points, loyaltyRows ?? [])?.sort_order ?? 0,
      trainerId: r.trainers!.id,
      trainerName: r.trainers!.name,
      trainerIsNpc: r.trainers!.is_npc,
    }))
}
