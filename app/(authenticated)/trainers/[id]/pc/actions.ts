'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { findNextOpenSlot } from '@/lib/pta3/pokemonTeam'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

// Shared by all three actions below. Unlike assignPokemon/unassignPokemon, Team/PC management is
// NOT subject to the "Campaign membership hands GM-tier control to the GM alone" rule -- per the
// design doc, this is a routine action (same tier as HP adjustment), so the owner keeps control even
// inside a Campaign, in addition to that Campaign's GM. Returns the trainer row if authorized, null
// otherwise (caller turns that into an { error } result -- no redirect, these are all called
// directly from the client).
async function loadAuthorizedTrainer(supabase: SupabaseClient, trainerId: string, userId: string) {
  const { data: trainer } = await supabase
    .from('trainers')
    .select('id, user_id, campaign_id, campaigns(gm_user_id)')
    .eq('id', trainerId)
    .maybeSingle()

  if (!trainer) return null

  const authorized = trainer.user_id === userId || trainer.campaigns?.gm_user_id === userId
  return authorized ? trainer : null
}

// Brings a PC Pokemon onto the Team. Returns { full: true } instead of an error when there's no
// open slot -- the client uses that signal to open the bench picker (swapTeamSlot) rather than
// treating it as a failure.
export async function assignToTeam(
  trainerId: string,
  pokemonId: string,
): Promise<{ error: string } | { slot: number } | { full: true }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const trainer = await loadAuthorizedTrainer(supabase, trainerId, user.id)
  if (!trainer) {
    return { error: 'Not authorized to manage this Trainer\'s PC' }
  }

  const { data: existingSlots } = await supabase.from('trainers_pokemon').select('party_slot').eq('trainer_id', trainerId)
  const nextSlot = findNextOpenSlot((existingSlots ?? []).map((r) => r.party_slot))

  if (nextSlot === null) {
    return { full: true }
  }

  const { error } = await supabase
    .from('trainers_pokemon')
    .update({ party_slot: nextSlot })
    .eq('trainer_id', trainerId)
    .eq('pokemon_id', pokemonId)

  if (error) {
    return { error: error.message }
  }

  return { slot: nextSlot }
}

// The "swap when full" flow: bench one Team Pokemon and bring in a PC Pokemon in its place, as one
// action from the user's perspective. No DB transaction (this codebase's existing style for
// sequential multi-step writes -- see unassignPokemon, restPokemonCenter). Freeing the bench
// target's slot before claiming it for the incoming Pokemon avoids a transient collision with the
// partial unique index on (trainer_id, party_slot).
export async function swapTeamSlot(
  trainerId: string,
  benchPokemonId: string,
  incomingPokemonId: string,
): Promise<{ error: string } | { slot: number }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const trainer = await loadAuthorizedTrainer(supabase, trainerId, user.id)
  if (!trainer) {
    return { error: 'Not authorized to manage this Trainer\'s PC' }
  }

  const { data: benchTarget } = await supabase
    .from('trainers_pokemon')
    .select('party_slot')
    .eq('trainer_id', trainerId)
    .eq('pokemon_id', benchPokemonId)
    .maybeSingle()

  if (!benchTarget || benchTarget.party_slot === null) {
    return { error: 'That Pokemon is not currently on the Team' }
  }

  const freedSlot = benchTarget.party_slot

  const { error: benchError } = await supabase
    .from('trainers_pokemon')
    .update({ party_slot: null })
    .eq('trainer_id', trainerId)
    .eq('pokemon_id', benchPokemonId)

  if (benchError) {
    return { error: benchError.message }
  }

  const { error: bringInError } = await supabase
    .from('trainers_pokemon')
    .update({ party_slot: freedSlot })
    .eq('trainer_id', trainerId)
    .eq('pokemon_id', incomingPokemonId)

  if (bringInError) {
    return { error: bringInError.message }
  }

  return { slot: freedSlot }
}

// The reverse of assignToTeam -- no picker needed, just frees the slot.
export async function sendToPC(trainerId: string, pokemonId: string): Promise<{ error: string } | { ok: true }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const trainer = await loadAuthorizedTrainer(supabase, trainerId, user.id)
  if (!trainer) {
    return { error: 'Not authorized to manage this Trainer\'s PC' }
  }

  const { error } = await supabase
    .from('trainers_pokemon')
    .update({ party_slot: null })
    .eq('trainer_id', trainerId)
    .eq('pokemon_id', pokemonId)

  if (error) {
    return { error: error.message }
  }

  return { ok: true }
}
