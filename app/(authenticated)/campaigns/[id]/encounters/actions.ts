'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { statModifier } from '@/lib/pta3/pointBuy'
import { loadQualifyingMilestones, computeEffectiveStats } from '@/lib/pta3/trainerFeatures'
import { loadPokemonEffectiveSpeed } from '@/lib/pta3/pokemonStats'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

// [[Feature - Add a combat encounter tracker]]: per the user (2026-09-08) -- the same Trainer or the
// same Pokemon could otherwise be added to one Encounter more than once. Enforced in the schema
// (encounter_combatants_unique_trainer/_pokemon, partial unique indexes), surfaced here as a plain
// message instead of a raw "duplicate key value violates unique constraint" error.
function friendlyCombatantInsertError(error: { code?: string; message: string }): string {
  return error.code === '23505' ? 'That Trainer or Pokémon is already in this encounter.' : error.message
}

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

// [[Feature - Add a combat encounter tracker]]: turn_order is never GM/player-typed via this path --
// a Trainer's is a physical d20 roll (same "app shows the target/inputs, player reports the result"
// convention as RollInputButton elsewhere) plus their own Speed modifier. `d20Roll` is optional: when
// omitted, the roll is made *for* the caller instead -- the one deliberate exception to "always a
// physical roll," used only by startEncounter to fill in every NPC added during Draft without making
// the GM roll a die per NPC by hand (confirmed with the user, 2026-09-08).
async function computeTrainerTurnOrder(supabase: SupabaseClient, trainerId: string, d20Roll?: number): Promise<{ error: string } | { turnOrder: number }> {
  if (d20Roll !== undefined && (!Number.isInteger(d20Roll) || d20Roll < 1 || d20Roll > 20)) {
    return { error: 'Enter the d20 result (1-20)' }
  }
  const roll = d20Roll ?? Math.floor(Math.random() * 20) + 1
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
  return { turnOrder: roll + statModifier(effective.speed) }
}

// A Pokemon's turn order is always its own full effective Speed stat -- never rolled, by anyone.
async function computePokemonTurnOrder(supabase: SupabaseClient, pokemonId: string): Promise<{ error: string } | { turnOrder: number }> {
  const speed = await loadPokemonEffectiveSpeed(supabase, pokemonId)
  if (speed === null) {
    return { error: 'Pokemon not found' }
  }
  return { turnOrder: speed }
}

// Draft -> active. Blocked by the DB's own one-active-per-campaign unique index if another Encounter
// is already active -- surfaced as a plain "reset/delete the current one first" message, not a
// special check duplicated in app code.
//
// [[Feature - Add a combat encounter tracker]]: per the user (2026-09-08), every combatant added
// while this Encounter was still a Draft has no initiative yet (see addTrainerCombatant/
// addPokemonCombatant) -- this is the moment that gets filled in, computed fresh right now (Pokemon:
// effective Speed; Trainer/NPC: auto-rolled d20 + Speed modifier) rather than whenever each was
// originally prepped, so it reflects their current stats at the moment the fight actually starts.
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
    const message = error.code === '23505' ? 'Reset or delete the current active encounter first.' : error.message
    redirect(`/campaigns/${campaignId}/encounters/${encounterId}?error=${encodeURIComponent(message)}`)
  }

  const { data: pendingCombatants } = await supabase
    .from('encounter_combatants')
    .select('id, trainer_id, pokemon_id')
    .eq('encounter_id', encounterId)
    .is('turn_order', null)

  for (const c of pendingCombatants ?? []) {
    const result = c.trainer_id ? await computeTrainerTurnOrder(supabase, c.trainer_id) : await computePokemonTurnOrder(supabase, c.pokemon_id!)
    if (!('error' in result)) {
      await supabase.from('encounter_combatants').update({ turn_order: result.turnOrder }).eq('id', c.id)
    }
  }

  redirect(`/campaigns/${campaignId}/encounters/${encounterId}`)
}

// [[Feature - Add a combat encounter tracker]]: per the user (2026-09-08) -- there's no separate
// 'ended' status anymore. A finished Encounter either resets back to Draft (this action) or gets
// deleted outright (deleteEncounter below). Resetting is explicit and warned in the UI (ConfirmButton)
// since it genuinely clears state: every combatant's turn_order goes back to null (re-computed fresh
// the next time this Encounter starts, same as a brand-new Draft's combatants) and the turn pointer
// resets to the beginning. Combatants themselves are kept, not removed -- this is a reset, not a
// teardown.
export async function resetEncounterToDraft(campaignId: string, encounterId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { error } = await supabase
    .from('encounters')
    .update({ status: 'draft', current_turn_position: 0, ended_at: new Date().toISOString() })
    .eq('id', encounterId)

  if (error) {
    redirect(`/campaigns/${campaignId}/encounters/${encounterId}?error=${encodeURIComponent(error.message)}`)
  }

  await supabase.from('encounter_combatants').update({ turn_order: null }).eq('encounter_id', encounterId)

  redirect(`/campaigns/${campaignId}/encounters/${encounterId}`)
}

// Real, permanent delete (cascades to its combatants) -- the other half of the no-more-'ended' model
// above, for an Encounter the GM has no reason to keep around.
export async function deleteEncounter(campaignId: string, encounterId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { error } = await supabase.from('encounters').delete().eq('id', encounterId)

  if (error) {
    redirect(`/campaigns/${campaignId}/encounters?error=${encodeURIComponent(error.message)}`)
  }

  redirect(`/campaigns/${campaignId}/encounters`)
}

// Adds a Trainer combatant -- GM adding anyone to either side (an NPC, an enemy Trainer, or a player
// who isn't at the keyboard right now), or a player joining themselves (RLS restricts that case to
// their own Trainer, side 'ally', on an active encounter only -- see the migration's own policies).
//
// [[Feature - Add a combat encounter tracker]]: per the user (2026-09-08) -- while the Encounter is
// still a Draft, no initiative is set at all (turn_order stays null until startEncounter fills it in);
// once active, a physical d20 roll is required same as before. `teamPokemonId` is optional and only
// meaningful for an NPC -- "select 1 Team member per NPC," letting the GM bring exactly one of that
// NPC's own Pokemon into the fight as a second, separate combatant in the same step (never required;
// an NPC can also join with no Pokemon at all).
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
  const teamPokemonId = (formData.get('teamPokemonId') as string) || null

  const { data: encounter } = await supabase.from('encounters').select('status').eq('id', encounterId).single()
  if (!encounter) {
    redirect(`/campaigns/${campaignId}/encounters`)
  }

  let turnOrder: number | null = null
  if (encounter.status === 'active') {
    const d20Raw = formData.get('d20Roll')
    const result = await computeTrainerTurnOrder(supabase, trainerId, d20Raw ? Number(d20Raw) : undefined)
    if ('error' in result) {
      redirect(`/campaigns/${campaignId}/encounters/${encounterId}?error=${encodeURIComponent(result.error)}`)
    }
    turnOrder = result.turnOrder
  }

  const { error } = await supabase
    .from('encounter_combatants')
    .insert({ encounter_id: encounterId, side, trainer_id: trainerId, turn_order: turnOrder })

  if (error) {
    redirect(`/campaigns/${campaignId}/encounters/${encounterId}?error=${encodeURIComponent(friendlyCombatantInsertError(error))}`)
  }

  if (teamPokemonId) {
    let pokemonTurnOrder: number | null = null
    if (encounter.status === 'active') {
      const pokemonResult = await computePokemonTurnOrder(supabase, teamPokemonId)
      if (!('error' in pokemonResult)) {
        pokemonTurnOrder = pokemonResult.turnOrder
      }
    }
    const { error: pokemonError } = await supabase
      .from('encounter_combatants')
      .insert({ encounter_id: encounterId, side, pokemon_id: teamPokemonId, turn_order: pokemonTurnOrder })
    if (pokemonError) {
      redirect(
        `/campaigns/${campaignId}/encounters/${encounterId}?error=${encodeURIComponent(`Trainer added, but its Team Pokémon wasn't: ${friendlyCombatantInsertError(pokemonError)}`)}`,
      )
    }
  }

  redirect(`/campaigns/${campaignId}/encounters/${encounterId}`)
}

// Adds a Pokemon combatant (an enemy Wild Pokemon the GM prepared, or a player sending out one of
// their own Team Pokemon -- RLS restricts the latter to their own Team, side 'ally', on an active
// encounter). No roll, ever -- turn order is that Pokemon's own effective Speed, computed immediately
// once active, or left null (per the user, 2026-09-08) while still a Draft.
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

  const { data: encounter } = await supabase.from('encounters').select('status').eq('id', encounterId).single()
  if (!encounter) {
    redirect(`/campaigns/${campaignId}/encounters`)
  }

  let turnOrder: number | null = null
  if (encounter.status === 'active') {
    const result = await computePokemonTurnOrder(supabase, pokemonId)
    if ('error' in result) {
      redirect(`/campaigns/${campaignId}/encounters/${encounterId}?error=${encodeURIComponent(result.error)}`)
    }
    turnOrder = result.turnOrder
  }

  const { error } = await supabase
    .from('encounter_combatants')
    .insert({ encounter_id: encounterId, side, pokemon_id: pokemonId, turn_order: turnOrder })

  if (error) {
    redirect(`/campaigns/${campaignId}/encounters/${encounterId}?error=${encodeURIComponent(friendlyCombatantInsertError(error))}`)
  }

  redirect(`/campaigns/${campaignId}/encounters/${encounterId}`)
}

// GM-only manual override, alongside the roll-based flows above -- lets the GM hand-set or adjust any
// combatant's initiative directly. Per the user (2026-09-08). An empty value clears it back to
// null (e.g. to intentionally leave a Draft-added combatant unset a while longer).
export async function setCombatantInitiative(encounterId: string, campaignId: string, combatantId: string, formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const raw = formData.get('turnOrder')
  const turnOrder = raw === null || raw === '' ? null : Number(raw)
  if (turnOrder !== null && !Number.isInteger(turnOrder)) {
    redirect(`/campaigns/${campaignId}/encounters/${encounterId}?error=${encodeURIComponent('Enter a whole number')}`)
  }

  const { error } = await supabase.from('encounter_combatants').update({ turn_order: turnOrder }).eq('id', combatantId)

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

// [[Feature - Reveal opponent Pokemon without scanning on Walking encyclopedia (Researcher)]]: "using a
// Pokedex" is a plain, no-cost action any campaign member can take on any unidentified opponent -- not
// gated to the GM or to owning the combatant, matching this app's convention of not simulating
// turn-by-turn action economy. Upsert, not insert -- two players clicking the same unidentified
// combatant at once should both just succeed, not race into a duplicate-key error. Permanent and
// campaign-wide once scanned (campaign_scanned_species has no delete path at all), per the FR's own
// Design notes -- mirrors mainline Pokedex's own "seen" concept, not a per-encounter reveal.
export async function scanSpecies(encounterId: string, campaignId: string, pokedexId: number) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { error } = await supabase.from('campaign_scanned_species').upsert({ campaign_id: campaignId, pokedex_id: pokedexId })

  if (error) {
    redirect(`/campaigns/${campaignId}/encounters/${encounterId}?error=${encodeURIComponent(error.message)}`)
  }

  redirect(`/campaigns/${campaignId}/encounters/${encounterId}`)
}

// GM-only, plain "next" -- current_turn_position is just an incrementing counter; "whose turn it is"
// is derived by the page itself (sort combatants by turn_order desc, drop anyone at 0 HP -- read
// live from trainers/pokemon, never a separate stored flag that could drift from it -- index modulo
// that list's length), so advancing never needs to know the combatant list at all. No automatic
// "combat is over" detection, matching this app's non-simulation convention -- the GM resets or
// deletes the encounter explicitly whenever the table decides it's over.
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
