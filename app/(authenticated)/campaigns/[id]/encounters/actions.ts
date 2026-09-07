'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { statModifier } from '@/lib/pta3/pointBuy'
import { loadQualifyingMilestones, computeEffectiveStats } from '@/lib/pta3/trainerFeatures'
import { loadPokemonEffectiveSpeed } from '@/lib/pta3/pokemonStats'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

// [[Feature - Add a combat encounter tracker]]: a GM prepares a new draft Encounter -- named for
// their own reference, no combatants yet. Any number of drafts can coexist; only starting one is
// gated to one-active-per-Campaign (see startEncounter).
export async function createEncounter(campaignId: string, formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const name = (formData.get('name') as string)?.trim()
  if (!name) {
    redirect(`/campaigns/${campaignId}/encounters?error=${encodeURIComponent('Name is required')}`)
  }

  const { data: encounter, error } = await supabase
    .from('encounters')
    .insert({ campaign_id: campaignId, name })
    .select('id')
    .single()

  if (error || !encounter) {
    redirect(`/campaigns/${campaignId}/encounters?error=${encodeURIComponent(error?.message ?? 'Could not create encounter')}`)
  }

  redirect(`/campaigns/${campaignId}/encounters/${encounter.id}`)
}

// Draft -> active. Blocked by the DB's own one-active-per-campaign unique index if another Encounter
// is already active -- surfaced as a plain "end the current one first" message, not a special check
// duplicated in app code.
export async function startEncounter(campaignId: string, encounterId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { error } = await supabase
    .from('encounters')
    .update({ status: 'active', started_at: new Date().toISOString() })
    .eq('id', encounterId)
    .eq('status', 'draft')

  if (error) {
    const message = error.code === '23505' ? 'End the current active encounter first.' : error.message
    redirect(`/campaigns/${campaignId}/encounters/${encounterId}?error=${encodeURIComponent(message)}`)
  }

  redirect(`/campaigns/${campaignId}/encounters/${encounterId}`)
}

// Active -> ended. Never deleted, same "history stays" convention as trainer_milestones.
export async function endEncounter(campaignId: string, encounterId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { error } = await supabase
    .from('encounters')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('id', encounterId)

  if (error) {
    redirect(`/campaigns/${campaignId}/encounters/${encounterId}?error=${encodeURIComponent(error.message)}`)
  }

  redirect(`/campaigns/${campaignId}/encounters/${encounterId}`)
}

// [[Feature - Add a combat encounter tracker]]: turn_order is never GM/player-typed -- a Trainer's is
// a physical d20 roll (entered here, same "app shows the target/inputs, player reports the result"
// convention as RollInputButton elsewhere) plus their own Speed modifier.
async function computeTrainerTurnOrder(supabase: SupabaseClient, trainerId: string, d20Roll: number): Promise<{ error: string } | { turnOrder: number }> {
  if (!Number.isInteger(d20Roll) || d20Roll < 1 || d20Roll > 20) {
    return { error: 'Enter the d20 result (1-20)' }
  }
  const { data: trainer } = await supabase
    .from('trainers')
    .select('level, base_attack, base_defense, base_special_attack, base_special_defense, base_speed')
    .eq('id', trainerId)
    .single()
  if (!trainer) {
    return { error: 'Trainer not found' }
  }
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
  return { turnOrder: d20Roll + statModifier(effective.speed) }
}

// A Pokemon's turn order is always its own full effective Speed stat -- never rolled.
async function computePokemonTurnOrder(supabase: SupabaseClient, pokemonId: string): Promise<{ error: string } | { turnOrder: number }> {
  const speed = await loadPokemonEffectiveSpeed(supabase, pokemonId)
  if (speed === null) {
    return { error: 'Pokemon not found' }
  }
  return { turnOrder: speed }
}

// Adds a Trainer combatant -- GM adding anyone to either side (an NPC, an enemy Trainer, or a player
// who isn't at the keyboard right now), or a player joining themselves (RLS restricts that case to
// their own Trainer, side 'ally', on an active encounter only -- see the migration's own policies).
// Either way a physical d20 roll is required, entered by whoever's actually rolling it.
export async function addTrainerCombatant(encounterId: string, campaignId: string, formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const trainerId = formData.get('trainerId') as string
  const side = (formData.get('side') as string) === 'ally' ? 'ally' : 'enemy'

  const result = await computeTrainerTurnOrder(supabase, trainerId, Number(formData.get('d20Roll')))
  if ('error' in result) {
    redirect(`/campaigns/${campaignId}/encounters/${encounterId}?error=${encodeURIComponent(result.error)}`)
  }

  const { error } = await supabase
    .from('encounter_combatants')
    .insert({ encounter_id: encounterId, side, trainer_id: trainerId, turn_order: result.turnOrder })

  if (error) {
    redirect(`/campaigns/${campaignId}/encounters/${encounterId}?error=${encodeURIComponent(error.message)}`)
  }

  redirect(`/campaigns/${campaignId}/encounters/${encounterId}`)
}

// Adds a Pokemon combatant (an enemy Wild Pokemon the GM prepared, or a player sending out one of
// their own Team Pokemon -- RLS restricts the latter to their own Team, side 'ally', on an active
// encounter). No roll -- turn order is that Pokemon's own effective Speed.
export async function addPokemonCombatant(encounterId: string, campaignId: string, formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const pokemonId = formData.get('pokemonId') as string
  const side = (formData.get('side') as string) === 'ally' ? 'ally' : 'enemy'

  const result = await computePokemonTurnOrder(supabase, pokemonId)
  if ('error' in result) {
    redirect(`/campaigns/${campaignId}/encounters/${encounterId}?error=${encodeURIComponent(result.error)}`)
  }

  const { error } = await supabase
    .from('encounter_combatants')
    .insert({ encounter_id: encounterId, side, pokemon_id: pokemonId, turn_order: result.turnOrder })

  if (error) {
    redirect(`/campaigns/${campaignId}/encounters/${encounterId}?error=${encodeURIComponent(error.message)}`)
  }

  redirect(`/campaigns/${campaignId}/encounters/${encounterId}`)
}

// Removes one combatant -- the GM removing anyone, or a Campaign member removing their own Trainer
// (leave) or Pokemon (recall). RLS alone decides which of those two policies actually matches; a
// mismatched attempt just deletes nothing (same as this app's other owner-gated actions rely on RLS,
// not an explicit permission error, since the calling UI never shows the control to begin with).
export async function removeCombatant(encounterId: string, campaignId: string, combatantId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { error } = await supabase.from('encounter_combatants').delete().eq('id', combatantId)

  if (error) {
    redirect(`/campaigns/${campaignId}/encounters/${encounterId}?error=${encodeURIComponent(error.message)}`)
  }

  redirect(`/campaigns/${campaignId}/encounters/${encounterId}`)
}

// GM-only (no player UPDATE policy exists on encounter_combatants) -- marks a combatant as having
// hit 0 HP, or un-marks it. Never deleted -- preserves the encounter's history the same way
// trainer_milestones rows are never deleted elsewhere in this app.
export async function setCombatantDown(encounterId: string, campaignId: string, combatantId: string, isDown: boolean) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { error } = await supabase.from('encounter_combatants').update({ is_down: isDown }).eq('id', combatantId)

  if (error) {
    redirect(`/campaigns/${campaignId}/encounters/${encounterId}?error=${encodeURIComponent(error.message)}`)
  }

  redirect(`/campaigns/${campaignId}/encounters/${encounterId}`)
}

// GM-only, plain "next" -- current_turn_position is just an incrementing counter; "whose turn it is"
// is derived by the page itself (sort combatants by turn_order desc, drop is_down ones, index modulo
// that list's length), so advancing never needs to know the combatant list at all. No automatic
// "combat is over" detection, matching this app's non-simulation convention -- the GM ends the
// encounter explicitly (endEncounter) whenever the table decides it's over.
export async function advanceTurn(encounterId: string, campaignId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: encounter } = await supabase.from('encounters').select('current_turn_position').eq('id', encounterId).single()
  if (!encounter) {
    redirect(`/campaigns/${campaignId}/encounters`)
  }

  const { error } = await supabase
    .from('encounters')
    .update({ current_turn_position: encounter.current_turn_position + 1 })
    .eq('id', encounterId)

  if (error) {
    redirect(`/campaigns/${campaignId}/encounters/${encounterId}?error=${encodeURIComponent(error.message)}`)
  }

  redirect(`/campaigns/${campaignId}/encounters/${encounterId}`)
}
