'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { POINT_BUY_BUDGET, STAT_KEYS, pointBuyCost, type StatKey } from '@/lib/pta3/pointBuy'
import { parseMoveFrequency } from '@/lib/pta3/moveFrequency'
import {
  loadTrainerDerived,
  loadPendingMilestone,
  loadQualifyingMilestones,
  computeEffectiveStats,
  computeMaxHp,
  STAT_COLUMNS,
  MILESTONE_HP_GAIN,
  type StatColumn,
  type TrainerFeature,
  type TrainerAdvancedClass,
} from '@/lib/pta3/trainerFeatures'

export async function createTrainer(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const name = (formData.get('name') as string)?.trim()
  const classId = Number(formData.get('classId'))
  const originId = Number(formData.get('originId'))
  const campaignIdRaw = (formData.get('campaignId') as string)?.trim()

  const stats: Record<StatKey, number> = {
    attack: Number(formData.get('attack')),
    defense: Number(formData.get('defense')),
    specialAttack: Number(formData.get('specialAttack')),
    specialDefense: Number(formData.get('specialDefense')),
    speed: Number(formData.get('speed')),
  }

  if (!name) {
    redirect(`/trainers/new?error=${encodeURIComponent('Name is required')}`)
  }
  if (!classId) {
    redirect(`/trainers/new?error=${encodeURIComponent('Class is required')}`)
  }
  if (!originId) {
    redirect(`/trainers/new?error=${encodeURIComponent('Origin is required')}`)
  }
  for (const key of STAT_KEYS) {
    if (!Number.isInteger(stats[key]) || stats[key] < 1 || stats[key] > 6) {
      redirect(`/trainers/new?error=${encodeURIComponent('Each stat must be between 1 and 6')}`)
    }
  }

  const cost = pointBuyCost(stats)
  if (cost !== POINT_BUY_BUDGET) {
    redirect(
      `/trainers/new?error=${encodeURIComponent(
        `Point buy must use exactly ${POINT_BUY_BUDGET} points (used ${cost})`,
      )}`,
    )
  }

  let campaignId: string | null = null
  if (campaignIdRaw) {
    // Verify the user is actually the GM or a joined member of this campaign before assigning it --
    // trainers.campaign_id has no RLS-level ownership check of its own (any value that is a real
    // campaign id would satisfy the foreign key), so this has to be validated here.
    const [{ data: asGM }, { data: asMember }] = await Promise.all([
      supabase.from('campaigns').select('id').eq('id', campaignIdRaw).eq('gm_user_id', user.id).maybeSingle(),
      supabase
        .from('campaign_members')
        .select('campaign_id')
        .eq('campaign_id', campaignIdRaw)
        .eq('user_id', user.id)
        .maybeSingle(),
    ])
    if (!asGM && !asMember) {
      redirect(`/trainers/new?error=${encodeURIComponent('You are not part of that campaign')}`)
    }
    campaignId = campaignIdRaw
  }

  const { data: trainer, error } = await supabase
    .from('trainers')
    .insert({
      user_id: user.id,
      name,
      class_id: classId,
      origin_id: originId,
      campaign_id: campaignId,
      base_attack: stats.attack,
      base_defense: stats.defense,
      base_special_attack: stats.specialAttack,
      base_special_defense: stats.specialDefense,
      base_speed: stats.speed,
    })
    .select('id')
    .single()

  if (error || !trainer) {
    redirect(`/trainers/new?error=${encodeURIComponent(error?.message ?? 'Could not create trainer')}`)
  }

  redirect(`/trainers/${trainer.id}/starter`)
}

export async function deleteTrainer(trainerId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Explicit .eq('user_id', ...) even though RLS already restricts DELETE to the owner (the GM
  // deliberately has no delete rights on trainers) -- this action should only ever mean "delete
  // MY trainer," so it's scoped the same way regardless of what RLS would otherwise allow.
  const { data: trainer } = await supabase
    .from('trainers')
    .select('campaign_id')
    .eq('id', trainerId)
    .eq('user_id', user.id)
    .single()

  if (!trainer) {
    redirect('/dashboard')
  }

  // Deleting the trainer cascades trainers_pokemon (on delete cascade), which unlinks any Pokemon
  // without deleting them -- same "orphan into the pool, don't destroy" behavior as deleting an
  // NPC. But unlike NPCs (always created with created_by_user_id already set), Pokemon from the
  // starter flow predate that column and never got it set -- without this reassignment, such a
  // Pokemon would end up matching no RLS policy at all once its only link is gone, becoming
  // permanently inaccessible to everyone, including this trainer's own (former) owner. Doing this
  // before the delete, while trainers_pokemon still links them, is what makes "Owners can update
  // their pokemon" apply.
  const { data: ownedLinks } = await supabase.from('trainers_pokemon').select('pokemon_id').eq('trainer_id', trainerId)
  const pokemonIds = (ownedLinks ?? []).map((l) => l.pokemon_id)
  if (pokemonIds.length > 0) {
    await supabase.from('pokemon').update({ created_by_user_id: user.id }).in('id', pokemonIds)
  }

  const { error } = await supabase.from('trainers').delete().eq('id', trainerId).eq('user_id', user.id)

  if (error) {
    redirect(`/trainers/${trainerId}?error=${encodeURIComponent(error.message)}`)
  }

  redirect('/trainers')
}

export type TrainerInfoSnapshot = {
  name: string
  level: number
  currentHp: number
  maxHp: number
  attack: number
  defense: number
  specialAttack: number
  specialDefense: number
  speed: number
  advancedClasses: TrainerAdvancedClass[]
  activeFeatures: TrainerFeature[]
  passiveFeatures: TrainerFeature[]
  className: string
  originName: string
  lifestyle: string | null
  hasPendingMilestone: boolean
  nextMilestoneLevel: number | null
}

// Called directly from a client component (no <form action>, no redirect) -- powers the Info
// section's Edit form: Name, Class, Level, and Background, saved together. All of these (other than
// Name) are plain overrides -- same "GM fixes/sets it directly" model as the Pokemon page's GM-only
// edit fields -- scoped to owner-or-GM via RLS, same as HP already is. Deliberately does NOT include
// Subclasses: those are only ever granted through resolveMilestone on the level-up page now (the
// D&D-Beyond-style fix -- the choice lives inside the level-gated feature, not as a freeform override
// outside it), so this form can't create a subclass grant that Level has no way to take back. Level
// itself stays a free override: it does not replay milestone machinery directly, but every stat/HP/
// advanced-class value returned below is recomputed fresh from (level, trainer_milestones), so
// jumping Level up or down here just changes which already-resolved milestones currently qualify --
// nothing can drift out of sync because nothing is stored as a running total anymore. Name stays
// owner-only (a separate update, so it doesn't gate the rest of the fields behind ownership when a
// GM is editing).
export async function updateTrainerInfo(
  trainerId: string,
  input: {
    name: string | null
    classId: number
    level: number
    originId: number
  },
): Promise<{ error: string } | TrainerInfoSnapshot> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: current } = await supabase
    .from('trainers')
    .select('current_hp, user_id, level, class_id, origin_id, campaign_id, campaigns(gm_user_id)')
    .eq('id', trainerId)
    .single()

  if (!current) {
    return { error: 'Trainer not found' }
  }

  const isOwner = current.user_id === user.id
  const isGM = !!current.campaign_id && current.campaigns?.gm_user_id === user.id

  if (!isOwner && !isGM) {
    return { error: 'Not authorized to edit this trainer' }
  }

  // "Campaign membership hands GM-tier control to the GM alone" -- Class/Level/Background are
  // GM-tier fields: a campaign-less trainer's owner has full control (no GM to defer to), but once a
  // trainer joins a campaign, changing these requires being that campaign's actual GM, even for the
  // trainer's own owner. Name stays owner-only regardless of this gate (see below).
  const canEditGmTier = current.campaign_id ? isGM : isOwner

  const level = canEditGmTier ? Math.max(1, Math.floor(input.level)) : current.level
  const classId = canEditGmTier ? input.classId : current.class_id
  const originId = canEditGmTier ? input.originId : current.origin_id

  const milestones = await loadQualifyingMilestones(supabase, trainerId, level)

  // Max HP is always recalculated from scratch here rather than trusted as whatever was already
  // stored -- BASE_MAX_HP plus one MILESTONE_HP_GAIN per qualifying milestone, deterministic from the
  // level this save is setting. Current HP is only ever clamped down to fit, never auto-healed up --
  // this form isn't meant to grant a free heal as a side effect of e.g. renaming.
  const maxHp = computeMaxHp(milestones)
  const currentHp = Math.min(current.current_hp, maxHp)

  const { error } = await supabase
    .from('trainers')
    .update({
      level,
      class_id: classId,
      origin_id: originId,
      current_hp: currentHp,
    })
    .eq('id', trainerId)

  if (error) {
    return { error: error.message }
  }

  if (input.name !== null) {
    const trimmed = input.name.trim()
    if (!trimmed) {
      return { error: 'Name is required' }
    }
    const { error: nameError } = await supabase.from('trainers').update({ name: trimmed }).eq('id', trainerId).eq('user_id', user.id)
    if (nameError) {
      return { error: nameError.message }
    }
  }

  const { data: updated } = await supabase
    .from('trainers')
    .select(
      `
      name, level, current_hp,
      base_attack, base_defense, base_special_attack, base_special_defense, base_speed,
      class_id, classes(name), origins(name, lifestyle)
    `,
    )
    .eq('id', trainerId)
    .single()

  if (!updated) {
    return { error: 'Trainer not found after update' }
  }

  // Reuses `milestones` from the HP recompute above -- it was already loaded for the level this save
  // just wrote, so it's still correct for every derived value below.
  const effectiveStats = computeEffectiveStats(
    {
      attack: updated.base_attack,
      defense: updated.base_defense,
      special_attack: updated.base_special_attack,
      special_defense: updated.base_special_defense,
      speed: updated.base_speed,
    },
    milestones,
  )

  const [{ advancedClasses, activeFeatures, passiveFeatures }, { hasPendingMilestone, nextMilestoneLevel }] = await Promise.all([
    loadTrainerDerived(supabase, trainerId, { classId: updated.class_id, level: updated.level }),
    loadPendingMilestone(supabase, { trainerId, classId: updated.class_id, level: updated.level }),
  ])

  return {
    name: updated.name,
    level: updated.level,
    currentHp: updated.current_hp,
    maxHp,
    attack: effectiveStats.attack,
    defense: effectiveStats.defense,
    specialAttack: effectiveStats.special_attack,
    specialDefense: effectiveStats.special_defense,
    speed: effectiveStats.speed,
    advancedClasses,
    activeFeatures,
    passiveFeatures,
    className: updated.classes?.name ?? '',
    originName: updated.origins?.name ?? '',
    lifestyle: updated.origins?.lifestyle ?? null,
    hasPendingMilestone,
    nextMilestoneLevel,
  }
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

// Shared by resolveMilestone (granting a new milestone) and editMilestone (changing an
// already-granted one) -- both need to turn a submitted subclassChoice into a real subclass row,
// including the "Stat ace"/"Type ace" combined-picker special cases, and the only thing that
// differs between the two callers is what happens with the result.
async function resolveSubclassChoice(
  supabase: SupabaseClient,
  classId: number,
  subclassChoice: string,
  formData: FormData,
): Promise<{ error: string } | { subclass: { id: number; name: string }; chosenStat: string | null; chosenTypeId: number | null }> {
  // "Stat ace" is presented as one combined choice with a stat sub-picker rather than 5
  // separately-named subclasses -- resolve it back to the specific underlying row (e.g. "Stat ace
  // (defense)"), which is what actually gets stored, same as any other subclass pick.
  let chosenStat: string | null = null
  let subclass: { id: number; name: string } | null = null

  if (subclassChoice === 'stat_ace') {
    const statLabel = formData.get('chosenStat') as string
    if (!STAT_COLUMNS.includes(statLabel as StatColumn)) {
      return { error: 'Choose a stat for Stat ace' }
    }
    const { data } = await supabase
      .from('subclasses')
      .select('id, name')
      .eq('class_id', classId)
      .eq('name', `Stat ace (${statLabel.replace('_', ' ')})`)
      .maybeSingle()
    subclass = data
    chosenStat = statLabel
  } else {
    const { data } = await supabase.from('subclasses').select('id, name').eq('id', Number(subclassChoice)).eq('class_id', classId).maybeSingle()
    subclass = data
  }

  if (!subclass) {
    return { error: 'Invalid advanced class for this class' }
  }

  // "Type ace" is a single subclass row with no per-type variants -- the chosen type has nowhere
  // else to live, so it's captured here and stored on the milestone record.
  let chosenTypeId: number | null = null
  if (subclass.name === 'Type ace') {
    const typeIdRaw = Number(formData.get('chosenTypeId'))
    if (!typeIdRaw) {
      return { error: 'Choose a type for Type ace' }
    }
    const { data: type } = await supabase.from('types').select('id').eq('id', typeIdRaw).maybeSingle()
    if (!type) {
      return { error: 'Invalid type' }
    }
    chosenTypeId = typeIdRaw
  }

  return { subclass, chosenStat, chosenTypeId }
}

export async function resolveMilestone(trainerId: string, formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const statA = formData.get('statA') as string
  const statB = formData.get('statB') as string
  const subclassChoice = formData.get('subclassChoice') as string

  if (!STAT_COLUMNS.includes(statA as StatColumn) || !STAT_COLUMNS.includes(statB as StatColumn) || statA === statB) {
    redirect(`/trainers/${trainerId}/level-up?error=${encodeURIComponent('Choose two different stats')}`)
  }
  if (!subclassChoice) {
    redirect(`/trainers/${trainerId}/level-up?error=${encodeURIComponent('Choose an advanced class')}`)
  }

  const { data: trainer } = await supabase.from('trainers').select('class_id, level, current_hp').eq('id', trainerId).single()

  if (!trainer) {
    redirect('/dashboard')
  }

  // Recompute the pending milestone server-side rather than trusting the level-up page's own gate --
  // same "first features.level_required <= trainer.level with no existing trainer_milestones row"
  // check, keyed by (trainer_id, level) so a milestone already resolved before (then temporarily
  // uncounted by a level-down/up) is never re-offered here either.
  const { hasPendingMilestone, nextMilestoneLevel: milestoneLevel } = await loadPendingMilestone(supabase, {
    trainerId,
    classId: trainer.class_id,
    level: trainer.level,
  })

  if (!hasPendingMilestone || !milestoneLevel) {
    redirect(`/trainers/${trainerId}?error=${encodeURIComponent('No pending milestone to resolve')}`)
  }

  const heldSubclassIds = (await loadQualifyingMilestones(supabase, trainerId, trainer.level)).map((m) => m.subclass_id)

  const resolved = await resolveSubclassChoice(supabase, trainer.class_id, subclassChoice, formData)
  if ('error' in resolved) {
    redirect(`/trainers/${trainerId}/level-up?error=${encodeURIComponent(resolved.error)}`)
  }
  const { subclass, chosenStat, chosenTypeId } = resolved

  if (heldSubclassIds.includes(subclass.id)) {
    redirect(`/trainers/${trainerId}/level-up?error=${encodeURIComponent('That advanced class is already chosen')}`)
  }

  // HP gain lives here now rather than in a separate "level up" step -- the Info section's Level
  // field is a plain override with no side effects of its own (see updateTrainerInfo), so resolving
  // a milestone is the one place left that actually grants it. Max HP itself is no longer written --
  // it's fully derived from trainer_milestones (see computeMaxHp) and will pick up this row the
  // moment it's inserted below; only current_hp is genuine stored state that needs bumping to match.
  const { error } = await supabase
    .from('trainers')
    .update({ current_hp: trainer.current_hp + MILESTONE_HP_GAIN })
    .eq('id', trainerId)

  if (error) {
    redirect(`/trainers/${trainerId}/level-up?error=${encodeURIComponent(error.message)}`)
  }

  const { error: milestoneError } = await supabase.from('trainer_milestones').insert({
    trainer_id: trainerId,
    level: milestoneLevel,
    subclass_id: subclass.id,
    stat_a: statA,
    stat_b: statB,
    hp_gain: MILESTONE_HP_GAIN,
    chosen_stat: chosenStat,
    chosen_type_id: chosenTypeId,
  })

  if (milestoneError) {
    redirect(`/trainers/${trainerId}?error=${encodeURIComponent(milestoneError.message)}`)
  }

  redirect(`/trainers/${trainerId}`)
}

// Lets an owner/GM change which subclass and which 2 stats an already-resolved milestone granted,
// without needing to level all the way back down and up through it again. Deliberately scoped to
// editing the CHOICE a specific, already-earned milestone made (same row, same level, same HP
// grant) rather than reintroducing a freeform override -- HP is untouched here since the milestone
// count isn't changing, only which subclass/stats it points at.
export async function editMilestone(trainerId: string, level: number, formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const statA = formData.get('statA') as string
  const statB = formData.get('statB') as string
  const subclassChoice = formData.get('subclassChoice') as string

  if (!STAT_COLUMNS.includes(statA as StatColumn) || !STAT_COLUMNS.includes(statB as StatColumn) || statA === statB) {
    redirect(`/trainers/${trainerId}/level-up/${level}?error=${encodeURIComponent('Choose two different stats')}`)
  }
  if (!subclassChoice) {
    redirect(`/trainers/${trainerId}/level-up/${level}?error=${encodeURIComponent('Choose an advanced class')}`)
  }

  const { data: trainer } = await supabase.from('trainers').select('class_id').eq('id', trainerId).single()

  if (!trainer) {
    redirect('/dashboard')
  }

  const { data: existing } = await supabase
    .from('trainer_milestones')
    .select('subclass_id')
    .eq('trainer_id', trainerId)
    .eq('level', level)
    .maybeSingle()

  if (!existing) {
    redirect(`/trainers/${trainerId}?error=${encodeURIComponent('No milestone at that level to edit')}`)
  }

  const { data: allMilestones } = await supabase.from('trainer_milestones').select('subclass_id').eq('trainer_id', trainerId)
  const heldSubclassIds = (allMilestones ?? []).map((m) => m.subclass_id).filter((subclassId) => subclassId !== existing.subclass_id)

  const resolved = await resolveSubclassChoice(supabase, trainer.class_id, subclassChoice, formData)
  if ('error' in resolved) {
    redirect(`/trainers/${trainerId}/level-up/${level}?error=${encodeURIComponent(resolved.error)}`)
  }
  const { subclass, chosenStat, chosenTypeId } = resolved

  if (heldSubclassIds.includes(subclass.id)) {
    redirect(`/trainers/${trainerId}/level-up/${level}?error=${encodeURIComponent('That advanced class is already chosen')}`)
  }

  const { error } = await supabase
    .from('trainer_milestones')
    .update({ subclass_id: subclass.id, stat_a: statA, stat_b: statB, chosen_stat: chosenStat, chosen_type_id: chosenTypeId })
    .eq('trainer_id', trainerId)
    .eq('level', level)

  if (error) {
    redirect(`/trainers/${trainerId}/level-up/${level}?error=${encodeURIComponent(error.message)}`)
  }

  redirect(`/trainers/${trainerId}`)
}

// Called directly from a client component (no <form action>, no redirect) -- mirrors
// adjustPokemonHp's shape so a Heal/Damage click updates the trainer page in place.
export async function adjustTrainerHp(trainerId: string, sign: 1 | -1, amount: number): Promise<{ error: string } | { currentHp: number }> {
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

  // No ownership filter needed -- RLS already covers both the trainer's owner and the campaign's
  // GM (both have UPDATE rights), and this control should work for either.
  const { data: trainer } = await supabase
    .from('trainers')
    .select('current_hp, level')
    .eq('id', trainerId)
    .single()

  if (!trainer) {
    return { error: 'Trainer not found' }
  }

  // Max HP is never stored (see lib/pta3/trainerFeatures.ts) -- recompute it from this trainer's
  // qualifying milestones every time it's needed, same as everywhere else it's used.
  const maxHp = computeMaxHp(await loadQualifyingMilestones(supabase, trainerId, trainer.level))

  // Healing caps at max_hp; damage has no floor, since going negative matters for the
  // death-saving-throw rules.
  const newHp = sign > 0 ? Math.min(maxHp, trainer.current_hp + amount) : trainer.current_hp - amount

  const { error } = await supabase.from('trainers').update({ current_hp: newHp }).eq('id', trainerId)

  if (error) {
    return { error: error.message }
  }

  return { currentHp: newHp }
}

// Called directly from a client component -- see adjustTrainerHp above.
export async function useFeatureCharge(
  trainerId: string,
  featureId: number,
  maxUses: number,
): Promise<{ error: string } | { usesRemaining: number }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // No stored row yet means the feature hasn't been used this cycle -- treat it as starting at
  // max_uses (matching how trainer_moves.uses_remaining works for granted moves).
  const { data: existing } = await supabase
    .from('trainer_feature_uses')
    .select('uses_remaining')
    .eq('trainer_id', trainerId)
    .eq('feature_id', featureId)
    .maybeSingle()

  const current = existing?.uses_remaining ?? maxUses
  const newRemaining = Math.max(0, current - 1)

  const { error } = await supabase
    .from('trainer_feature_uses')
    .upsert({ trainer_id: trainerId, feature_id: featureId, uses_remaining: newRemaining })

  if (error) {
    return { error: error.message }
  }

  return { usesRemaining: newRemaining }
}

// Called directly from a client component -- see adjustTrainerHp above.
export async function resetFeatureUses(
  trainerId: string,
  featureId: number,
  maxUses: number,
): Promise<{ error: string } | { usesRemaining: number }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { error } = await supabase
    .from('trainer_feature_uses')
    .upsert({ trainer_id: trainerId, feature_id: featureId, uses_remaining: maxUses })

  if (error) {
    return { error: error.message }
  }

  return { usesRemaining: maxUses }
}

export async function restSleep(trainerId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // No ownership filter -- RLS already covers owner + campaign GM (both have UPDATE rights), and
  // a GM calling a rest for the whole party is the expected use case.
  const { data: trainer } = await supabase.from('trainers').select('level, current_hp').eq('id', trainerId).single()

  if (!trainer) {
    redirect('/dashboard')
  }

  // Max HP is never stored -- recompute it from this trainer's qualifying milestones.
  const maxHp = computeMaxHp(await loadQualifyingMilestones(supabase, trainerId, trainer.level))

  const roll = Math.floor(Math.random() * 6) + 1
  const newTrainerHp = Math.min(maxHp, trainer.current_hp + roll)

  const { error: trainerError } = await supabase
    .from('trainers')
    .update({ current_hp: newTrainerHp })
    .eq('id', trainerId)

  if (trainerError) {
    redirect(`/trainers/${trainerId}?error=${encodeURIComponent(trainerError.message)}`)
  }

  // Pokemon heal 1/6th of their total HP on a sleep rest -- "total HP" is the species' base_hp
  // plus the HP EV bonus (1 EV = +6 HP, per the homebrew EV system), the only per-Pokemon HP
  // maximum this app currently models (Pokemon don't yet have their own separately-tracked
  // level-scaled max_hp beyond that). Rounded down, matching this codebase's existing convention
  // for fractional game-math (e.g. stat modifier = floor(value / 2)).
  const { data: trainersPokemon } = await supabase
    .from('trainers_pokemon')
    .select('pokemon(id, current_hp, ev_hp, pokedex(base_hp))')
    .eq('trainer_id', trainerId)

  await Promise.all(
    (trainersPokemon ?? []).map((tp) => {
      const pokemon = tp.pokemon
      if (!pokemon || !pokemon.pokedex) return Promise.resolve()
      const maxHp = pokemon.pokedex.base_hp + pokemon.ev_hp * 6
      const healAmount = Math.floor(maxHp / 6)
      const newHp = Math.min(maxHp, pokemon.current_hp + healAmount)
      return supabase.from('pokemon').update({ current_hp: newHp }).eq('id', pokemon.id)
    }),
  )

  // Recharge any activatable feature whose uses reset on a rest -- deleting the trainer_feature_uses
  // row is enough, since its absence already reads as "at max_uses" everywhere it's displayed.
  const { data: restFeatures } = await supabase.from('features').select('id').eq('uses_reset_on', 'rest')
  const restFeatureIds = (restFeatures ?? []).map((f) => f.id)

  if (restFeatureIds.length > 0) {
    await supabase.from('trainer_feature_uses').delete().eq('trainer_id', trainerId).in('feature_id', restFeatureIds)
  }

  // Recharge rest-reset Pokemon moves too (Pokemon Center deliberately does not do this -- see
  // restPokemonCenter). Unlike features, uses_remaining lives directly on pokemon_moves rather than
  // a separate "uses" table, so there's nothing to delete -- each move's cap is re-derived from its
  // frequency ("N/day" -> N) and written back, the same parsing learnMove used to set it initially.
  const pokemonIds = (trainersPokemon ?? []).map((tp) => tp.pokemon?.id).filter((v): v is string => !!v)
  if (pokemonIds.length > 0) {
    const { data: movesToReset } = await supabase
      .from('pokemon_moves')
      .select('pokemon_id, move_id, moves(frequency)')
      .in('pokemon_id', pokemonIds)
      .eq('resets_on', 'rest')

    await Promise.all(
      (movesToReset ?? []).map((pm) => {
        const { maxUses } = parseMoveFrequency(pm.moves?.frequency ?? '')
        if (maxUses === null) return Promise.resolve()
        return supabase
          .from('pokemon_moves')
          .update({ uses_remaining: maxUses })
          .eq('pokemon_id', pm.pokemon_id)
          .eq('move_id', pm.move_id)
      }),
    )
  }

  redirect(
    `/trainers/${trainerId}?message=${encodeURIComponent(
      `Slept and rolled a ${roll} — healed to ${newTrainerHp}/${maxHp} HP. Rest-based features and Pokémon move uses recharged.`,
    )}`,
  )
}

export async function restPokemonCenter(trainerId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // No ownership filter -- same reasoning as restSleep.
  const { data: trainer } = await supabase.from('trainers').select('id').eq('id', trainerId).single()

  if (!trainer) {
    redirect('/dashboard')
  }

  // Pokemon Centers instantly heal all Pokemon HP to full -- not their move uses, and not the
  // trainer's own HP or activatable features (that's what Sleep is for).
  const { data: trainersPokemon } = await supabase
    .from('trainers_pokemon')
    .select('pokemon(id, ev_hp, pokedex(base_hp))')
    .eq('trainer_id', trainerId)

  await Promise.all(
    (trainersPokemon ?? []).map((tp) => {
      const pokemon = tp.pokemon
      if (!pokemon || !pokemon.pokedex) return Promise.resolve()
      const maxHp = pokemon.pokedex.base_hp + pokemon.ev_hp * 6
      return supabase.from('pokemon').update({ current_hp: maxHp }).eq('id', pokemon.id)
    }),
  )

  redirect(
    `/trainers/${trainerId}?message=${encodeURIComponent('All Pokémon fully healed at the Pokémon Center.')}`,
  )
}
