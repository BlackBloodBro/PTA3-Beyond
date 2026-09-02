'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { POINT_BUY_BUDGET, STAT_KEYS, pointBuyCost, type StatKey } from '@/lib/pta3/pointBuy'
import { isRaringToGoOrigin, RARING_TO_GO_BONUS_TALENT_LEVELS } from '@/lib/pta3/originBonuses'
import { parseMoveFrequency } from '@/lib/pta3/moveFrequency'
import { trainerHref } from '@/lib/pta3/trainerPaths'
import {
  loadTrainerDerived,
  loadPendingMilestone,
  loadQualifyingMilestones,
  loadClassBuilderData,
  computeEffectiveStats,
  computeMaxHp,
  STAT_COLUMNS,
  MILESTONE_HP_GAIN,
  type StatColumn,
  type TrainerFeature,
  type TrainerAdvancedClass,
  type ClassBuilderCard,
} from '@/lib/pta3/trainerFeatures'
import { validateCreationSkillTalentPicks, applySkillTalentPicks, removeSkillTalentPick, loadTrainerSkillTalents } from '@/lib/pta3/skillTalents'

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
    redirect(`/trainers/new?error=${encodeURIComponent(`Point buy must use exactly ${POINT_BUY_BUDGET} points (used ${cost})`)}`)
  }

  // [[Origin - Raring to go has additional feature]]: "choose one stat and raise it by 1" -- a flat
  // +1 on top of the point-buy allocation above, not extra point-buy currency (must re-derive the
  // Origin's name and re-validate the chosen stat server-side, not trust the client alone).
  const { data: origin } = await supabase.from('origins').select('name').eq('id', originId).maybeSingle()
  if (isRaringToGoOrigin(origin?.name)) {
    const raringToGoStatKey = formData.get('raringToGoStatKey') as StatKey
    if (!STAT_KEYS.includes(raringToGoStatKey)) {
      redirect(`/trainers/new?error=${encodeURIComponent('Raring to go: choose a stat to raise by 1')}`)
    }
    stats[raringToGoStatKey] += 1
  }

  const talentResult = await validateCreationSkillTalentPicks(supabase, classId, originId, formData)
  if ('error' in talentResult) {
    redirect(`/trainers/new?error=${encodeURIComponent(talentResult.error)}`)
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

  await applySkillTalentPicks(supabase, trainer.id, talentResult.skillIds)

  // Unlike /starter (one unified route for every trainer regardless of campaign), /build is split
  // into the same 3 campaign-aware paths the sheet itself uses -- a campaigned trainer has to land on
  // its own campaign-scoped build page, not the campaign-less one (which 404s for it).
  redirect(campaignId ? `/campaigns/${campaignId}/trainers/${trainer.id}/build` : `/trainers/${trainer.id}/build`)
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
    .select('campaign_id, is_npc')
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
    redirect(`${trainerHref({ id: trainerId, is_npc: trainer.is_npc, campaign_id: trainer.campaign_id })}?error=${encodeURIComponent(error.message)}`)
  }

  redirect(trainer.is_npc && trainer.campaign_id ? `/campaigns/${trainer.campaign_id}/npcs` : '/trainers')
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

  // "Campaign membership hands GM-tier control to the GM alone" -- Class/Background are GM-tier
  // fields: a campaign-less trainer's owner has full control (no GM to defer to), but once a trainer
  // joins a campaign, changing these requires being that campaign's actual GM, even for the trainer's
  // own owner. Name stays owner-only regardless of this gate (see below). Level used to be grouped in
  // here too, but moved out (2026-08) to match every other build-related action (stat picks, Advanced
  // Class choice, Skill Talent picks on the Class Builder page) -- those were already freely
  // owner-or-GM editable via RLS alone with no extra app-level gate, so Level staying GM-locked was
  // the odd one out, not the rule; a campaign player can now raise their own trainer's Level exactly
  // like they can already resolve their own milestones.
  const canEditGmTier = current.campaign_id ? isGM : isOwner

  const level = Math.max(1, Math.floor(input.level))
  const classId = canEditGmTier ? input.classId : current.class_id
  const originId = canEditGmTier ? input.originId : current.origin_id

  // [[Class can't be edited when editing subclass or level]]: a milestone under the old Class doesn't
  // carry over -- the Trainer re-resolves Stats/Subclass/Talent fresh at each qualifying level under
  // the new Class, same as leveling into it for the first time. trainer_milestones rows are never
  // deleted anywhere else in this codebase (see the note's own Data-integrity finding), so this is a
  // real, deliberate one-way action -- the caller is expected to have already shown an in-page confirm
  // step naming what's being lost (this app's established warn-before-overwrite convention, see
  // [[Warn a GM before overwriting a Trainer's own build choices]]), not a server-side re-confirmation,
  // matching that same convention's "purely client-side gate" precedent.
  if (classId !== current.class_id) {
    const { data: staleMilestones } = await supabase.from('trainer_milestones').select('talent_skill_id').eq('trainer_id', trainerId)
    for (const m of staleMilestones ?? []) {
      if (m.talent_skill_id) {
        await removeSkillTalentPick(supabase, trainerId, m.talent_skill_id)
      }
    }
    const { error: deleteError } = await supabase.from('trainer_milestones').delete().eq('trainer_id', trainerId)
    if (deleteError) {
      return { error: deleteError.message }
    }
  }

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

export type ClassBuilderSnapshot = TrainerInfoSnapshot & {
  cards: ClassBuilderCard[]
  higherLevelPreview: { name: string; levelRequired: number }[]
  pendingMilestoneLevels: number[]
  talents: Record<number, number>
}

// Called directly from a MilestoneCard on the Class Builder page (no <form action>, no redirect) --
// upserts the trainer_milestones row at (trainer_id, level), covering both granting a brand-new
// milestone and editing an already-resolved one, since the card renders identically either way (same
// form, pre-filled when resolved). HP gain and the Skill Talent pick only apply on the INSERT branch
// (this exact milestone didn't already exist) -- editing an already-resolved card's choice later never
// re-grants HP or moves a Talent pick: trainer_skill_talents only tracks a per-skill aggregate count,
// not which source granted which pick, so there's no clean way to reverse-then-reapply if the Advanced
// Class choice changes. No owner/GM check here, same as the two actions this replaces had none --
// resolving/editing a milestone (stat picks, Advanced Class choice, Skill Talent pick) has always been
// freely owner-or-GM editable via RLS alone, campaign or not.
export async function saveMilestone(trainerId: string, level: number, formData: FormData): Promise<{ error: string } | ClassBuilderSnapshot> {
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

  const { data: trainer } = await supabase.from('trainers').select('class_id, origin_id, current_hp, origins(name)').eq('id', trainerId).single()

  if (!trainer) {
    return { error: 'Trainer not found' }
  }

  if (!STAT_COLUMNS.includes(statA as StatColumn) || !STAT_COLUMNS.includes(statB as StatColumn) || statA === statB) {
    return { error: 'Choose two different stats' }
  }
  if (!subclassChoice) {
    return { error: 'Choose an advanced class' }
  }

  // [[Origin - Raring to go has additional feature]]: at level 3, 7, or 11, this Origin grants one
  // additional Skill Talent pick from the same Advanced Class list, on top of the milestone's own.
  const grantsBonusTalent = isRaringToGoOrigin(trainer.origins?.name) && RARING_TO_GO_BONUS_TALENT_LEVELS.includes(level)

  const { data: existing } = await supabase
    .from('trainer_milestones')
    .select('subclass_id, talent_skill_id, bonus_talent_skill_id')
    .eq('trainer_id', trainerId)
    .eq('level', level)
    .maybeSingle()

  const { data: allMilestones } = await supabase.from('trainer_milestones').select('subclass_id').eq('trainer_id', trainerId)
  const heldSubclassIds = (allMilestones ?? []).map((m) => m.subclass_id).filter((subclassId) => subclassId !== existing?.subclass_id)

  const resolved = await resolveSubclassChoice(supabase, trainer.class_id, subclassChoice, formData)
  if ('error' in resolved) {
    return { error: resolved.error }
  }
  const { subclass, chosenStat, chosenTypeId } = resolved

  if (heldSubclassIds.includes(subclass.id)) {
    return { error: 'That advanced class is already chosen' }
  }

  if (existing) {
    // [[Class can't be edited when editing subclass or level]]: "replace," not "add" -- undo this
    // milestone's own previous Skill Talent pick (if it had one) before applying whatever's now
    // submitted, rather than stacking a second pick on top or leaving the stale one in place. Absent
    // talentSkillIdRaw means the picker didn't render at all (every eligible skill already capped
    // elsewhere) -- leave the existing pick untouched in that case, nothing to replace it with.
    const talentSkillIdRaw = formData.get('talentSkillId') as string
    const nextTalentSkillId = talentSkillIdRaw ? Number(talentSkillIdRaw) : existing.talent_skill_id
    const replaceResult = await replaceTalentPick(supabase, trainerId, existing.talent_skill_id, nextTalentSkillId)
    if ('error' in replaceResult) {
      return { error: replaceResult.error }
    }

    // [[Origin - Raring to go has additional feature]]: same replace semantics for the bonus pick,
    // only for the Origin/level combination that actually grants one -- otherwise leave whatever's on
    // the row untouched (there's nothing to replace it with, and it never granted anything blank).
    const bonusTalentSkillIdRaw = grantsBonusTalent ? (formData.get('bonusTalentSkillId') as string) : ''
    const nextBonusTalentSkillId = grantsBonusTalent ? (bonusTalentSkillIdRaw ? Number(bonusTalentSkillIdRaw) : null) : existing.bonus_talent_skill_id
    if (grantsBonusTalent) {
      const bonusReplaceResult = await replaceTalentPick(supabase, trainerId, existing.bonus_talent_skill_id, nextBonusTalentSkillId)
      if ('error' in bonusReplaceResult) {
        return { error: bonusReplaceResult.error }
      }
    }

    const { error } = await supabase
      .from('trainer_milestones')
      .update({
        subclass_id: subclass.id,
        stat_a: statA,
        stat_b: statB,
        chosen_stat: chosenStat,
        chosen_type_id: chosenTypeId,
        talent_skill_id: nextTalentSkillId,
        bonus_talent_skill_id: nextBonusTalentSkillId,
      })
      .eq('trainer_id', trainerId)
      .eq('level', level)
    if (error) {
      return { error: error.message }
    }
  } else {
    // HP gain lives here now rather than in a separate "level up" step -- Level itself is a plain
    // override with no side effects of its own (see updateTrainerInfo), so resolving a milestone is
    // the one place left that actually grants it. Max HP itself is never written -- it's fully derived
    // from trainer_milestones (see computeMaxHp) and will pick up this row the moment it's inserted
    // below; only current_hp is genuine stored state that needs bumping to match.
    const { error: hpError } = await supabase
      .from('trainers')
      .update({ current_hp: trainer.current_hp + MILESTONE_HP_GAIN })
      .eq('id', trainerId)
    if (hpError) {
      return { error: hpError.message }
    }

    // Optional -- absent when every skill this Advanced Class could offer was already at the 2-pick
    // cap from an earlier source, in which case the picker shows no Skill Talent field at all.
    const talentSkillIdRaw = formData.get('talentSkillId') as string
    const talentSkillId = talentSkillIdRaw ? Number(talentSkillIdRaw) : null

    // [[Origin - Raring to go has additional feature]]: the bonus pick, "may take" (optional) rather
    // than required, only offered/read at all for the Origin/level combination that grants one.
    const bonusTalentSkillIdRaw = grantsBonusTalent ? (formData.get('bonusTalentSkillId') as string) : ''
    const bonusTalentSkillId = bonusTalentSkillIdRaw ? Number(bonusTalentSkillIdRaw) : null

    const { error: insertError } = await supabase.from('trainer_milestones').insert({
      trainer_id: trainerId,
      level,
      subclass_id: subclass.id,
      stat_a: statA,
      stat_b: statB,
      hp_gain: MILESTONE_HP_GAIN,
      chosen_stat: chosenStat,
      chosen_type_id: chosenTypeId,
      talent_skill_id: talentSkillId,
      bonus_talent_skill_id: bonusTalentSkillId,
    })
    if (insertError) {
      return { error: insertError.message }
    }

    const skillIdsToGrant = [talentSkillId, bonusTalentSkillId].filter((id): id is number => id !== null)
    if (skillIdsToGrant.length > 0) {
      await applySkillTalentPicks(supabase, trainerId, skillIdsToGrant)
    }
  }

  return buildClassBuilderSnapshot(supabase, trainerId)
}

// [[Class can't be edited when editing subclass or level]] / [[Origin - Raring to go has additional
// feature]]: shared "replace" logic for a single tracked Skill Talent slot on a milestone row -- undoes
// the previous pick (if any) before applying the new one, only when they actually differ. Used for both
// the milestone's own talent_skill_id and Raring to go's bonus_talent_skill_id, which need identical
// replace semantics on re-edit.
async function replaceTalentPick(
  supabase: SupabaseClient,
  trainerId: string,
  previousSkillId: number | null,
  nextSkillId: number | null,
): Promise<{ error: string } | { ok: true }> {
  if (nextSkillId === previousSkillId) return { ok: true }
  if (previousSkillId) {
    const removeResult = await removeSkillTalentPick(supabase, trainerId, previousSkillId)
    if ('error' in removeResult) return removeResult
  }
  if (nextSkillId) {
    const applyResult = await applySkillTalentPicks(supabase, trainerId, [nextSkillId])
    if ('error' in applyResult) return applyResult
  }
  return { ok: true }
}

// Shared tail for saveMilestone and updateBuilderLevel -- both end by re-reading the trainer fresh and
// recomputing every derived value (stats/maxHp/advancedClasses/features/pending+card list) from
// scratch, since nothing is stored as a running total. Re-reading rather than trusting the caller's
// own in-memory values keeps this correct regardless of which write path got here.
async function buildClassBuilderSnapshot(supabase: SupabaseClient, trainerId: string): Promise<{ error: string } | ClassBuilderSnapshot> {
  const { data: updated } = await supabase
    .from('trainers')
    .select(
      `
      name, level, current_hp, origin_id,
      base_attack, base_defense, base_special_attack, base_special_defense, base_speed,
      class_id, classes(name), origins(name, lifestyle)
    `,
    )
    .eq('id', trainerId)
    .single()

  if (!updated) {
    return { error: 'Trainer not found' }
  }

  const milestones = await loadQualifyingMilestones(supabase, trainerId, updated.level)
  const maxHp = computeMaxHp(milestones)
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

  const [{ advancedClasses, activeFeatures, passiveFeatures }, { hasPendingMilestone, nextMilestoneLevel }, builderData, skillTalents] =
    await Promise.all([
      loadTrainerDerived(supabase, trainerId, { classId: updated.class_id, level: updated.level }),
      loadPendingMilestone(supabase, { trainerId, classId: updated.class_id, level: updated.level }),
      loadClassBuilderData(supabase, trainerId, {
        classId: updated.class_id,
        originId: updated.origin_id,
        originName: updated.origins?.name ?? null,
        level: updated.level,
      }),
      loadTrainerSkillTalents(supabase, trainerId),
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
    cards: builderData.cards,
    higherLevelPreview: builderData.higherLevelPreview,
    pendingMilestoneLevels: builderData.pendingMilestoneLevels,
    talents: Object.fromEntries(skillTalents),
  }
}

// The Class Builder page's own Level control -- distinct from updateTrainerInfo (which also handles
// Class/Origin/Name and returns the narrower TrainerInfoSnapshot the Info section already renders):
// this one only ever touches Level, and returns the richer ClassBuilderSnapshot so the page can
// re-render its card list (newly-unlocked milestones, higher-level preview) without a full reload.
// Owner-or-GM, same permission floor as everything else build-related -- see the comment on
// updateTrainerInfo's canEditGmTier for why Level itself no longer needs GM-tier specifically.
export async function updateBuilderLevel(trainerId: string, level: number): Promise<{ error: string } | ClassBuilderSnapshot> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: current } = await supabase
    .from('trainers')
    .select('current_hp, user_id, campaign_id, campaigns(gm_user_id)')
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

  const newLevel = Math.max(1, Math.floor(level))
  const milestones = await loadQualifyingMilestones(supabase, trainerId, newLevel)
  const maxHp = computeMaxHp(milestones)
  // Current HP is only ever clamped down to fit a lower Max HP, never auto-healed up.
  const currentHp = Math.min(current.current_hp, maxHp)

  const { error } = await supabase.from('trainers').update({ level: newLevel, current_hp: currentHp }).eq('id', trainerId)
  if (error) {
    return { error: error.message }
  }

  return buildClassBuilderSnapshot(supabase, trainerId)
}

// Called directly from a client component (no <form action>, no redirect) -- mirrors
// adjustPokemonHp's shape so a Heal/Damage click updates the trainer page in place.
export async function adjustTrainerHp(
  trainerId: string,
  sign: 1 | -1,
  amount: number,
): Promise<{ error: string } | { currentHp: number; temporaryHp: number }> {
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
    .select('current_hp, temporary_hp, level')
    .eq('id', trainerId)
    .single()

  if (!trainer) {
    return { error: 'Trainer not found' }
  }

  // Max HP is never stored (see lib/pta3/trainerFeatures.ts) -- recompute it from this trainer's
  // qualifying milestones every time it's needed, same as everywhere else it's used.
  const maxHp = computeMaxHp(await loadQualifyingMilestones(supabase, trainerId, trainer.level))

  let newHp: number
  let newTempHp = trainer.temporary_hp
  if (sign > 0) {
    // Healing caps at max_hp. Healing never restores or is absorbed by Temp HP -- see
    // [[Let Temporary HP actually be set]].
    newHp = Math.min(maxHp, trainer.current_hp + amount)
  } else {
    // [[Let Temporary HP actually be set]]: damage spends temporary_hp first, down to a floor of 0
    // -- only the remainder (if any) reduces current_hp, which still has no floor (going negative
    // matters for the death-saving-throw rules, unchanged from before).
    const absorbed = Math.min(trainer.temporary_hp, amount)
    newTempHp = trainer.temporary_hp - absorbed
    newHp = trainer.current_hp - (amount - absorbed)
  }

  const { error } = await supabase.from('trainers').update({ current_hp: newHp, temporary_hp: newTempHp }).eq('id', trainerId)

  if (error) {
    return { error: error.message }
  }

  return { currentHp: newHp, temporaryHp: newTempHp }
}

// [[Let Temporary HP actually be set]]: adds to whatever Temp HP already exists (stacks, per the
// user) rather than replacing with the higher value. Owner-or-GM, same tier as adjustTrainerHp.
export async function grantTrainerTemporaryHp(trainerId: string, amount: number): Promise<{ error: string } | { temporaryHp: number }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  if (!Number.isInteger(amount) || amount <= 0) {
    return { error: 'Enter a whole number amount' }
  }

  const { data: trainer } = await supabase.from('trainers').select('temporary_hp').eq('id', trainerId).single()

  if (!trainer) {
    return { error: 'Trainer not found' }
  }

  const newTempHp = trainer.temporary_hp + amount
  const { error } = await supabase.from('trainers').update({ temporary_hp: newTempHp }).eq('id', trainerId)

  if (error) {
    return { error: error.message }
  }

  return { temporaryHp: newTempHp }
}

// [[Let Temporary HP actually be set]]: the manual "fight's over" trigger -- the GM's own stand-in
// for an encounter-end reset until [[Add a combat encounter tracker]] exists to signal that
// automatically. Owner-or-GM, same tier as the grant/adjust actions above.
export async function clearTrainerTemporaryHp(trainerId: string): Promise<{ error: string } | { temporaryHp: number }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { error } = await supabase.from('trainers').update({ temporary_hp: 0 }).eq('id', trainerId)

  if (error) {
    return { error: error.message }
  }

  return { temporaryHp: 0 }
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

export async function restSleep(trainerId: string, formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // No ownership filter -- RLS already covers owner + campaign GM (both have UPDATE rights), and
  // a GM calling a rest for the whole party is the expected use case.
  const { data: trainer } = await supabase.from('trainers').select('level, current_hp, is_npc, campaign_id').eq('id', trainerId).single()

  if (!trainer) {
    redirect('/dashboard')
  }

  const base = trainerHref({ id: trainerId, is_npc: trainer.is_npc, campaign_id: trainer.campaign_id })

  // Max HP is never stored -- recompute it from this trainer's qualifying milestones.
  const maxHp = computeMaxHp(await loadQualifyingMilestones(supabase, trainerId, trainer.level))

  // Per [[Change HP restoration]]: the player physically rolls their own d6 now (RollInputButton's
  // prompt on the Sleep button) instead of this action rolling it server-side -- clamped to [1, 6]
  // here too as a safety net against a tampered/malformed value, not the primary validation.
  const roll = Math.max(1, Math.min(6, Math.floor(Number(formData.get('roll'))) || 1))
  const newTrainerHp = Math.min(maxHp, trainer.current_hp + roll)

  // [[Let Temporary HP actually be set]]: a Sleep rest is one of the two automatic clear triggers
  // -- anything not manually cleared at encounter-end survives until the next rest at the latest.
  const { error: trainerError } = await supabase
    .from('trainers')
    .update({ current_hp: newTrainerHp, temporary_hp: 0 })
    .eq('id', trainerId)

  if (trainerError) {
    redirect(`${base}?error=${encodeURIComponent(trainerError.message)}`)
  }

  // Pokemon heal 1/6th of their total HP on a sleep rest -- "total HP" is the species' base_hp
  // plus the HP EV bonus (1 EV = +6 HP, per the homebrew EV system), the only per-Pokemon HP
  // maximum this app currently models (Pokemon don't yet have their own separately-tracked
  // level-scaled max_hp beyond that). Rounded down, matching this codebase's existing convention
  // for fractional game-math (e.g. stat modifier = floor(value / 2)).
  const { data: trainersPokemon } = await supabase
    .from('trainers_pokemon')
    .select('party_slot, pokemon(id, current_hp, ev_hp, bonus_base_hp, loyalty_points, pokedex(base_hp))')
    .eq('trainer_id', trainerId)

  // [[Add a Loyalty editor]]: Sleep awards LP to every Team Pokemon (party_slot not null),
  // unconditionally -- resting together builds loyalty regardless of HP state. PC-parked Pokemon
  // don't get it (they weren't part of the rest). Amount is tunable data, not a hardcoded constant.
  const { data: sleepEvent } = await supabase.from('loyalty_point_events').select('points').eq('name', 'Sleep').maybeSingle()
  const sleepLoyaltyPoints = sleepEvent?.points ?? 0

  await Promise.all(
    (trainersPokemon ?? []).map((tp) => {
      // trainers_pokemon.pokemon_id is a primary key, so this reverse embed comes back as a single
      // object at runtime (same quirk documented throughout this codebase), not the array TS infers.
      const pokemon = tp.pokemon as unknown as {
        id: string
        current_hp: number
        ev_hp: number
        bonus_base_hp: number
        loyalty_points: number
        pokedex: { base_hp: number } | null
      } | null
      if (!pokemon || !pokemon.pokedex) return Promise.resolve()
      const maxHp = pokemon.pokedex.base_hp + pokemon.bonus_base_hp + pokemon.ev_hp * 6
      const healAmount = Math.floor(maxHp / 6)
      const newHp = Math.min(maxHp, pokemon.current_hp + healAmount)
      // [[Let Temporary HP actually be set]]: same automatic clear trigger as the Trainer's own HP
      // above -- applies to every linked Pokemon (Team or PC), matching this loop's existing
      // healing scope.
      const updates: { current_hp: number; temporary_hp: number; loyalty_points?: number } = { current_hp: newHp, temporary_hp: 0 }
      if (tp.party_slot !== null) {
        updates.loyalty_points = Math.max(0, pokemon.loyalty_points + sleepLoyaltyPoints)
      }
      return supabase.from('pokemon').update(updates).eq('id', pokemon.id)
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
  const pokemonIds = (trainersPokemon ?? [])
    .map((tp) => (tp.pokemon as unknown as { id: string } | null)?.id)
    .filter((v): v is string => !!v)
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
    `${base}?message=${encodeURIComponent(
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
  const { data: trainer } = await supabase.from('trainers').select('id, is_npc, campaign_id').eq('id', trainerId).single()

  if (!trainer) {
    redirect('/dashboard')
  }

  const base = trainerHref({ id: trainerId, is_npc: trainer.is_npc, campaign_id: trainer.campaign_id })

  // Pokemon Centers instantly heal all Pokemon HP to full -- not their move uses, and not the
  // trainer's own HP or activatable features (that's what Sleep is for).
  const { data: trainersPokemon } = await supabase
    .from('trainers_pokemon')
    .select('pokemon(id, current_hp, ev_hp, bonus_base_hp, loyalty_points, pokedex(base_hp))')
    .eq('trainer_id', trainerId)

  // [[Add a Loyalty editor]]: awards LP to every linked Pokemon (Team or PC) that was actually
  // damaged before the heal -- checked against current_hp BEFORE it's overwritten below, since
  // afterward everyone reads as full HP. Not a blanket award -- only Pokemon that were hurt and got
  // looked after.
  const { data: centerEvent } = await supabase
    .from('loyalty_point_events')
    .select('points')
    .eq('name', 'Pokemon Center (damaged)')
    .maybeSingle()
  const centerLoyaltyPoints = centerEvent?.points ?? 0

  await Promise.all(
    (trainersPokemon ?? []).map((tp) => {
      // Same reverse-embed quirk as restSleep above.
      const pokemon = tp.pokemon as unknown as {
        id: string
        current_hp: number
        ev_hp: number
        bonus_base_hp: number
        loyalty_points: number
        pokedex: { base_hp: number } | null
      } | null
      if (!pokemon || !pokemon.pokedex) return Promise.resolve()
      const maxHp = pokemon.pokedex.base_hp + pokemon.bonus_base_hp + pokemon.ev_hp * 6
      const wasDamaged = pokemon.current_hp < maxHp
      // [[Let Temporary HP actually be set]]: the other automatic clear trigger. Trainer-level Temp
      // HP is untouched here -- this action never touches the Trainer's own HP either, that's
      // Sleep's job (see restSleep).
      const updates: { current_hp: number; temporary_hp: number; loyalty_points?: number } = { current_hp: maxHp, temporary_hp: 0 }
      if (wasDamaged) {
        updates.loyalty_points = Math.max(0, pokemon.loyalty_points + centerLoyaltyPoints)
      }
      return supabase.from('pokemon').update(updates).eq('id', pokemon.id)
    }),
  )

  redirect(
    `${base}?message=${encodeURIComponent('All Pokémon fully healed at the Pokémon Center.')}`,
  )
}
