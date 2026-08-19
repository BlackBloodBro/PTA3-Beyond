'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { pickRandomNatureId } from '@/lib/pta3/nature'
import { pickRandomGender } from '@/lib/pta3/gender'
import { pickRandomShiny } from '@/lib/pta3/shiny'
import { pickFlavorPreferences } from '@/lib/pta3/flavors'
import { computePokemonLevel, computeLoyaltyTier } from '@/lib/pta3/pokemonLevel'
import { parseMoveFrequency } from '@/lib/pta3/moveFrequency'
import { EV_STAT_COLUMNS, MAX_EV_PER_STAT, type EvStatKey } from '@/lib/pta3/pokemonEv'
import { resolveWildPokemonAuthority } from '@/lib/pta3/pokemonAuthority'
import { findNextOpenSlot } from '@/lib/pta3/pokemonTeam'
import { pokemonHref } from '@/lib/pta3/pokemonPaths'
import { previewPassiveLoss, shiftSizeOrWeightOverride, isMaxLoyalty } from '@/lib/pta3/evolution'
import { setOriginalTrainerIfUnset } from '@/lib/pta3/pokemonOrigin'

export type MoveOption = {
  id: number
  name: string
  range: string
  damage_stat: string
  frequency: string
  damage_dice: string | null
  description: string | null
  types: { name: string } | null
}

export type PassiveOption = {
  id: number
  name: string
  description: string | null
  category: string | null
}

// Species-specific reference data for the Pokemon-creation form's Moves/Passives/EXP panels
// ([[Bug - Improve Wild Pokemon creation and editing]]) -- called client-side whenever the picked
// species changes, since preloading every one of the ~986 species' learnsets up front isn't
// feasible. Kept unauthenticated (matches fetchPokedexFilterOptions/fetchFilteredSpecies) -- it's
// all public Pokedex reference data, nothing user- or campaign-scoped.
export async function loadSpeciesCreationData(pokedexId: number): Promise<{
  growthRateId: number | null
  growthRateName: string | null
  growthRateModifier: number
  learnset: { level_learned: number; move: MoveOption }[]
  passiveLearnset: { level_learned: number | null; passive: PassiveOption }[]
}> {
  const supabase = await createClient()

  const [{ data: species }, { data: moveRows }, { data: passiveRows }] = await Promise.all([
    supabase
      .from('pokedex')
      .select('growth_rate_id, growth_rate:growth_rates!growth_rate_id(name, exp_modifier)')
      .eq('id', pokedexId)
      .maybeSingle(),
    supabase
      .from('pokedex_moves')
      .select('level_learned, move:moves(id, name, range, damage_stat, frequency, damage_dice, description, types(name))')
      .eq('pokedex_id', pokedexId)
      // Only natural level-up moves are offered here -- TM/tutor-taught moves (level_learned null)
      // also need a Proficiency-overlap check that only matters once the Pokemon actually has a
      // trainer/inventory; picking those is left to the detail page's existing Moves section after
      // creation, same as it already works for every other Pokemon.
      .not('level_learned', 'is', null)
      .order('level_learned'),
    supabase
      .from('pokedex_passives')
      .select('level_learned, passive:passives(id, name, description, passive_type, category)')
      .eq('pokedex_id', pokedexId)
      .order('level_learned', { nullsFirst: true }),
  ])

  const growthRate = species?.growth_rate as unknown as { name: string; exp_modifier: number } | null

  const learnset = ((moveRows ?? []) as unknown as { level_learned: number; move: MoveOption | null }[]).filter(
    (r): r is { level_learned: number; move: MoveOption } => r.move !== null,
  )

  // Same reverse-embed quirk as elsewhere -- `passive` comes back as a single object, not the array
  // TS infers. Ability-type Passives are excluded: those auto-derive from species+level once the
  // Pokemon exists, there's nothing to pick here.
  const passiveLearnset = ((passiveRows ?? []) as unknown as { level_learned: number | null; passive: (PassiveOption & { passive_type: string }) | null }[])
    .filter((r): r is { level_learned: number | null; passive: PassiveOption & { passive_type: string } } => r.passive !== null && r.passive.passive_type === 'stat')
    .map((r) => ({
      level_learned: r.level_learned,
      passive: { id: r.passive.id, name: r.passive.name, description: r.passive.description, category: r.passive.category },
    }))

  return {
    growthRateId: species?.growth_rate_id ?? null,
    growthRateName: growthRate?.name ?? null,
    growthRateModifier: growthRate?.exp_modifier ?? 1,
    learnset,
    passiveLearnset,
  }
}

export type CreatePokemonInput = {
  speciesId: number
  nickname: string | null
  campaignId: string | null
  trainerId: string | null
  natureChoice: 'random' | number
  genderChoice: 'random' | 'male' | 'female' | 'genderless'
  loyaltyPoints: number
  obtainMethodId: number | null
  heldItemId: number | null
  shininessChoice: 'no' | 'yes' | 'random'
  type1Id: number | null
  type2Id: number | null
  sizeId: number | null
  weightId: number | null
  currentExp: number
  evs: Partial<Record<EvStatKey, number>>
  moveIds: number[]
  passiveIds: number[]
  // Pool/wild only (enforced below) -- a Trainer can only ever receive one Pokemon per creation.
  quantity: number
}

// Called directly from the client (CreatePokemonForm) as a plain function, not a <form action> --
// the form has too much interdependent client state (live level preview, species-driven Moves/
// Passives panels) to round-trip through FormData. Returns a redirect target + any per-step
// warnings instead of calling redirect() itself, so the caller can show warnings before navigating.
export async function createPokemon(input: CreatePokemonInput): Promise<{ error: string } | { redirectTo: string; warnings: string[] }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: species } = await supabase.from('pokedex').select('id, base_hp').eq('id', input.speciesId).maybeSingle()
  if (!species) {
    return { error: 'Species not found' }
  }

  // "Which pool does this belong to" (organizational only -- not what actually grants assignment
  // rights below) -- must be a campaign this user GMs.
  if (input.campaignId) {
    const { data: campaign } = await supabase.from('campaigns').select('id').eq('id', input.campaignId).eq('gm_user_id', user.id).maybeSingle()
    if (!campaign) {
      return { error: 'You are not the GM of that campaign' }
    }
  }

  // Assigning straight to a trainer at creation time is gated by that trainer's OWN campaign, not
  // by campaignId above -- a personal-pool (campaign-less) Pokemon can still be handed straight to
  // a trainer in any campaign this user GMs.
  let trainerCampaignId: string | null = null
  if (input.trainerId) {
    const { data: trainer } = await supabase
      .from('trainers')
      .select('id, campaign_id, campaigns(gm_user_id)')
      .eq('id', input.trainerId)
      .maybeSingle()

    if (!trainer || !trainer.campaign_id || trainer.campaigns?.gm_user_id !== user.id) {
      return { error: 'You are not the GM for that trainer' }
    }
    trainerCampaignId = trainer.campaign_id
  }

  const quantity = input.trainerId ? 1 : Math.max(1, Math.min(50, Math.floor(input.quantity) || 1))

  const warnings: string[] = []
  let lastPokemonId: string | null = null

  for (let i = 0; i < quantity; i++) {
    // Each copy independently rolls its own Random Nature/Gender/Shiny rather than the whole batch
    // sharing one roll -- a GM populating a wild encounter table wants variety, not N identical
    // copies (locked design, [[Bug - Improve Wild Pokemon creation and editing]]).
    const natureId = input.natureChoice === 'random' ? await pickRandomNatureId(supabase) : input.natureChoice
    const gender = input.genderChoice === 'random' ? pickRandomGender() : input.genderChoice
    const isShiny = input.shininessChoice === 'random' ? pickRandomShiny() : input.shininessChoice === 'yes'

    // Generate the id up front rather than reading it back after insert -- same RETURNING-requires-
    // SELECT-policy reasoning as the starter Pokemon flow.
    const pokemonId = crypto.randomUUID()

    const { error: pokemonError } = await supabase.from('pokemon').insert({
      id: pokemonId,
      pokedex_id: species.id,
      nickname: input.nickname || null,
      current_hp: species.base_hp,
      current_exp: Math.max(0, Math.floor(input.currentExp) || 0),
      campaign_id: input.campaignId,
      created_by_user_id: user.id,
      nature_id: natureId,
      gender,
      loyalty_points: Math.max(0, Math.floor(input.loyaltyPoints) || 0),
      held_item_id: input.heldItemId,
      is_shiny: isShiny,
      type_1_id: input.type1Id,
      type_2_id: input.type2Id,
      size_id: input.sizeId,
      weight_id: input.weightId,
    })

    if (pokemonError) {
      return { error: pokemonError.message }
    }

    lastPokemonId = pokemonId

    // Independently rolled per copy, same reasoning as Nature/Gender/Shiny above.
    const flavorPrefs = await pickFlavorPreferences(supabase)
    if (flavorPrefs.length > 0) {
      const { error: flavorError } = await supabase
        .from('pokemon_flavor_preferences')
        .insert(flavorPrefs.map((p) => ({ pokemon_id: pokemonId, flavor_id: p.flavorId, liked: p.liked })))
      if (flavorError) {
        warnings.push(`Flavor preferences: ${flavorError.message}`)
      }
    }

    if (input.trainerId) {
      // Same auto-park behavior as assignPokemon below -- lands on the Team if there's room, parks
      // in the PC (party_slot null) rather than blocking creation if it's already full.
      const { data: existingSlots } = await supabase.from('trainers_pokemon').select('party_slot').eq('trainer_id', input.trainerId)
      const nextSlot = findNextOpenSlot((existingSlots ?? []).map((r) => r.party_slot))

      const { error: linkError } = await supabase
        .from('trainers_pokemon')
        .insert({ trainer_id: input.trainerId, pokemon_id: pokemonId, party_slot: nextSlot, obtain_method_id: input.obtainMethodId })

      if (linkError) {
        warnings.push(`Trainer assignment failed: ${linkError.message}`)
      } else {
        await setOriginalTrainerIfUnset(supabase, pokemonId, input.trainerId, input.obtainMethodId)
      }
    }

    // EVs/Moves/Passives reuse the existing detail-page actions verbatim -- their level/budget/
    // eligibility checks (computed from the exp just set above) are exactly what's wanted here too,
    // rather than re-deriving that logic pre-creation. A failure on one of these doesn't undo the
    // Pokemon itself -- it's surfaced as a warning and left for the GM to fix on the detail page,
    // same as any other partial-success case this codebase already accepts (no multi-statement
    // transactions available via supabase-js).
    const hasEvs = Object.values(input.evs).some((v) => (v ?? 0) > 0)
    if (hasEvs) {
      const fullEvs: Record<EvStatKey, number> = {
        hp: input.evs.hp ?? 0,
        attack: input.evs.attack ?? 0,
        defense: input.evs.defense ?? 0,
        special_attack: input.evs.special_attack ?? 0,
        special_defense: input.evs.special_defense ?? 0,
        speed: input.evs.speed ?? 0,
      }
      const evResult = await setPokemonEvs(pokemonId, fullEvs)
      if ('error' in evResult) {
        warnings.push(`EVs: ${evResult.error}`)
      }
    }

    for (const moveId of input.moveIds) {
      const moveResult = await learnMove(pokemonId, moveId)
      if ('error' in moveResult) {
        warnings.push(`Move: ${moveResult.error}`)
      }
    }

    for (const passiveId of input.passiveIds) {
      const passiveResult = await learnPassive(pokemonId, passiveId)
      if ('error' in passiveResult) {
        warnings.push(`Passive: ${passiveResult.error}`)
      }
    }
  }

  if (input.trainerId && lastPokemonId) {
    return { redirectTo: pokemonHref({ id: lastPokemonId, hasOwner: true, campaignId: trainerCampaignId }), warnings }
  }

  // Bug fix: this used to unconditionally redirect to /pokemon regardless of campaignId, landing a
  // GM who just created a Wild Pokemon for a specific campaign's pool on the generic global list
  // instead of that campaign's own Wild Pokemon list.
  if (input.campaignId) {
    return { redirectTo: `/campaigns/${input.campaignId}/wild-pokemon`, warnings }
  }

  return { redirectTo: '/pokemon', warnings }
}

// Called directly from a client component (no <form action>, no redirect) so assigning a Wild/pool
// Pokemon to a trainer updates in place -- the row either disappears (Wild Pokemon list, which only
// shows unassigned ones) or swaps to showing the new trainer (the /pokemon list) -- instead of
// bouncing the GM to the Pokemon's own detail page, which was jarring mid-batch-assign.
//
// Authorization: "Campaign membership hands GM-tier control to the GM alone" -- a trainer with no
// campaign can receive an assignment from its own owner (there's no GM to defer to), but a trainer
// INSIDE a campaign can only receive one from that campaign's GM, even from the trainer's own owner.
// This is narrower than trainers_pokemon's own RLS (which allows the owner unconditionally) -- RLS is
// the outer safety net, not the source of truth for this rule, same as every other GM-tier check in
// this codebase (updatePokemonDetails, addPokemonExp, setPokemonEvs all layer a stricter app-level
// check on top of broader RLS).
export async function assignPokemon(
  pokemonId: string,
  trainerId: string,
): Promise<{ error: string } | { trainerId: string; trainerName: string; trainerIsNpc: boolean; trainerCampaignId: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  if (!trainerId) {
    return { error: 'Choose a trainer to assign to' }
  }

  const { data: trainer } = await supabase
    .from('trainers')
    .select('id, name, user_id, campaign_id, is_npc, campaigns(gm_user_id)')
    .eq('id', trainerId)
    .maybeSingle()

  if (!trainer) {
    return { error: 'Trainer not found' }
  }

  const authorized = trainer.campaign_id
    ? trainer.campaigns?.gm_user_id === user.id
    : trainer.user_id === user.id

  if (!authorized) {
    return { error: trainer.campaign_id ? 'Only that campaign\'s GM can assign to this trainer' : 'Not authorized to assign to that trainer' }
  }

  // Auto-park: bringing a wild/pool Pokemon onto a full Team shouldn't block the assignment or
  // force an immediate bench decision -- it lands in the PC (party_slot null) instead, same as
  // anything already parked there. The GM/owner can move it onto the Team later from the PC page.
  const { data: existingSlots } = await supabase.from('trainers_pokemon').select('party_slot').eq('trainer_id', trainerId)
  const nextSlot = findNextOpenSlot((existingSlots ?? []).map((r) => r.party_slot))

  const { error } = await supabase
    .from('trainers_pokemon')
    .insert({ trainer_id: trainerId, pokemon_id: pokemonId, party_slot: nextSlot })

  if (error) {
    return { error: error.message }
  }

  await setOriginalTrainerIfUnset(supabase, pokemonId, trainerId, null)

  return { trainerId, trainerName: trainer.name, trainerIsNpc: trainer.is_npc, trainerCampaignId: trainer.campaign_id }
}

// Sends an assigned Pokemon back to the unassigned pool. Same "campaign hands GM-tier control to the
// GM alone" rule as assignPokemon above, checked explicitly here rather than left to
// trainers_pokemon's broader RLS (which would allow the trainer's owner unconditionally).
// Called directly from a client component -- see assignPokemon above.
export async function unassignPokemon(pokemonId: string): Promise<{ error: string } | { ok: true }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: link } = await supabase
    .from('trainers_pokemon')
    .select('trainers(user_id, campaign_id, campaigns(gm_user_id))')
    .eq('pokemon_id', pokemonId)
    .maybeSingle()

  // trainers_pokemon.pokemon_id is a primary key, so this reverse embed comes back as a single
  // object at runtime -- same quirk documented elsewhere in this codebase.
  const trainer = link?.trainers as unknown as { user_id: string; campaign_id: string | null; campaigns: { gm_user_id: string } | null } | null

  if (!trainer) {
    return { error: 'Pokemon is not currently assigned' }
  }

  const authorized = trainer.campaign_id ? trainer.campaigns?.gm_user_id === user.id : trainer.user_id === user.id

  if (!authorized) {
    return { error: trainer.campaign_id ? 'Only that campaign\'s GM can unassign this Pokemon' : 'Not authorized to unassign this Pokemon' }
  }

  // Reassign created_by_user_id to whoever is doing the unassigning BEFORE the trainers_pokemon link
  // is removed -- same reasoning as deleteTrainer's Pokemon reassignment (app/trainers/actions.ts):
  // once unlinked, a pool Pokemon with no owner via trainers_pokemon and no created_by_user_id claim
  // matches no RLS policy at all and becomes permanently inaccessible to everyone, including whoever
  // just unassigned it. Doing this while still linked is what lets the owner/GM update policies on
  // `pokemon` apply.
  const { error: reassignError } = await supabase.from('pokemon').update({ created_by_user_id: user.id }).eq('id', pokemonId)

  if (reassignError) {
    return { error: reassignError.message }
  }

  const { error } = await supabase.from('trainers_pokemon').delete().eq('pokemon_id', pokemonId)

  if (error) {
    return { error: error.message }
  }

  return { ok: true }
}

// Gifts a Pokemon directly from its current Trainer to another Trainer/NPC in the same Campaign, in
// one atomic step -- what today takes a GM two separate calls (unassignPokemon + assignPokemon), per
// [[Add Pokemon gifting]]. Authorized by the CURRENT trainer's owner or that campaign's GM -- unlike
// assignPokemon, the destination trainer's own owner/GM does NOT need to separately authorize
// receiving it, since gifting only ever moves the giver's own belongings. RLS has its own narrower
// "Owner gifts trainers_pokemon within campaign" policy backing this up (the existing owner policy's
// WITH CHECK ties trainer_id to auth.uid() on both sides of an update, which would otherwise block a
// player gifting to a trainer they don't own).
export async function giftPokemon(
  pokemonId: string,
  toTrainerId: string,
): Promise<
  | { error: string }
  | { toTrainerId: string; toTrainerName: string; toTrainerIsNpc: boolean; toTrainerCampaignId: string | null; obtainMethodName: string | null }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  if (!toTrainerId) {
    return { error: 'Choose a trainer to gift to' }
  }

  const { data: pokemon } = await supabase
    .from('pokemon')
    .select(
      'original_trainer_id, original_obtain_method_id, trainers_pokemon(trainer_id, trainers(user_id, campaign_id, campaigns(gm_user_id)))',
    )
    .eq('id', pokemonId)
    .maybeSingle()

  if (!pokemon) {
    return { error: 'Pokemon not found' }
  }

  // Same trainers_pokemon-is-a-primary-key quirk as elsewhere -- this reverse embed (and the
  // forward trainers -> campaigns embed nested inside it) both come back as single objects.
  const ownerLink = pokemon.trainers_pokemon as unknown as {
    trainer_id: string
    trainers: { user_id: string; campaign_id: string | null; campaigns: { gm_user_id: string } | null } | null
  } | null

  if (!ownerLink || !ownerLink.trainers) {
    return { error: 'This Pokemon has no current Trainer to gift from' }
  }

  const currentTrainer = ownerLink.trainers

  const authorized = currentTrainer.campaign_id
    ? currentTrainer.campaigns?.gm_user_id === user.id
    : currentTrainer.user_id === user.id

  if (!authorized) {
    return { error: 'Not authorized to gift this Pokemon' }
  }

  if (!currentTrainer.campaign_id) {
    return { error: 'Gifting is only possible within a Campaign' }
  }

  if (toTrainerId === ownerLink.trainer_id) {
    return { error: 'Already owned by that Trainer' }
  }

  const { data: toTrainer } = await supabase
    .from('trainers')
    .select('id, name, is_npc, campaign_id')
    .eq('id', toTrainerId)
    .maybeSingle()

  if (!toTrainer) {
    return { error: 'Trainer not found' }
  }

  if (toTrainer.campaign_id !== currentTrainer.campaign_id) {
    return { error: 'Can only gift to a Trainer in the same Campaign' }
  }

  // Obtain method updates automatically -- 'Gifted', unless this gift is going back to the Pokemon's
  // original trainer, in which case it reverts to whatever it originally was (mirrors the mainline
  // games' "traded back to the OT" logic).
  let obtainMethodId: number | null
  let obtainMethodName: string | null
  if (toTrainerId === pokemon.original_trainer_id) {
    obtainMethodId = pokemon.original_obtain_method_id
    const { data: method } = obtainMethodId
      ? await supabase.from('obtain_methods').select('name').eq('id', obtainMethodId).maybeSingle()
      : { data: null }
    obtainMethodName = method?.name ?? null
  } else {
    const { data: giftedMethod } = await supabase.from('obtain_methods').select('id, name').eq('name', 'Gifted').maybeSingle()
    obtainMethodId = giftedMethod?.id ?? null
    obtainMethodName = giftedMethod?.name ?? null
  }

  // Auto-park: same as assignPokemon -- lands on the Team if there's room, parks in the PC otherwise.
  const { data: existingSlots } = await supabase.from('trainers_pokemon').select('party_slot').eq('trainer_id', toTrainerId)
  const nextSlot = findNextOpenSlot((existingSlots ?? []).map((r) => r.party_slot))

  // A plain ownership reassignment (trainers_pokemon.pokemon_id is the primary key, so this is an
  // UPDATE, not a delete+insert) -- no trade history kept, matching every other ownership-change
  // action in this app.
  const { error } = await supabase
    .from('trainers_pokemon')
    .update({ trainer_id: toTrainerId, party_slot: nextSlot, obtain_method_id: obtainMethodId })
    .eq('pokemon_id', pokemonId)

  if (error) {
    return { error: error.message }
  }

  await setOriginalTrainerIfUnset(supabase, pokemonId, toTrainerId, obtainMethodId)

  return {
    toTrainerId,
    toTrainerName: toTrainer.name,
    toTrainerIsNpc: toTrainer.is_npc,
    toTrainerCampaignId: toTrainer.campaign_id,
    obtainMethodName,
  }
}

// Re-tags an unassigned pool Pokemon's campaign (which Wild Pokemon list it shows up on) after the
// fact -- same "must be a campaign this user GMs" rule createPokemon already applies at creation
// time, just usable later from the /pokemon list instead of only at creation.
// Called directly from a client component (no <form action>, no redirect) -- see assignPokemon above.
export async function assignPokemonToCampaign(
  pokemonId: string,
  campaignIdRaw: string,
): Promise<{ error: string } | { campaignId: string | null; campaignName: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Only the pool Pokemon's own creator can retag it -- mirrors createPokemon's ownership model
  // for unassigned Pokemon (created_by_user_id is what grants standing rights pre-assignment).
  const { data: pokemon } = await supabase
    .from('pokemon')
    .select('id')
    .eq('id', pokemonId)
    .eq('created_by_user_id', user.id)
    .maybeSingle()

  if (!pokemon) {
    return { error: 'Not authorized to move that Pokemon' }
  }

  let campaignId: string | null = null
  let campaignName: string | null = null
  if (campaignIdRaw) {
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id, name')
      .eq('id', campaignIdRaw)
      .eq('gm_user_id', user.id)
      .maybeSingle()

    if (!campaign) {
      return { error: 'You are not the GM of that campaign' }
    }
    campaignId = campaignIdRaw
    campaignName = campaign.name
  }

  const { error } = await supabase.from('pokemon').update({ campaign_id: campaignId }).eq('id', pokemonId)

  if (error) {
    return { error: error.message }
  }

  return { campaignId, campaignName }
}

// No explicit ownership filter -- RLS alone decides who this actually works for (a trainer's owner
// via "Owners can delete their pokemon", or an unassigned pool Pokemon's creator via "Creator
// manages their own unassigned pokemon"), same reasoning as removePlayer: anyone else's attempt
// silently deletes zero rows rather than erroring, and the /pokemon list only ever shows this
// button for Pokemon the current user actually has one of those two claims to.
export async function deletePokemon(pokemonId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { error } = await supabase.from('pokemon').delete().eq('id', pokemonId)

  if (error) {
    redirect(`/pokemon?error=${encodeURIComponent(error.message)}`)
  }

  redirect('/pokemon')
}

// Shared by assignPokemonEv/setPokemonEvs: owner/GM status plus each stat's current EV count.
async function loadPokemonEvContext(supabase: Awaited<ReturnType<typeof createClient>>, pokemonId: string, userId: string) {
  const { data: pokemon } = await supabase
    .from('pokemon')
    .select(
      `
      current_exp, current_hp, is_shiny, loyalty_points, created_by_user_id, campaign_id, campaign:campaign_id(gm_user_id),
      ev_hp, ev_attack, ev_defense, ev_special_attack, ev_special_defense, ev_speed,
      pokedex(growth_rate_id, base_hp),
      trainers_pokemon(obtain_method_id, trainers(user_id, campaigns(gm_user_id)))
    `,
    )
    .eq('id', pokemonId)
    .single()

  if (!pokemon) return null

  // Same trainers_pokemon-is-a-primary-key quirk as elsewhere -- single object at runtime.
  const ownerLink = pokemon.trainers_pokemon as unknown as {
    obtain_method_id: number | null
    trainers: { user_id: string; campaigns: { gm_user_id: string } | null } | null
  } | null
  // Same quirk for the forward campaign_id embed -- a single object (or null), not the array TS infers.
  const campaign = pokemon.campaign as unknown as { gm_user_id: string } | null

  const currentEvs: Record<EvStatKey, number> = {
    hp: pokemon.ev_hp,
    attack: pokemon.ev_attack,
    defense: pokemon.ev_defense,
    special_attack: pokemon.ev_special_attack,
    special_defense: pokemon.ev_special_defense,
    speed: pokemon.ev_speed,
  }

  // A Wild/pool Pokemon has no trainers_pokemon row -- its GM-tier authority is the campaign's real
  // GM if it's tagged to one, else its creator (see resolveWildPokemonAuthority) -- both isOwner and
  // isGM collapse to that same value here, same reasoning as updatePokemonDetails/addPokemonExp.
  const poolAuthority = resolveWildPokemonAuthority(
    { campaignId: pokemon.campaign_id, campaignGmUserId: campaign?.gm_user_id ?? null, createdByUserId: pokemon.created_by_user_id },
    userId,
  )

  return {
    pokemon,
    ownerLink,
    currentEvs,
    isOwner: ownerLink ? ownerLink.trainers?.user_id === userId : poolAuthority,
    // No campaign -> no GM to defer to -- falls back to the Trainer's own owner, same rule as
    // updatePokemonDetails/addPokemonExp/the Pokemon page's read side.
    isGM: ownerLink
      ? ownerLink.trainers?.campaigns
        ? ownerLink.trainers.campaigns.gm_user_id === userId
        : ownerLink.trainers?.user_id === userId
      : poolAuthority,
  }
}

// Assigning is owner-or-GM (matches HP/Nickname) -- a trainer manages their own Pokemon's EV
// growth as it levels up. Redistributing/removing (setPokemonEvs, below) is GM-only: the user was
// explicit that a trainer shouldn't be able to undo their own assignment ("only with an item" --
// that item's logic doesn't exist yet, this just leaves the GM as the other way to correct one).
// Returns a result object instead of redirecting on success/validation-failure -- called directly
// from the client (PokemonInteractive.tsx) so the Stats section can update in place instead of
// forcing a full-page re-render for every EV assignment. Only the '/login' guard still redirects,
// since that's a real navigation-worthy case (expired session), not a normal error path.
export async function assignPokemonEv(
  pokemonId: string,
  stat: EvStatKey,
): Promise<{ error: string } | { ev: number; currentHp: number }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const ctx = await loadPokemonEvContext(supabase, pokemonId, user.id)
  if (!ctx) {
    return { error: 'Pokemon not found' }
  }

  if (!ctx.isOwner && !ctx.isGM) {
    return { error: 'Not authorized to assign EVs' }
  }

  if (ctx.currentEvs[stat] >= MAX_EV_PER_STAT) {
    return { error: 'That stat already has the max 2 EVs' }
  }

  const { level } = await computePokemonLevel(supabase, {
    currentExp: ctx.pokemon.current_exp,
    isShiny: ctx.pokemon.is_shiny,
    loyaltyPoints: ctx.pokemon.loyalty_points,
    obtainMethodId: ctx.ownerLink?.obtain_method_id ?? null,
    growthRateId: ctx.pokemon.pokedex?.growth_rate_id ?? null,
  })
  const evsAvailable = Math.floor(level / 8)
  const evsSpent = Object.values(ctx.currentEvs).reduce((a, b) => a + b, 0)

  if (evsSpent >= evsAvailable) {
    return { error: 'No EVs available to assign at this level' }
  }

  const column = EV_STAT_COLUMNS[stat]
  const newEv = ctx.currentEvs[stat] + 1
  const updates: Record<string, number> = { [column]: newEv }

  // An HP EV raises max HP by 6 -- current HP should rise with it (a level-up-style gain, not a
  // free heal that only shows up the next time something else touches current_hp).
  let newCurrentHp = ctx.pokemon.current_hp
  if (stat === 'hp') {
    const newMaxHp = (ctx.pokemon.pokedex?.base_hp ?? 0) + newEv * 6
    newCurrentHp = Math.min(newMaxHp, ctx.pokemon.current_hp + 6)
    updates.current_hp = newCurrentHp
  }

  const { error } = await supabase.from('pokemon').update(updates).eq('id', pokemonId)

  if (error) {
    return { error: error.message }
  }

  return { ev: newEv, currentHp: newCurrentHp }
}

// GM-only redistribution: sets all 6 stats' EVs at once from one call, rather than the old
// per-stat increment/decrement buttons -- the user specifically wanted a single "Edit EV's" menu
// the GM can use to move points between stats, not a one-at-a-time remove action. Takes a plain
// object instead of FormData now that it's called directly from the client (no <form> submission
// involved), and returns a result instead of redirecting so the Stats section can update in place.
export async function setPokemonEvs(
  pokemonId: string,
  evs: Record<EvStatKey, number>,
): Promise<{ error: string } | { evs: Record<EvStatKey, number>; currentHp: number }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const ctx = await loadPokemonEvContext(supabase, pokemonId, user.id)
  if (!ctx) {
    return { error: 'Pokemon not found' }
  }

  if (!ctx.isGM) {
    return { error: 'Only the campaign GM can redistribute EVs' }
  }

  const { level } = await computePokemonLevel(supabase, {
    currentExp: ctx.pokemon.current_exp,
    isShiny: ctx.pokemon.is_shiny,
    loyaltyPoints: ctx.pokemon.loyalty_points,
    obtainMethodId: ctx.ownerLink?.obtain_method_id ?? null,
    growthRateId: ctx.pokemon.pokedex?.growth_rate_id ?? null,
  })
  const evsAvailable = Math.floor(level / 8)

  const newEvs: Record<EvStatKey, number> = { hp: 0, attack: 0, defense: 0, special_attack: 0, special_defense: 0, speed: 0 }
  let total = 0
  for (const stat of Object.keys(EV_STAT_COLUMNS) as EvStatKey[]) {
    const raw = evs[stat]
    const value = Number.isInteger(raw) ? Math.min(MAX_EV_PER_STAT, Math.max(0, raw)) : 0
    newEvs[stat] = value
    total += value
  }

  if (total > evsAvailable) {
    return { error: `Total EVs (${total}) exceed what this level allows (${evsAvailable})` }
  }

  const updates: Record<string, number> = {}
  for (const stat of Object.keys(EV_STAT_COLUMNS) as EvStatKey[]) {
    updates[EV_STAT_COLUMNS[stat]] = newEvs[stat]
  }

  // Same reasoning as assignPokemonEv -- current HP moves the same direction and amount as max HP
  // whenever HP's EV is redistributed, clamped to the new [0, max] range (a GM lowering it
  // shouldn't leave current HP silently above the new max).
  const hpDelta = (newEvs.hp - ctx.currentEvs.hp) * 6
  let newCurrentHp = ctx.pokemon.current_hp
  if (hpDelta !== 0) {
    const newMaxHp = (ctx.pokemon.pokedex?.base_hp ?? 0) + newEvs.hp * 6
    newCurrentHp = Math.max(0, Math.min(newMaxHp, ctx.pokemon.current_hp + hpDelta))
    updates.current_hp = newCurrentHp
  }

  const { error } = await supabase.from('pokemon').update(updates).eq('id', pokemonId)

  if (error) {
    return { error: error.message }
  }

  return { evs: newEvs, currentHp: newCurrentHp }
}

export async function adjustPokemonHp(
  pokemonId: string,
  sign: 1 | -1,
  amount: number,
): Promise<{ error: string } | { currentHp: number }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  if (!Number.isInteger(amount) || amount < 0) {
    return { error: 'Enter a whole number amount' }
  }

  // No ownership filter needed -- RLS already covers both the Pokemon's owner and the campaign's
  // GM (both have UPDATE rights), same as the trainer HP control.
  const { data: pokemon } = await supabase
    .from('pokemon')
    .select('current_hp, ev_hp, loyalty_points, pokedex(base_hp)')
    .eq('id', pokemonId)
    .single()

  if (!pokemon || !pokemon.pokedex) {
    return { error: 'Pokemon not found' }
  }

  const maxHp = pokemon.pokedex.base_hp + pokemon.ev_hp * 6

  // Healing caps at max HP, damage floors at 0 -- unlike the trainer HP control, Pokemon HP has no
  // death-saving-throw use for negative values, so there's nothing for going below 0 to represent.
  const newHp = sign > 0 ? Math.min(maxHp, pokemon.current_hp + amount) : Math.max(0, pokemon.current_hp - amount)

  const updates: { current_hp: number; loyalty_points?: number } = { current_hp: newHp }

  // [[Add a Loyalty editor]]: fainting (a >0 -> 0 HP crossing) costs LP -- checked as a state
  // transition rather than a one-time flag, so repeated fainting across a session removes LP each
  // time. Healing back above 0 and fainting again later is a fresh transition, not a repeat.
  if (pokemon.current_hp > 0 && newHp === 0) {
    const { data: faintEvent } = await supabase.from('loyalty_point_events').select('points').eq('name', 'Fainted').maybeSingle()
    updates.loyalty_points = Math.max(0, pokemon.loyalty_points + (faintEvent?.points ?? 0))
  }

  const { error } = await supabase.from('pokemon').update(updates).eq('id', pokemonId)

  if (error) {
    return { error: error.message }
  }

  return { currentHp: newHp }
}

const POKEMON_GENDER_VALUES = ['male', 'female', 'genderless'] as const

// Nickname is owner-or-GM (relies on the same broad RLS policy as HP/moves). Everything else here
// -- Gender, Nature, Shininess, Type 1/2, Size, Weight, Held item -- is GM-only per the user's
// explicit direction ("all of them should be editable by the GM only... let's make it so Gender and
// Nature are also only editable by the GM"). RLS still broadly permits the owner to UPDATE this
// table (same policy that lets Nickname through), so GM-ness has to be checked here explicitly --
// same technique as addPokemonExp -- rather than relying on RLS to reject an owner who tries to
// smuggle a Gender/Shininess/etc change into the request. Loyalty is no longer part of this form at
// all, per [[Add a Loyalty editor]] -- it's an accumulating LP counter now (LoyaltySection's Add/
// Remove LP), not a force-a-tier field.
export async function updatePokemonDetails(pokemonId: string, formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: pokemon } = await supabase
    .from('pokemon')
    .select(
      'created_by_user_id, campaign_id, campaign:campaign_id(gm_user_id), trainers_pokemon(trainers(user_id, campaign_id, campaigns(gm_user_id)))',
    )
    .eq('id', pokemonId)
    .single()

  if (!pokemon) {
    redirect('/pokemon')
  }

  // Same trainers_pokemon-is-a-primary-key quirk as elsewhere -- this reverse embed (and the
  // forward trainers -> campaigns embed nested inside it) both come back as single objects.
  const ownerLink = pokemon.trainers_pokemon as unknown as {
    trainers: { user_id: string; campaign_id: string | null; campaigns: { gm_user_id: string } | null } | null
  } | null
  const campaign = pokemon.campaign as unknown as { gm_user_id: string } | null
  // A Wild/pool Pokemon has no trainers_pokemon row -- its GM-tier authority is the campaign's real
  // GM if it's tagged to one, else its creator (see resolveWildPokemonAuthority) -- both isOwner and
  // isGM collapse to that same value here, same reasoning as the Pokemon page's read side.
  const poolAuthority = resolveWildPokemonAuthority(
    { campaignId: pokemon.campaign_id, campaignGmUserId: campaign?.gm_user_id ?? null, createdByUserId: pokemon.created_by_user_id },
    user.id,
  )
  const isOwner = ownerLink ? ownerLink.trainers?.user_id === user.id : poolAuthority
  // No campaign -> no GM to defer to -- falls back to the Trainer's own owner, same rule as
  // addPokemonExp/loadPokemonEvContext/the Pokemon page's read side.
  const isGM = ownerLink
    ? ownerLink.trainers?.campaigns
      ? ownerLink.trainers.campaigns.gm_user_id === user.id
      : ownerLink.trainers?.user_id === user.id
    : poolAuthority

  // Effective campaign: an owned Pokemon's is its Trainer's campaign_id, not its own (possibly
  // vestigial) campaign_id tag -- same "wherever it actually lives" rule as the read-side page.
  const effectiveCampaignId = ownerLink ? ownerLink.trainers?.campaign_id ?? null : pokemon.campaign_id
  const base = pokemonHref({ id: pokemonId, hasOwner: ownerLink !== null, campaignId: effectiveCampaignId })

  if (!isOwner && !isGM) {
    redirect(`${base}?editInfo=1&error=${encodeURIComponent('Not authorized to edit this Pokemon')}`)
  }

  const nicknameRaw = (formData.get('nickname') as string)?.trim()
  const updates: Record<string, string | number | boolean | null> = { nickname: nicknameRaw || null }

  if (isGM) {
    const genderRaw = (formData.get('gender') as string)?.trim()
    if (genderRaw && !POKEMON_GENDER_VALUES.includes(genderRaw as (typeof POKEMON_GENDER_VALUES)[number])) {
      redirect(`${base}?editInfo=1&error=${encodeURIComponent('Invalid gender')}`)
    }
    updates.gender = genderRaw || null

    const natureIdRaw = (formData.get('natureId') as string)?.trim()
    if (natureIdRaw) {
      const { data: nature } = await supabase.from('natures').select('id').eq('id', Number(natureIdRaw)).maybeSingle()
      if (!nature) {
        redirect(`${base}?editInfo=1&error=${encodeURIComponent('Invalid nature')}`)
      }
      updates.nature_id = nature.id
    } else {
      updates.nature_id = null
    }

    updates.is_shiny = formData.get('isShiny') === 'on'

    const type1IdRaw = (formData.get('type1Id') as string)?.trim()
    updates.type_1_id = type1IdRaw ? Number(type1IdRaw) : null

    const type2IdRaw = (formData.get('type2Id') as string)?.trim()
    updates.type_2_id = type2IdRaw ? Number(type2IdRaw) : null

    const sizeIdRaw = (formData.get('sizeId') as string)?.trim()
    updates.size_id = sizeIdRaw ? Number(sizeIdRaw) : null

    const weightIdRaw = (formData.get('weightId') as string)?.trim()
    updates.weight_id = weightIdRaw ? Number(weightIdRaw) : null

    const heldItemIdRaw = (formData.get('heldItemId') as string)?.trim()
    updates.held_item_id = heldItemIdRaw ? Number(heldItemIdRaw) : null
  }

  const { error } = await supabase.from('pokemon').update(updates).eq('id', pokemonId)

  if (error) {
    redirect(`${base}?editInfo=1&error=${encodeURIComponent(error.message)}`)
  }

  // Obtain method lives on trainers_pokemon (the link table), not pokemon itself, so it's a
  // separate update -- still GM-only, still gated the same way as the fields above.
  if (isGM) {
    const obtainMethodIdRaw = (formData.get('obtainMethodId') as string)?.trim()
    const { error: obtainError } = await supabase
      .from('trainers_pokemon')
      .update({ obtain_method_id: obtainMethodIdRaw ? Number(obtainMethodIdRaw) : null })
      .eq('pokemon_id', pokemonId)

    if (obtainError) {
      redirect(`${base}?editInfo=1&error=${encodeURIComponent(obtainError.message)}`)
    }
  }

  redirect(base)
}

const MAX_KNOWN_MOVES = 6

export async function learnMove(
  pokemonId: string,
  moveId: number,
): Promise<{ error: string } | { usesRemaining: number | null; resetsOn: 'rest' | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // No ownership filter needed -- same reasoning as adjustPokemonHp.
  const { data: pokemon } = await supabase
    .from('pokemon')
    .select(
      'current_exp, is_shiny, loyalty_points, pokedex_id, pokedex(growth_rate_id), trainers_pokemon(obtain_method_id)',
    )
    .eq('id', pokemonId)
    .single()

  if (!pokemon) {
    return { error: 'Pokemon not found' }
  }

  // trainers_pokemon.pokemon_id is a primary key, so this reverse embed comes back as a single
  // object at runtime (same quirk documented on the Pokemon page), not the array TS infers.
  const ownerLink = pokemon.trainers_pokemon as unknown as { obtain_method_id: number | null } | null

  const { level } = await computePokemonLevel(supabase, {
    currentExp: pokemon.current_exp,
    isShiny: pokemon.is_shiny,
    loyaltyPoints: pokemon.loyalty_points,
    obtainMethodId: ownerLink?.obtain_method_id ?? null,
    // Same reverse-embed quirk documented throughout this codebase -- a single-field embed like
    // pokedex(growth_rate_id) alongside other scalar columns in the same select() infers as an
    // array here even though it's a single row at runtime.
    growthRateId: (pokemon.pokedex as unknown as { growth_rate_id: number | null } | null)?.growth_rate_id ?? null,
  })

  const { data: known } = await supabase.from('pokemon_moves').select('move_id').eq('pokemon_id', pokemonId)
  const knownMoveIds = (known ?? []).map((k) => k.move_id)

  if (knownMoveIds.length >= MAX_KNOWN_MOVES) {
    return { error: `Already knows ${MAX_KNOWN_MOVES} moves — remove one first` }
  }
  if (knownMoveIds.includes(moveId)) {
    return { error: 'That move is already known' }
  }

  const { data: eligible } = await supabase
    .from('pokedex_moves')
    .select('level_learned, moves(frequency)')
    .eq('pokedex_id', pokemon.pokedex_id)
    .eq('move_id', moveId)
    .maybeSingle()

  if (!eligible || (eligible.level_learned !== null && eligible.level_learned > level)) {
    return { error: 'That move is not eligible to learn yet' }
  }

  // TM/tutor-eligible (level_learned null) additionally requires overlap between the species'
  // Proficiencies and the move's -- a move with zero tagged Proficiencies is unrestricted. Natural
  // level-up moves (level_learned set) were never gated by Proficiency, so this only applies here.
  if (eligible.level_learned === null) {
    const [{ data: moveProficiencies }, { data: pokedexProficiencies }] = await Promise.all([
      supabase.from('moves_proficiencies').select('proficiency_id').eq('move_id', moveId),
      supabase.from('pokedex_proficiencies').select('proficiency_id').eq('pokedex_id', pokemon.pokedex_id),
    ])

    const requiredProficiencyIds = (moveProficiencies ?? []).map((p) => p.proficiency_id)
    if (requiredProficiencyIds.length > 0) {
      const heldProficiencyIds = new Set((pokedexProficiencies ?? []).map((p) => p.proficiency_id))
      if (!requiredProficiencyIds.some((id) => heldProficiencyIds.has(id))) {
        return { error: 'This Pokémon does not have a matching Proficiency for that move' }
      }
    }
  }

  const { maxUses, resetsOn } = parseMoveFrequency(eligible.moves?.frequency ?? '')

  const { error } = await supabase
    .from('pokemon_moves')
    .insert({ pokemon_id: pokemonId, move_id: moveId, uses_remaining: maxUses, resets_on: resetsOn })

  if (error) {
    return { error: error.message }
  }

  return { usesRemaining: maxUses, resetsOn }
}

// "Usable" means tracking uses only -- no hit/damage rolling, per the user's explicit scope. The
// Pokemon page renders one checkbox-styled button per use slot and binds each to the exact
// uses_remaining value clicking it should produce (computed server-side from the slot's index),
// so a mis-click is trivially undoable by clicking the box again -- no separate "undo" action
// needed. Owner-or-GM, same as adjustPokemonHp, since using a move during play is an everyday
// action rather than a GM-adjudicated fact.
export async function setMoveUsesRemaining(
  pokemonId: string,
  moveId: number,
  newUsesRemaining: number,
): Promise<{ error: string } | { usesRemaining: number }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const clamped = Math.max(0, newUsesRemaining)

  const { error } = await supabase
    .from('pokemon_moves')
    .update({ uses_remaining: clamped })
    .eq('pokemon_id', pokemonId)
    .eq('move_id', moveId)

  if (error) {
    return { error: error.message }
  }

  return { usesRemaining: clamped }
}

// Unlike every other Pokemon edit on this page (HP, gender, nature, moves -- all owner-or-GM),
// experience is GM-only per the user's explicit framing ("this is something to be managed by the
// GM"). RLS still permits the owner to UPDATE current_exp (same broad policy as everything else on
// this table), so the GM check has to happen here in the action rather than being enforced by RLS.
export async function addPokemonExp(
  pokemonId: string,
  sign: 1 | -1,
  amount: number,
): Promise<{ error: string } | { currentExp: number; effectiveExp: number; level: number }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  if (!Number.isInteger(amount) || amount < 0) {
    return { error: 'Enter a whole number amount' }
  }

  const { data: pokemon } = await supabase
    .from('pokemon')
    .select(
      'current_exp, is_shiny, loyalty_points, created_by_user_id, campaign_id, campaign:campaign_id(gm_user_id), pokedex(growth_rate_id), trainers_pokemon(obtain_method_id, trainers(user_id, campaigns(gm_user_id)))',
    )
    .eq('id', pokemonId)
    .single()

  if (!pokemon) {
    return { error: 'Pokemon not found' }
  }

  // Same trainers_pokemon-is-a-primary-key quirk as elsewhere -- this reverse embed (and the
  // forward trainers -> campaigns embed nested inside it) both come back as single objects.
  const ownerLink = pokemon.trainers_pokemon as unknown as {
    obtain_method_id: number | null
    trainers: { user_id: string; campaigns: { gm_user_id: string } | null } | null
  } | null
  const campaign = pokemon.campaign as unknown as { gm_user_id: string } | null
  // A Wild/pool Pokemon has no trainers_pokemon row -- its GM-tier authority is the campaign's real
  // GM if it's tagged to one, else its creator (see resolveWildPokemonAuthority). A Trainer-owned
  // Pokemon whose Trainer has no campaign has no GM to defer to either -- falls back to the
  // Trainer's own owner, same "no campaign -> the personal owner has full control" rule already
  // used for Trainer-level GM-tier fields (trainers/actions.ts) and for Wild Pokemon.
  const isGM = ownerLink
    ? ownerLink.trainers?.campaigns
      ? ownerLink.trainers.campaigns.gm_user_id === user.id
      : ownerLink.trainers?.user_id === user.id
    : resolveWildPokemonAuthority(
        { campaignId: pokemon.campaign_id, campaignGmUserId: campaign?.gm_user_id ?? null, createdByUserId: pokemon.created_by_user_id },
        user.id,
      )

  if (!isGM) {
    return { error: 'Only the campaign GM can change experience' }
  }

  const newExp = Math.max(0, pokemon.current_exp + sign * amount)

  const { error } = await supabase.from('pokemon').update({ current_exp: newExp }).eq('id', pokemonId)

  if (error) {
    return { error: error.message }
  }

  // Level is derived, never stored -- recompute it here so the client can update the header's
  // "Level X" display and the Stats section's EV budget without a separate round trip.
  const { level, effectiveExp } = await computePokemonLevel(supabase, {
    currentExp: newExp,
    isShiny: pokemon.is_shiny,
    loyaltyPoints: pokemon.loyalty_points,
    obtainMethodId: ownerLink?.obtain_method_id ?? null,
    // Same reverse-embed quirk documented throughout this codebase -- a single-field embed like
    // pokedex(growth_rate_id) alongside other scalar columns in the same select() infers as an
    // array here even though it's a single row at runtime.
    growthRateId: (pokemon.pokedex as unknown as { growth_rate_id: number | null } | null)?.growth_rate_id ?? null,
  })

  return { currentExp: newExp, effectiveExp, level }
}

// GM-only, mirrors addPokemonExp's shape exactly ((pokemonId, sign, amount) -> new value or error),
// per [[Add a Loyalty editor]] -- LP replaces the old force-a-tier Loyalty <select>. LP also feeds
// the exp-to-level formula (loyaltyModifier), so a change here can shift Level too -- recomputed and
// returned alongside the new LP/tier/modifier so the caller can update both the Loyalty display and
// the header's Level line without a separate round trip.
export async function addPokemonLoyaltyPoints(
  pokemonId: string,
  sign: 1 | -1,
  amount: number,
): Promise<
  | { error: string }
  | { loyaltyPoints: number; loyaltyName: string | null; loyaltyModifier: number; level: number; effectiveExp: number }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  if (!Number.isInteger(amount) || amount < 0) {
    return { error: 'Enter a whole number amount' }
  }

  const { data: pokemon } = await supabase
    .from('pokemon')
    .select(
      'current_exp, is_shiny, loyalty_points, created_by_user_id, campaign_id, campaign:campaign_id(gm_user_id), pokedex(growth_rate_id), trainers_pokemon(obtain_method_id, trainers(user_id, campaigns(gm_user_id)))',
    )
    .eq('id', pokemonId)
    .single()

  if (!pokemon) {
    return { error: 'Pokemon not found' }
  }

  // Same trainers_pokemon-is-a-primary-key quirk as elsewhere -- this reverse embed (and the
  // forward trainers -> campaigns embed nested inside it) both come back as single objects.
  const ownerLink = pokemon.trainers_pokemon as unknown as {
    obtain_method_id: number | null
    trainers: { user_id: string; campaigns: { gm_user_id: string } | null } | null
  } | null
  const campaign = pokemon.campaign as unknown as { gm_user_id: string } | null
  const isGM = ownerLink
    ? ownerLink.trainers?.campaigns
      ? ownerLink.trainers.campaigns.gm_user_id === user.id
      : ownerLink.trainers?.user_id === user.id
    : resolveWildPokemonAuthority(
        { campaignId: pokemon.campaign_id, campaignGmUserId: campaign?.gm_user_id ?? null, createdByUserId: pokemon.created_by_user_id },
        user.id,
      )

  if (!isGM) {
    return { error: 'Only the campaign GM can change Loyalty' }
  }

  const newLoyaltyPoints = Math.max(0, pokemon.loyalty_points + sign * amount)

  const { error } = await supabase.from('pokemon').update({ loyalty_points: newLoyaltyPoints }).eq('id', pokemonId)

  if (error) {
    return { error: error.message }
  }

  const { data: loyaltyRows } = await supabase.from('loyalties').select('name, modifier, sort_order, min_points')
  const tier = computeLoyaltyTier(newLoyaltyPoints, loyaltyRows ?? [])

  const { level, effectiveExp } = await computePokemonLevel(supabase, {
    currentExp: pokemon.current_exp,
    isShiny: pokemon.is_shiny,
    loyaltyPoints: newLoyaltyPoints,
    obtainMethodId: ownerLink?.obtain_method_id ?? null,
    // Same reverse-embed quirk documented throughout this codebase -- a single-field embed like
    // pokedex(growth_rate_id) alongside other scalar columns in the same select() infers as an
    // array here even though it's a single row at runtime.
    growthRateId: (pokemon.pokedex as unknown as { growth_rate_id: number | null } | null)?.growth_rate_id ?? null,
  })

  return { loyaltyPoints: newLoyaltyPoints, loyaltyName: tier?.name ?? null, loyaltyModifier: tier?.modifier ?? 1, level, effectiveExp }
}

export async function forgetMove(pokemonId: string, moveId: number): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Nothing records this move as "forgotten" -- it's simply removed from pokemon_moves, which is
  // exactly what makes it show back up in the learnable list afterward (it's still part of the
  // species' learnset in pokedex_moves), satisfying "relearnable later" for free rather than
  // needing a separate history table.
  const { error } = await supabase.from('pokemon_moves').delete().eq('pokemon_id', pokemonId).eq('move_id', moveId)

  if (error) {
    return { error: error.message }
  }

  return {}
}

// Player's Handbook rule (README.md:93-94): max 3 active Stat Passives per Pokemon, one per
// category. Ability-type Passives are untouched by this -- those stay auto-derived from
// species+level, no learn/unlearn action needed for those.
const MAX_STAT_PASSIVES = 3

export async function learnPassive(
  pokemonId: string,
  passiveId: number,
): Promise<{ error: string } | { passiveId: number }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // No ownership filter needed -- same reasoning as learnMove/adjustPokemonHp, RLS on
  // pokemon_passives already covers both owner and campaign-GM tiers.
  const { data: pokemon } = await supabase
    .from('pokemon')
    .select(
      'current_exp, is_shiny, loyalty_points, pokedex_id, pokedex(growth_rate_id), trainers_pokemon(obtain_method_id)',
    )
    .eq('id', pokemonId)
    .single()

  if (!pokemon) {
    return { error: 'Pokemon not found' }
  }

  const { data: passive } = await supabase.from('passives').select('passive_type, category').eq('id', passiveId).single()

  if (!passive || passive.passive_type !== 'stat') {
    return { error: 'That Passive is not a Stat Passive' }
  }

  // trainers_pokemon.pokemon_id is a primary key, so this reverse embed comes back as a single
  // object at runtime (same quirk documented on the Pokemon page), not the array TS infers.
  const ownerLink = pokemon.trainers_pokemon as unknown as { obtain_method_id: number | null } | null

  const { level } = await computePokemonLevel(supabase, {
    currentExp: pokemon.current_exp,
    isShiny: pokemon.is_shiny,
    loyaltyPoints: pokemon.loyalty_points,
    obtainMethodId: ownerLink?.obtain_method_id ?? null,
    // Same reverse-embed quirk documented throughout this codebase -- a single-field embed like
    // pokedex(growth_rate_id) alongside other scalar columns in the same select() infers as an
    // array here even though it's a single row at runtime.
    growthRateId: (pokemon.pokedex as unknown as { growth_rate_id: number | null } | null)?.growth_rate_id ?? null,
  })

  const { data: eligible } = await supabase
    .from('pokedex_passives')
    .select('level_learned')
    .eq('pokedex_id', pokemon.pokedex_id)
    .eq('passive_id', passiveId)
    .maybeSingle()

  if (!eligible || (eligible.level_learned !== null && eligible.level_learned > level)) {
    return { error: 'That Passive is not eligible to learn yet' }
  }

  const { data: known } = await supabase.from('pokemon_passives').select('passive_id, passives(category)').eq('pokemon_id', pokemonId)
  const knownPassives = known ?? []

  if (knownPassives.some((k) => k.passive_id === passiveId)) {
    return { error: 'That Passive is already known' }
  }
  if (knownPassives.length >= MAX_STAT_PASSIVES) {
    return { error: `Already knows ${MAX_STAT_PASSIVES} Stat Passives — remove one first` }
  }
  if (passive.category && knownPassives.some((k) => k.passives?.category === passive.category)) {
    return { error: `Already has a ${passive.category.replace('_', ' ')} Passive` }
  }

  const { error } = await supabase.from('pokemon_passives').insert({ pokemon_id: pokemonId, passive_id: passiveId })

  if (error) {
    return { error: error.message }
  }

  return { passiveId }
}

export async function unlearnPassive(pokemonId: string, passiveId: number): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { error } = await supabase.from('pokemon_passives').delete().eq('pokemon_id', pokemonId).eq('passive_id', passiveId)

  if (error) {
    return { error: error.message }
  }

  return {}
}

// Owner-or-GM, free and instant -- same reasoning as learnMove/forgetMove: marking a status ailment
// is bookkeeping of something that already happened in the fiction, not a resource-costed action.
// No ownership filter needed -- RLS on pokemon_afflictions already covers both tiers directly.
// Unlike Moves, afflictions aren't species-gated and have no stacking cap, so this is a plain
// insert/delete with no eligibility check.
export async function addAffliction(pokemonId: string, afflictionId: number): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { error } = await supabase.from('pokemon_afflictions').insert({ pokemon_id: pokemonId, affliction_id: afflictionId })

  if (error) {
    return { error: error.message }
  }

  return {}
}

export async function removeAffliction(pokemonId: string, afflictionId: number): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { error } = await supabase.from('pokemon_afflictions').delete().eq('pokemon_id', pokemonId).eq('affliction_id', afflictionId)

  if (error) {
    return { error: error.message }
  }

  return {}
}

// The reverse of the Bag page's giveHeldItem -- unequips this Pokemon's held item and returns it to
// its Trainer's bag (stacks onto an existing matching row, same logic as addToBag). Owner-or-GM, same
// tier as giving. Only meaningful for a Trainer-owned Pokemon -- a Wild/pool Pokemon has no bag to
// return the item to.
export async function takeBackHeldItem(pokemonId: string): Promise<{ error: string } | { ok: true }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: pokemon } = await supabase
    .from('pokemon')
    .select('held_item_id, trainers_pokemon(trainer_id, trainers(user_id, campaigns(gm_user_id)))')
    .eq('id', pokemonId)
    .maybeSingle()

  if (!pokemon) {
    return { error: 'Pokemon not found' }
  }

  if (pokemon.held_item_id === null) {
    return { error: 'This Pokémon is not holding an item' }
  }

  // Same trainers_pokemon-is-a-primary-key quirk as elsewhere -- this reverse embed (and the forward
  // trainers -> campaigns embed nested inside it) both come back as single objects, not arrays.
  const ownerLink = pokemon.trainers_pokemon as unknown as {
    trainer_id: string
    trainers: { user_id: string; campaigns: { gm_user_id: string } | null } | null
  } | null

  if (!ownerLink) {
    return { error: 'This Pokémon does not belong to a Trainer' }
  }

  const isAuthorized = ownerLink.trainers?.user_id === user.id || ownerLink.trainers?.campaigns?.gm_user_id === user.id
  if (!isAuthorized) {
    return { error: 'Not authorized to manage this Pokémon' }
  }

  const itemId = pokemon.held_item_id

  const { error: clearError } = await supabase.from('pokemon').update({ held_item_id: null }).eq('id', pokemonId)
  if (clearError) return { error: clearError.message }

  const { data: existing } = await supabase
    .from('trainers_items')
    .select('id, quantity')
    .eq('trainer_id', ownerLink.trainer_id)
    .eq('item_id', itemId)
    .is('move_id', null)
    .is('pokedex_id', null)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase.from('trainers_items').update({ quantity: existing.quantity + 1 }).eq('id', existing.id)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase
      .from('trainers_items')
      .insert({ trainer_id: ownerLink.trainer_id, item_id: itemId, move_id: null, pokedex_id: null, quantity: 1 })
    if (error) return { error: error.message }
  }

  return { ok: true }
}

// Read-only, called by the client to build the evolve confirmation dialog's Passive-loss warning
// ([[Add Evolution functionality]] Design) before the Trainer/GM commits via evolvePokemon below.
export async function previewEvolution(pokemonId: string, toPokedexId: number): Promise<{ error: string } | { removedPassiveNames: string[] }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const loss = await previewPassiveLoss(supabase, pokemonId, toPokedexId)
  return { removedPassiveNames: loss.map((p) => p.name) }
}

// Applies an evolution (or, via GM override, a devolution/lateral jump to any other species in the
// same chain) per Design's fully-resolved rules:
// - Updates this row's pokedex_id in place -- id/nickname/EVs/current_exp/nature/held item/gender/
//   shininess/learned moves all already live independent of species, untouched here.
// - A GM's custom Size/Weight override shifts by the tier-delta between the old and new species'
//   *defaults*, clamped at the extremes, skipped entirely if Variable is involved anywhere.
// - Any learned Passive the new species doesn't offer is removed automatically (the caller must have
//   already shown the Passive-loss warning via previewEvolution before calling this).
//
// trainersItemId, when provided, is the specific Bag row of the evolution-stone item being consumed --
// required and validated against a real 'item'-typed edge; consuming it uses the same decrement-or-
// delete-at-zero shape as discardItem. Without it, the target must be reachable via a currently-
// satisfied 'level' or 'loyalty' edge (checked against the Pokemon's own computed level/loyalty) -- if
// neither applies, this is only reachable via GM override (isGM required, target must be in the same
// evolution_chain_id as the Pokemon's current species).
export async function evolvePokemon(
  pokemonId: string,
  toPokedexId: number,
  trainersItemId: string | null = null,
): Promise<{ error: string } | { toPokedexId: number; removedPassiveNames: string[] }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: pokemon } = await supabase
    .from('pokemon')
    .select(
      `current_exp, is_shiny, loyalty_points, pokedex_id, size_id, weight_id, created_by_user_id, campaign_id,
       campaign:campaign_id(gm_user_id),
       pokedex(evolution_chain_id, growth_rate_id, size_id, weight_id),
       trainers_pokemon(trainer_id, obtain_method_id, trainers(user_id, campaign_id, campaigns(gm_user_id)))`,
    )
    .eq('id', pokemonId)
    .single()

  if (!pokemon) {
    return { error: 'Pokemon not found' }
  }

  // Same reverse-embed quirk as updatePokemonDetails -- these come back as single objects, not arrays.
  const ownerLink = pokemon.trainers_pokemon as unknown as {
    trainer_id: string
    obtain_method_id: number | null
    trainers: { user_id: string; campaign_id: string | null; campaigns: { gm_user_id: string } | null } | null
  } | null
  const campaign = pokemon.campaign as unknown as { gm_user_id: string } | null
  const fromSpecies = pokemon.pokedex as unknown as { evolution_chain_id: number | null; growth_rate_id: number | null; size_id: number | null; weight_id: number | null } | null

  const poolAuthority = resolveWildPokemonAuthority(
    { campaignId: pokemon.campaign_id, campaignGmUserId: campaign?.gm_user_id ?? null, createdByUserId: pokemon.created_by_user_id },
    user.id,
  )
  const isOwner = ownerLink ? ownerLink.trainers?.user_id === user.id : poolAuthority
  const isGM = ownerLink
    ? ownerLink.trainers?.campaigns
      ? ownerLink.trainers.campaigns.gm_user_id === user.id
      : ownerLink.trainers?.user_id === user.id
    : poolAuthority

  if (!isOwner && !isGM) {
    return { error: 'Not authorized to evolve this Pokemon' }
  }

  const { data: toSpecies } = await supabase
    .from('pokedex')
    .select('id, size_id, weight_id, evolution_chain_id')
    .eq('id', toPokedexId)
    .maybeSingle()
  if (!toSpecies) {
    return { error: 'Target species not found' }
  }

  if (trainersItemId) {
    if (!ownerLink) {
      return { error: 'This Pokemon has no Trainer to hold items' }
    }
    const { data: item } = await supabase
      .from('trainers_items')
      .select('id, item_id, quantity')
      .eq('id', trainersItemId)
      .eq('trainer_id', ownerLink.trainer_id)
      .maybeSingle()
    if (!item) {
      return { error: 'Item not found in this Bag' }
    }
    const { data: edge } = await supabase
      .from('evolution_triggers')
      .select('id')
      .eq('from_pokedex_id', pokemon.pokedex_id)
      .eq('to_pokedex_id', toPokedexId)
      .eq('trigger_type', 'item')
      .eq('item_id', item.item_id)
      .maybeSingle()
    if (!edge) {
      return { error: 'That item does not trigger this evolution' }
    }

    const remaining = item.quantity - 1
    if (remaining > 0) {
      const { error } = await supabase.from('trainers_items').update({ quantity: remaining }).eq('id', item.id)
      if (error) return { error: error.message }
    } else {
      const { error } = await supabase.from('trainers_items').delete().eq('id', item.id)
      if (error) return { error: error.message }
    }
  } else {
    const { level } = await computePokemonLevel(supabase, {
      currentExp: pokemon.current_exp,
      isShiny: pokemon.is_shiny,
      loyaltyPoints: pokemon.loyalty_points,
      obtainMethodId: ownerLink?.obtain_method_id ?? null,
      growthRateId: fromSpecies?.growth_rate_id ?? null,
    })

    const { data: edges } = await supabase
      .from('evolution_triggers')
      .select('trigger_type, level_requirement')
      .eq('from_pokedex_id', pokemon.pokedex_id)
      .eq('to_pokedex_id', toPokedexId)
      .in('trigger_type', ['level', 'loyalty'])

    const levelSatisfied = (edges ?? []).some((e) => e.trigger_type === 'level' && e.level_requirement !== null && level >= e.level_requirement)
    const loyaltySatisfied = (edges ?? []).some((e) => e.trigger_type === 'loyalty') && (await isMaxLoyalty(supabase, pokemon.loyalty_points))

    if (!levelSatisfied && !loyaltySatisfied) {
      // Not a currently-satisfied automatic edge -- only a GM override can do this (skip-ahead,
      // devolve, or an edge that exists but isn't met yet). Must stay within the same known chain.
      if (!isGM) {
        return { error: 'This Pokemon is not eligible to evolve into that species yet' }
      }
      if (fromSpecies?.evolution_chain_id === null || fromSpecies?.evolution_chain_id !== toSpecies.evolution_chain_id) {
        return { error: 'That species is not part of this Pokemon\'s evolution chain' }
      }
    }
  }

  const removedPassives = await previewPassiveLoss(supabase, pokemonId, toPokedexId)

  const newSizeId = await shiftSizeOrWeightOverride(supabase, 'sizes', pokemon.size_id, fromSpecies?.size_id ?? null, toSpecies.size_id)
  const newWeightId = await shiftSizeOrWeightOverride(supabase, 'weights', pokemon.weight_id, fromSpecies?.weight_id ?? null, toSpecies.weight_id)

  const { error: updateError } = await supabase
    .from('pokemon')
    .update({ pokedex_id: toPokedexId, size_id: newSizeId, weight_id: newWeightId })
    .eq('id', pokemonId)

  if (updateError) {
    return { error: updateError.message }
  }

  if (removedPassives.length > 0) {
    const { error: passiveError } = await supabase
      .from('pokemon_passives')
      .delete()
      .eq('pokemon_id', pokemonId)
      .in('passive_id', removedPassives.map((p) => p.passiveId))
    if (passiveError) return { error: passiveError.message }
  }

  return { toPokedexId, removedPassiveNames: removedPassives.map((p) => p.name) }
}
