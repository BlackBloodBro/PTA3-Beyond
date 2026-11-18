'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadEncounterPendingGrants, type PendingGrant } from '@/lib/pta3/pendingGrants'

// [[Feature - Let the GM approve EXP and LP gained in an Encounter]]: the GM's side of the pending EXP/LP totals that
// Move used and Fainted record during an active Encounter (see 20261118200000_encounter_pending_grants.sql). All of
// these are GM only: RLS lets only the Campaign's GM read or delete the rows, and approve_encounter_pending_grant
// re-checks it.

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return supabase
}

function isWholeNumber(n: number) {
  return Number.isInteger(n)
}

export async function loadPendingGrants(encounterId: string): Promise<PendingGrant[]> {
  const supabase = await requireUser()
  return loadEncounterPendingGrants(supabase, encounterId)
}

export async function approvePendingGrant(
  encounterId: string,
  pokemonId: string,
  exp: number,
  loyaltyPoints: number,
): Promise<{ error: string } | { ok: true }> {
  if (!isWholeNumber(exp) || !isWholeNumber(loyaltyPoints)) return { error: 'EXP and LP must be whole numbers' }
  const supabase = await requireUser()
  const { error } = await supabase.rpc('approve_encounter_pending_grant', {
    target_encounter_id: encounterId,
    target_pokemon_id: pokemonId,
    approved_exp: exp,
    approved_loyalty_points: loyaltyPoints,
  })
  if (error) return { error: error.message }
  return { ok: true }
}

// Reject = discard this Pokemon's pending line without applying anything.
export async function rejectPendingGrant(encounterId: string, pokemonId: string): Promise<{ error: string } | { ok: true }> {
  const supabase = await requireUser()
  const { data, error } = await supabase
    .from('encounter_pending_grants')
    .delete()
    .eq('encounter_id', encounterId)
    .eq('pokemon_id', pokemonId)
    .select('pokemon_id')
  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: 'Only the GM can reject pending EXP and LP' }
  return { ok: true }
}

// Approve all = each line with the amounts currently shown (the GM may have edited some). Applied one by one; on the
// first failure it stops and reports which Pokemon, leaving the rest pending.
export async function approveAllPendingGrants(
  encounterId: string,
  lines: { pokemonId: string; exp: number; loyaltyPoints: number }[],
): Promise<{ error: string; approvedPokemonIds: string[] } | { ok: true }> {
  const approvedPokemonIds: string[] = []
  for (const line of lines) {
    const result = await approvePendingGrant(encounterId, line.pokemonId, line.exp, line.loyaltyPoints)
    if ('error' in result) return { error: result.error, approvedPokemonIds }
    approvedPokemonIds.push(line.pokemonId)
  }
  return { ok: true }
}
