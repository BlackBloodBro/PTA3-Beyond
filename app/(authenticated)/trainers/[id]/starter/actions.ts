'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { pickRandomNatureId } from '@/lib/pta3/nature'
import { pickRandomGender } from '@/lib/pta3/gender'
import { findNextOpenSlot } from '@/lib/pta3/pokemonTeam'
import { pickFlavorPreferences } from '@/lib/pta3/flavors'

export async function createStarterPokemon(trainerId: string, formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: trainer } = await supabase
    .from('trainers')
    .select('id, campaign_id')
    .eq('id', trainerId)
    .eq('user_id', user.id)
    .single()

  if (!trainer) {
    redirect('/dashboard')
  }

  const speciesName = (formData.get('species') as string)?.trim()
  const nickname = (formData.get('nickname') as string)?.trim()

  if (!speciesName) {
    redirect(`/trainers/${trainerId}/starter?error=${encodeURIComponent('Species is required')}`)
  }

  const { data: species } = await supabase
    .from('pokedex')
    .select('id, base_hp')
    .ilike('name', speciesName)
    .single()

  if (!species) {
    redirect(
      `/trainers/${trainerId}/starter?error=${encodeURIComponent(`No species named "${speciesName}" found`)}`,
    )
  }

  const { data: obtainMethod } = await supabase
    .from('obtain_methods')
    .select('id')
    .eq('name', 'Starter')
    .single()

  // A starter is always randomly rolled, no picker -- a player doesn't get to choose their own
  // Pokemon's nature any more than a real trainer would (that's the GM-creation flow's job, where
  // a nature might need to be predetermined for a story-specific NPC/gift Pokemon).
  const natureId = await pickRandomNatureId(supabase)

  // Same reasoning as nature -- always rolled, no picker exposed to the player.
  const gender = pickRandomGender()

  // Generate the id up front rather than reading it back after insert: a freshly-created Pokemon
  // has no trainers_pokemon link yet, so it can't pass the "owner can view" SELECT policy -- and
  // Postgres RLS requires a row returned by INSERT ... RETURNING to satisfy the SELECT policy too,
  // which surfaces as a misleading "violates row-level security policy" error otherwise.
  const pokemonId = crypto.randomUUID()

  const { error: pokemonError } = await supabase.from('pokemon').insert({
    id: pokemonId,
    pokedex_id: species.id,
    nickname: nickname || null,
    current_hp: species.base_hp,
    nature_id: natureId,
    gender,
  })

  if (pokemonError) {
    redirect(
      `/trainers/${trainerId}/starter?error=${encodeURIComponent(pokemonError.message ?? 'Could not create Pokemon')}`,
    )
  }

  // Same reasoning as nature/gender -- always rolled, no picker exposed to the player.
  const flavorPrefs = await pickFlavorPreferences(supabase)
  if (flavorPrefs.length > 0) {
    await supabase
      .from('pokemon_flavor_preferences')
      .insert(flavorPrefs.map((p) => ({ pokemon_id: pokemonId, flavor_id: p.flavorId, liked: p.liked })))
  }

  // A brand-new trainer's starter always lands on the Team, not the PC -- findNextOpenSlot still
  // goes through the actual current state (rather than hardcoding slot 1) so this stays correct
  // even if this action is ever reused for a trainer that already has Pokemon.
  const { data: existingSlots } = await supabase.from('trainers_pokemon').select('party_slot').eq('trainer_id', trainerId)
  const nextSlot = findNextOpenSlot((existingSlots ?? []).map((r) => r.party_slot))

  const { error: linkError } = await supabase.from('trainers_pokemon').insert({
    trainer_id: trainerId,
    pokemon_id: pokemonId,
    obtain_method_id: obtainMethod?.id ?? null,
    party_slot: nextSlot,
  })

  if (linkError) {
    redirect(`/trainers/${trainerId}/starter?error=${encodeURIComponent(linkError.message)}`)
  }

  redirect(trainer.campaign_id ? `/campaigns/${trainer.campaign_id}` : '/dashboard')
}
