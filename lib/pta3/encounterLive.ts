import type { createClient } from '@/lib/supabase/server'
import { singleWithRetry } from '@/lib/supabase/retrySingle'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

// [[Bug - Combat encounter page is slow, fails to load, and ejects players]]: the live, mid-fight state of
// an Encounter -- only what actually changes while it's running. Everything else on the page (names,
// sprites, types, max HP, who's identified) is static for the life of the render and is NOT re-fetched by
// the poll; a structural change (see structureKey) triggers one full page refresh instead.
export type LiveCombatant = {
  id: string
  currentHp: number
  turnOrder: number | null
}

export type TrainerLiveUses = {
  featureUses: Record<number, number>
  moveUses: Record<string, number | null>
  itemQuantities: Record<string, number>
}

export type EncounterLiveSnapshot = {
  status: string
  currentTurnPosition: number
  combatants: LiveCombatant[]
  // Sorted pokedex ids of this Encounter's enemy Pokemon that have been scanned. Only ever used to detect
  // that someone revealed an enemy (identity data is server-rendered), never to display anything.
  scannedKey: string
  trainers: Record<string, TrainerLiveUses>
  // [[Feature - Mark a target for Critical advice in Encounters (Researcher)]]: ids of combatants carrying a Critical
  // advice mark (sorted), so every viewer's tracker shows the "Marked" badge as it appears. Display-only: not part
  // of structureKey.
  markedCombatantIds: string[]
}

// Anything that changes the *shape* of the page (not just a number on it): the encounter starting/ending,
// a combatant joining/leaving, or an enemy being revealed. These do one full refresh; everything else
// patches in place.
export function structureKey(s: Pick<EncounterLiveSnapshot, 'status' | 'combatants' | 'scannedKey'>): string {
  return `${s.status}|${s.combatants.map((c) => c.id).sort().join(',')}|${s.scannedKey}`
}

export function buildScannedKey(enemyPokedexIds: number[], scannedPokedexIds: Iterable<number>): string {
  const scanned = new Set(scannedPokedexIds)
  return [...new Set(enemyPokedexIds)]
    .filter((id) => scanned.has(id))
    .sort((a, b) => a - b)
    .join(',')
}

// Shared by the server render and the client store so the two can never disagree about whose turn it is.
// Highest turn_order acts first; ties break on id (same deterministic key skip_my_turn() uses in SQL); a
// combatant at 0 HP, or one with no initiative yet, is skipped; current_turn_position is a plain counter
// taken modulo the active list.
export function sortByInitiative<T extends { id: string; turnOrder: number | null }>(list: T[]): T[] {
  return [...list].sort((a, b) => (b.turnOrder ?? -Infinity) - (a.turnOrder ?? -Infinity) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

export function computeCurrentCombatantId(combatants: LiveCombatant[], position: number, isActive: boolean): string | null {
  if (!isActive) return null
  const activeSorted = sortByInitiative(combatants.filter((c) => c.currentHp > 0 && c.turnOrder !== null))
  if (activeSorted.length === 0) return null
  return activeSorted[position % activeSorted.length].id
}

type CombatantQueryRow = {
  id: string
  side: 'ally' | 'enemy'
  turn_order: number | null
  trainer_id: string | null
  pokemon_id: string | null
  trainers: { current_hp: number; user_id: string } | null
  pokemon: { current_hp: number; pokedex_id: number } | null
}

// One cheap read of the live state, for the poll endpoint. A handful of small queries (two in parallel,
// then up to four) instead of re-running the whole page. Returns null when the Encounter isn't visible to
// this viewer (RLS) or doesn't exist.
export async function loadEncounterLiveSnapshot(
  supabase: SupabaseClient,
  encounterId: string,
  userId: string,
): Promise<EncounterLiveSnapshot | null> {
  const [{ data: encounter }, { data: rows, error: rowsError }] = await Promise.all([
    singleWithRetry(() =>
      supabase.from('encounters').select('status, current_turn_position, campaign_id, campaigns(gm_user_id)').eq('id', encounterId).maybeSingle(),
    ),
    singleWithRetry(() =>
      supabase
        .from('encounter_combatants')
        .select('id, side, turn_order, trainer_id, pokemon_id, trainers(current_hp, user_id), pokemon(current_hp, pokedex_id)')
        .eq('encounter_id', encounterId),
    ),
  ])
  if (!encounter) return null
  // A read that failed twice must not look like "everyone left the fight" -- the client would treat that as
  // a structural change. Throw so the endpoint answers with an error and the client just keeps its last state.
  if (rowsError) throw new Error(rowsError.message)

  const campaign = encounter.campaigns as unknown as { gm_user_id: string } | null
  const isGM = campaign?.gm_user_id === userId
  const combatants = (rows ?? []) as unknown as CombatantQueryRow[]

  const enemyPokedexIds = combatants.filter((c) => c.side === 'enemy' && c.pokemon).map((c) => c.pokemon!.pokedex_id)
  // Same eligibility the Trainer actions panel already uses: the GM sees every Trainer combatant, a member only their own.
  const eligibleTrainerIds = combatants
    .filter((c) => c.trainers && c.trainer_id && (isGM || c.trainers.user_id === userId))
    .map((c) => c.trainer_id as string)

  const [scannedRes, featureRes, moveRes, itemRes, markRes] = await Promise.all([
    enemyPokedexIds.length > 0
      ? supabase.from('campaign_scanned_species').select('pokedex_id').eq('campaign_id', encounter.campaign_id).in('pokedex_id', enemyPokedexIds)
      : Promise.resolve({ data: [] as { pokedex_id: number }[] }),
    eligibleTrainerIds.length > 0
      ? supabase.from('trainer_feature_uses').select('trainer_id, feature_id, uses_remaining').in('trainer_id', eligibleTrainerIds)
      : Promise.resolve({ data: [] as { trainer_id: string; feature_id: number; uses_remaining: number }[] }),
    eligibleTrainerIds.length > 0
      ? supabase.from('trainer_moves').select('trainer_id, uses_remaining, moves(name)').in('trainer_id', eligibleTrainerIds)
      : Promise.resolve({ data: [] }),
    eligibleTrainerIds.length > 0
      ? supabase.from('trainers_items').select('id, trainer_id, quantity').in('trainer_id', eligibleTrainerIds)
      : Promise.resolve({ data: [] as { id: string; trainer_id: string; quantity: number }[] }),
    combatants.length > 0
      ? supabase.from('encounter_target_marks').select('target_combatant_id').in('target_combatant_id', combatants.map((c) => c.id))
      : Promise.resolve({ data: [] as { target_combatant_id: string }[] }),
  ])

  const trainers: Record<string, TrainerLiveUses> = {}
  for (const id of eligibleTrainerIds) trainers[id] = { featureUses: {}, moveUses: {}, itemQuantities: {} }
  for (const r of featureRes.data ?? []) trainers[r.trainer_id].featureUses[r.feature_id] = r.uses_remaining
  for (const r of (moveRes.data ?? []) as unknown as { trainer_id: string; uses_remaining: number | null; moves: { name: string } | null }[]) {
    if (r.moves) trainers[r.trainer_id].moveUses[r.moves.name] = r.uses_remaining
  }
  for (const r of itemRes.data ?? []) trainers[r.trainer_id].itemQuantities[r.id] = r.quantity

  return {
    status: encounter.status,
    currentTurnPosition: encounter.current_turn_position,
    combatants: combatants.map((c) => ({
      id: c.id,
      currentHp: c.trainers ? c.trainers.current_hp : (c.pokemon?.current_hp ?? 0),
      turnOrder: c.turn_order,
    })),
    scannedKey: buildScannedKey(enemyPokedexIds, (scannedRes.data ?? []).map((r) => r.pokedex_id)),
    trainers,
    markedCombatantIds: (markRes.data ?? []).map((r) => r.target_combatant_id as string).sort(),
  }
}
