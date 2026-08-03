'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { pickRandomNatureId } from '@/lib/pta3/nature'
import { pickRandomGender } from '@/lib/pta3/gender'
import { computePokemonLevel } from '@/lib/pta3/pokemonLevel'
import { parseMoveFrequency } from '@/lib/pta3/moveFrequency'
import { EV_STAT_COLUMNS, MAX_EV_PER_STAT, type EvStatKey } from '@/lib/pta3/pokemonEv'
import { resolveWildPokemonAuthority } from '@/lib/pta3/pokemonAuthority'
import { findNextOpenSlot } from '@/lib/pta3/pokemonTeam'
import { pokemonHref } from '@/lib/pta3/pokemonPaths'

const GENDER_VALUES = ['male', 'female', 'genderless'] as const

export async function createPokemon(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const speciesName = (formData.get('species') as string)?.trim()
  const nickname = (formData.get('nickname') as string)?.trim()
  const campaignIdRaw = (formData.get('campaignId') as string)?.trim()
  const trainerIdRaw = (formData.get('trainerId') as string)?.trim()
  const natureChoice = (formData.get('natureId') as string)?.trim()
  const genderChoice = (formData.get('gender') as string)?.trim()

  if (!speciesName) {
    redirect(`/pokemon/new?error=${encodeURIComponent('Species is required')}`)
  }

  const { data: species } = await supabase.from('pokedex').select('id, base_hp').ilike('name', speciesName).single()

  if (!species) {
    redirect(`/pokemon/new?error=${encodeURIComponent(`No species named "${speciesName}" found`)}`)
  }

  // "Random" (the default) rolls one of the seeded natures; a GM can instead pick a specific one
  // -- e.g. a story-appropriate nature for a prepared NPC's Pokemon or a gift -- which the starter
  // flow deliberately doesn't expose (a player doesn't choose their own Pokemon's nature).
  let natureId: number | null
  if (!natureChoice || natureChoice === 'random') {
    natureId = await pickRandomNatureId(supabase)
  } else {
    const { data: nature } = await supabase.from('natures').select('id').eq('id', Number(natureChoice)).maybeSingle()
    if (!nature) {
      redirect(`/pokemon/new?error=${encodeURIComponent('Invalid nature')}`)
    }
    natureId = nature.id
  }

  // Same "Random by default, GM can predetermine" pattern as nature.
  let gender: string | null
  if (!genderChoice || genderChoice === 'random') {
    gender = pickRandomGender()
  } else if (GENDER_VALUES.includes(genderChoice as (typeof GENDER_VALUES)[number])) {
    gender = genderChoice
  } else {
    redirect(`/pokemon/new?error=${encodeURIComponent('Invalid gender')}`)
  }

  // "Which pool does this belong to" (organizational only -- not what actually grants assignment
  // rights below) -- must be a campaign this user GMs.
  let campaignId: string | null = null
  if (campaignIdRaw) {
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id')
      .eq('id', campaignIdRaw)
      .eq('gm_user_id', user.id)
      .maybeSingle()

    if (!campaign) {
      redirect(`/pokemon/new?error=${encodeURIComponent('You are not the GM of that campaign')}`)
    }
    campaignId = campaignIdRaw
  }

  // Assigning straight to a trainer at creation time is gated by that trainer's OWN campaign, not
  // by campaignId above -- a personal-pool (campaign-less) Pokemon can still be handed straight to
  // a trainer in any campaign this user GMs.
  let trainerId: string | null = null
  let trainerCampaignId: string | null = null
  if (trainerIdRaw) {
    const { data: trainer } = await supabase
      .from('trainers')
      .select('id, campaign_id, campaigns(gm_user_id)')
      .eq('id', trainerIdRaw)
      .maybeSingle()

    if (!trainer || !trainer.campaign_id || trainer.campaigns?.gm_user_id !== user.id) {
      redirect(`/pokemon/new?error=${encodeURIComponent('You are not the GM for that trainer')}`)
    }
    trainerId = trainerIdRaw
    trainerCampaignId = trainer.campaign_id
  }

  // Generate the id up front rather than reading it back after insert -- same RETURNING-requires-
  // SELECT-policy reasoning as the starter Pokemon flow (a fresh, still-unassigned Pokemon relies
  // on created_by_user_id for its SELECT policy, which is only checked after this insert lands).
  const pokemonId = crypto.randomUUID()

  const { error: pokemonError } = await supabase.from('pokemon').insert({
    id: pokemonId,
    pokedex_id: species.id,
    nickname: nickname || null,
    current_hp: species.base_hp,
    campaign_id: campaignId,
    created_by_user_id: user.id,
    nature_id: natureId,
    gender,
  })

  if (pokemonError) {
    redirect(`/pokemon/new?error=${encodeURIComponent(pokemonError.message)}`)
  }

  if (trainerId) {
    // Same auto-park behavior as assignPokemon below -- lands on the Team if there's room, parks
    // in the PC (party_slot null) rather than blocking creation if it's already full.
    const { data: existingSlots } = await supabase.from('trainers_pokemon').select('party_slot').eq('trainer_id', trainerId)
    const nextSlot = findNextOpenSlot((existingSlots ?? []).map((r) => r.party_slot))

    const { error: linkError } = await supabase
      .from('trainers_pokemon')
      .insert({ trainer_id: trainerId, pokemon_id: pokemonId, party_slot: nextSlot })

    if (linkError) {
      redirect(`/pokemon/new?error=${encodeURIComponent(linkError.message)}`)
    }

    redirect(pokemonHref({ id: pokemonId, hasOwner: true, campaignId: trainerCampaignId }))
  }

  redirect('/pokemon')
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
      current_exp, current_hp, is_shiny, loyalty_id, created_by_user_id, campaign_id, campaign:campaign_id(gm_user_id),
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
    loyaltyId: ctx.pokemon.loyalty_id,
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
    loyaltyId: ctx.pokemon.loyalty_id,
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
    .select('current_hp, ev_hp, pokedex(base_hp)')
    .eq('id', pokemonId)
    .single()

  if (!pokemon || !pokemon.pokedex) {
    return { error: 'Pokemon not found' }
  }

  const maxHp = pokemon.pokedex.base_hp + pokemon.ev_hp * 6

  // Healing caps at max HP, damage floors at 0 -- unlike the trainer HP control, Pokemon HP has no
  // death-saving-throw use for negative values, so there's nothing for going below 0 to represent.
  const newHp = sign > 0 ? Math.min(maxHp, pokemon.current_hp + amount) : Math.max(0, pokemon.current_hp - amount)

  const { error } = await supabase.from('pokemon').update({ current_hp: newHp }).eq('id', pokemonId)

  if (error) {
    return { error: error.message }
  }

  return { currentHp: newHp }
}

const POKEMON_GENDER_VALUES = ['male', 'female', 'genderless'] as const

// Nickname is owner-or-GM (relies on the same broad RLS policy as HP/moves). Everything else here
// -- Gender, Nature, Loyalty, Shininess, Type 1/2, Size, Weight, Held item -- is GM-only per the
// user's explicit direction ("all of them should be editable by the GM only... let's make it so
// Gender and Nature are also only editable by the GM"). RLS still broadly permits the owner to
// UPDATE this table (same policy that lets Nickname through), so GM-ness has to be checked here
// explicitly -- same technique as addPokemonExp -- rather than relying on RLS to reject an owner
// who tries to smuggle a Gender/Loyalty/etc change into the request.
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

    const loyaltyIdRaw = (formData.get('loyaltyId') as string)?.trim()
    updates.loyalty_id = loyaltyIdRaw ? Number(loyaltyIdRaw) : null

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
      'current_exp, is_shiny, loyalty_id, pokedex_id, pokedex(growth_rate_id), trainers_pokemon(obtain_method_id)',
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
    loyaltyId: pokemon.loyalty_id,
    obtainMethodId: ownerLink?.obtain_method_id ?? null,
    growthRateId: pokemon.pokedex?.growth_rate_id ?? null,
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
      'current_exp, is_shiny, loyalty_id, created_by_user_id, campaign_id, campaign:campaign_id(gm_user_id), pokedex(growth_rate_id), trainers_pokemon(obtain_method_id, trainers(user_id, campaigns(gm_user_id)))',
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
    loyaltyId: pokemon.loyalty_id,
    obtainMethodId: ownerLink?.obtain_method_id ?? null,
    growthRateId: pokemon.pokedex?.growth_rate_id ?? null,
  })

  return { currentExp: newExp, effectiveExp, level }
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
