'use client'

import { useState } from 'react'
import { useTrainerState, StatsSection, SkillsSection, type StatBreakdown } from '@/app/(authenticated)/trainers/[id]/TrainerInteractive'
import {
  updateBuilderLevel,
  updateTrainerInfo,
  updateTrainerSkillTalents,
  type ClassBuilderSnapshot,
} from '@/app/(authenticated)/trainers/actions'
import type { ClassBuilderCard, TrainerFeature } from '@/lib/pta3/trainerFeatures'
import type { SkillOption, OriginSkillTalentGroup } from '@/lib/pta3/skillTalents'
import { MilestoneCard } from './MilestoneCard'

// The Class Builder page's body -- a Level selector, the fixed Stats/Skills panel (never buried under
// the scrollable list, per explicit feedback), the level-gated Class Features list (plain cards +
// MilestoneCard for "Advanced class" choices), and a collapsed higher-level preview. Consumes
// TrainerStateProvider's context (same as the trainer sheet) so a milestone/Level save flows through
// the existing applyInfoSnapshot-shaped update -- no separate state machine.
//
// [[Improvement - Move Trainer editing (Name, Origin, Talents, Stats) to the build page]]: this page
// is now also where Name/Class/Origin/Base Stats are edited (relocated from the old Info-card inline
// form, which stays read-only display + a Link here now) and where Class/Origin Skill Talent picks can
// be re-chosen after creation for the first time ever.
export function ClassBuilder({
  trainerId,
  classes,
  origins,
  canEditName,
  canEditGmTier,
  classTalentOptions,
  originTalentGroups,
  initialBaseClassSkillIds,
  initialBaseOriginSkillIds,
  initialCards,
  initialHigherLevelPreview,
  statBreakdown,
  skills,
  initialTalents,
  favoredStatNames,
  originFeatures,
  focusLevel,
}: {
  trainerId: string
  classes: { id: number; name: string }[]
  origins: { id: number; name: string; lifestyle: string | null }[]
  // [[Improvement - Move Trainer editing (Name, Origin, Talents, Stats) to the build page]]: Name now
  // uses the plain owner-or-GM floor (isOwner || isGM) -- a deliberate change from the old owner-only
  // rule, distinct from canEditGmTier below.
  canEditName: boolean
  // "Campaign membership hands GM-tier control to the GM alone" -- same rule as the old
  // TrainerInfoSection's own canEditGmTier, computed by the caller since only it knows whether this
  // Trainer/NPC has a Campaign at all (this component alone can't tell from useTrainerState()). Now
  // also gates Origin, Base Stats, and Skill Talent re-picks, not just Class.
  canEditGmTier: boolean
  classTalentOptions: Record<number, SkillOption[]>
  originTalentGroups: Record<number, OriginSkillTalentGroup[]>
  initialBaseClassSkillIds: number[]
  initialBaseOriginSkillIds: number[]
  initialCards: ClassBuilderCard[]
  initialHigherLevelPreview: { name: string; levelRequired: number }[]
  statBreakdown: StatBreakdown
  skills: { id: number; name: string; stats: { name: string } | null }[]
  initialTalents: Record<number, number>
  favoredStatNames: string[]
  originFeatures: TrainerFeature[]
  focusLevel?: number
}) {
  const {
    name,
    level,
    originId,
    className,
    originName,
    classId,
    advancedClasses,
    applyInfoSnapshot,
    baseAttack,
    baseDefense,
    baseSpecialAttack,
    baseSpecialDefense,
    baseSpeed,
  } = useTrainerState()

  const [cards, setCards] = useState(initialCards)
  const [higherLevelPreview, setHigherLevelPreview] = useState(initialHigherLevelPreview)
  const [talents, setTalents] = useState(initialTalents)
  const [levelInput, setLevelInput] = useState(String(level))
  const [levelError, setLevelError] = useState<string | null>(null)
  const [levelSaving, setLevelSaving] = useState(false)

  const canEditInfo = canEditName || canEditGmTier

  // [[Improvement - Move Trainer editing (Name, Origin, Talents, Stats) to the build page]]: one
  // combined edit panel for everything that used to be the Info card's own inline form (Name/Class/
  // Level stayed a dedicated control below/Origin/Base Stats), now permission-split per field instead
  // of all-or-nothing -- Name uses canEditName, everything else uses canEditGmTier, matching
  // updateTrainerInfo's own server-side gate.
  const [isEditingInfo, setIsEditingInfo] = useState(false)
  const [draftName, setDraftName] = useState(name)
  const [draftClassId, setDraftClassId] = useState(classId)
  const [draftOriginId, setDraftOriginId] = useState(originId)
  const [draftAttack, setDraftAttack] = useState(baseAttack)
  const [draftDefense, setDraftDefense] = useState(baseDefense)
  const [draftSpecialAttack, setDraftSpecialAttack] = useState(baseSpecialAttack)
  const [draftSpecialDefense, setDraftSpecialDefense] = useState(baseSpecialDefense)
  const [draftSpeed, setDraftSpeed] = useState(baseSpeed)
  const [infoError, setInfoError] = useState<string | null>(null)
  const [infoSaving, setInfoSaving] = useState(false)
  // [[Class can't be edited when editing subclass or level]] / [[Origin - Raring to go has additional
  // feature]]: a Class or Origin change wipes every Advanced Class milestone AND this Trainer's base
  // Class/Origin Skill Talent picks (see updateTrainerInfo) -- shown regardless of whether there are
  // any milestones yet, since the Talent wipe alone is always something to warn about now.
  const [pendingInfoChange, setPendingInfoChange] = useState(false)

  function openInfoEdit() {
    setDraftName(name)
    setDraftClassId(classId)
    setDraftOriginId(originId)
    setDraftAttack(baseAttack)
    setDraftDefense(baseDefense)
    setDraftSpecialAttack(baseSpecialAttack)
    setDraftSpecialDefense(baseSpecialDefense)
    setDraftSpeed(baseSpeed)
    setInfoError(null)
    setPendingInfoChange(false)
    setIsEditingInfo(true)
  }

  function handleInfoSave() {
    if (draftClassId !== classId || draftOriginId !== originId) {
      setPendingInfoChange(true)
      return
    }
    commitInfoSave()
  }

  // Changing Class or Origin invalidates almost everything this page shows (Class Features cards,
  // higher-level preview, Skill Talent options, favored stats, Origin Features) -- rather than
  // hand-recomputing every one of those from updateTrainerInfo's TrainerInfoSnapshot return shape
  // (which doesn't carry them), a full reload after a successful Class/Origin change gets a fully
  // consistent page, including the Talent section below re-fetching its now-wiped base picks fresh
  // from the server. Deliberate exception to this app's usual no-full-reload convention -- same
  // precedent this page's own Class control already established.
  async function commitInfoSave() {
    setInfoError(null)
    setInfoSaving(true)
    const result = await updateTrainerInfo(trainerId, {
      name: canEditName ? draftName : null,
      classId: draftClassId,
      level,
      originId: draftOriginId,
      attack: draftAttack,
      defense: draftDefense,
      specialAttack: draftSpecialAttack,
      specialDefense: draftSpecialDefense,
      speed: draftSpeed,
    })
    setInfoSaving(false)
    if ('error' in result) {
      setInfoError(result.error)
      setPendingInfoChange(false)
      return
    }
    if (draftClassId !== classId || draftOriginId !== originId) {
      window.location.reload()
      return
    }
    applyInfoSnapshot(result, draftClassId, draftOriginId)
    setIsEditingInfo(false)
  }

  const favoredSet = new Set(favoredStatNames)

  function applySnapshot(snapshot: ClassBuilderSnapshot) {
    applyInfoSnapshot(snapshot, classId, originId)
    setCards(snapshot.cards)
    setHigherLevelPreview(snapshot.higherLevelPreview)
    setTalents(snapshot.talents)
    setLevelInput(String(snapshot.level))
  }

  async function handleLevelChange(raw: string) {
    setLevelInput(raw)
    const newLevel = Number(raw)
    if (!Number.isInteger(newLevel) || newLevel < 1) return
    setLevelError(null)
    setLevelSaving(true)
    const result = await updateBuilderLevel(trainerId, newLevel)
    setLevelSaving(false)
    if ('error' in result) {
      setLevelError(result.error)
      return
    }
    applySnapshot(result)
  }

  // [[Improvement - Move Trainer editing (Name, Origin, Talents, Stats) to the build page]]: the
  // Skill Talent re-pick section -- previously there was no way to change these after creation at
  // all. Same checkbox-picker shape as TrainerForm's creation-time picker (classId/originId here are
  // always the Trainer's *current* ones from context, which only ever change via the full reload
  // above, so classSkillOptions/originGroups are always in sync with what's actually on the Trainer).
  const classSkillOptions = classTalentOptions[classId] ?? []
  const currentOriginGroups = originTalentGroups[originId] ?? []

  const [classTalentSkillIds, setClassTalentSkillIds] = useState<Set<number>>(new Set(initialBaseClassSkillIds))
  const [originGroupPicks, setOriginGroupPicks] = useState<Set<number>[]>(() =>
    currentOriginGroups.map((g) => new Set(initialBaseOriginSkillIds.filter((id) => g.skills.some((s) => s.id === id)))),
  )
  const [talentError, setTalentError] = useState<string | null>(null)
  const [talentSaving, setTalentSaving] = useState(false)

  function toggleClassTalent(skillId: number) {
    setClassTalentSkillIds((prev) => {
      const next = new Set(prev)
      if (next.has(skillId)) {
        next.delete(skillId)
      } else if (next.size < 2) {
        next.add(skillId)
      }
      return next
    })
  }

  function toggleOriginTalent(groupIndex: number, pickCount: number, skillId: number) {
    setOriginGroupPicks((prev) => {
      const next = [...prev]
      const current = new Set(next[groupIndex] ?? [])
      if (current.has(skillId)) {
        current.delete(skillId)
      } else if (current.size < pickCount) {
        current.add(skillId)
      }
      next[groupIndex] = current
      return next
    })
  }

  const classTalentsSatisfied = classSkillOptions.length === 0 || classTalentSkillIds.size === 2
  const originTalentsSatisfied = currentOriginGroups.every((g, i) => (originGroupPicks[i]?.size ?? 0) === g.pickCount)

  async function handleTalentSave() {
    setTalentError(null)
    setTalentSaving(true)
    const result = await updateTrainerSkillTalents(
      trainerId,
      [...classTalentSkillIds],
      originGroupPicks.flatMap((s) => [...s]),
    )
    setTalentSaving(false)
    if ('error' in result) {
      setTalentError(result.error)
      return
    }
    setTalents(result.talents)
  }

  return (
    <div className="flex w-full max-w-3xl flex-col gap-4">
      {canEditInfo && (
        <div className="rounded border border-accent bg-accent/10 p-4">
          {isEditingInfo ? (
            <div className="flex flex-col gap-3 text-sm">
              {canEditName && (
                <div className="flex flex-col gap-1">
                  <label htmlFor="trainerName" className="font-semibold">
                    Trainer name
                  </label>
                  <input
                    id="trainerName"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    className="bg-surface-subtle rounded border p-2"
                  />
                </div>
              )}

              {canEditGmTier && (
                <>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="trainerClass" className="font-semibold">
                      Class
                    </label>
                    <select
                      id="trainerClass"
                      value={draftClassId}
                      onChange={(e) => setDraftClassId(Number(e.target.value))}
                      className="bg-surface-subtle rounded border p-2"
                    >
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label htmlFor="trainerOrigin" className="font-semibold">
                      Origin
                    </label>
                    <select
                      id="trainerOrigin"
                      value={draftOriginId}
                      onChange={(e) => setDraftOriginId(Number(e.target.value))}
                      className="bg-surface-subtle rounded border p-2"
                    >
                      {origins.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                          {o.lifestyle ? ` (${o.lifestyle})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* [[Feature - Let a GM edit a Trainer's base stats]] */}
                  <div>
                    <p className="font-semibold">Base stats</p>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex flex-col gap-1">
                        Attack
                        <input
                          type="number"
                          value={draftAttack}
                          onChange={(e) => setDraftAttack(Math.max(0, Number(e.target.value)))}
                          className="bg-surface-subtle rounded border p-2"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        Defense
                        <input
                          type="number"
                          value={draftDefense}
                          onChange={(e) => setDraftDefense(Math.max(0, Number(e.target.value)))}
                          className="bg-surface-subtle rounded border p-2"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        Special Attack
                        <input
                          type="number"
                          value={draftSpecialAttack}
                          onChange={(e) => setDraftSpecialAttack(Math.max(0, Number(e.target.value)))}
                          className="bg-surface-subtle rounded border p-2"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        Special Defense
                        <input
                          type="number"
                          value={draftSpecialDefense}
                          onChange={(e) => setDraftSpecialDefense(Math.max(0, Number(e.target.value)))}
                          className="bg-surface-subtle rounded border p-2"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        Speed
                        <input
                          type="number"
                          value={draftSpeed}
                          onChange={(e) => setDraftSpeed(Math.max(0, Number(e.target.value)))}
                          className="bg-surface-subtle rounded border p-2"
                        />
                      </label>
                    </div>
                  </div>
                </>
              )}

              {infoError && <p className="text-danger">{infoError}</p>}

              {pendingInfoChange ? (
                <div className="flex flex-col gap-2 rounded border-accent bg-accent/20 p-2">
                  <p>
                    Changing {draftClassId !== classId && draftOriginId !== originId ? 'Class or Origin' : draftClassId !== classId ? 'Class' : 'Origin'}{' '}
                    will clear {name}&apos;s Class/Origin Skill Talent picks
                    {advancedClasses.length > 0 && (
                      <>
                        {' '}
                        and remove{' '}
                        {advancedClasses.map((ac, i) => (
                          <span key={ac.grantedAtLevel}>
                            {i > 0 && ', '}
                            {ac.name} (Level {ac.grantedAtLevel})
                          </span>
                        ))}
                      </>
                    )}
                    . {name} will need to re-pick Talents{advancedClasses.length > 0 ? ' and re-resolve these choices' : ''}.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={commitInfoSave}
                      disabled={infoSaving}
                      className="rounded border border-danger px-3 py-1 text-sm text-danger disabled:opacity-50"
                    >
                      {infoSaving ? 'Saving…' : 'Confirm'}
                    </button>
                    <button type="button" onClick={() => setPendingInfoChange(false)} className="rounded border px-3 py-1 text-sm">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleInfoSave}
                    disabled={infoSaving}
                    className="rounded bg-accent px-3 py-1 text-accent-foreground disabled:opacity-50"
                  >
                    {infoSaving ? 'Saving…' : 'Save'}
                  </button>
                  <button type="button" onClick={() => setIsEditingInfo(false)} className="rounded border px-3 py-1">
                    Cancel
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm">
                <p>
                  <span className="font-semibold">Class:</span> {className}
                </p>
                <p>
                  <span className="font-semibold">Origin:</span> {originName}
                </p>
              </div>
              <button type="button" onClick={openInfoEdit} className="rounded border px-3 py-1 text-sm">
                Edit
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between rounded border border-accent bg-accent/10 p-4">
        <h2 className="font-semibold">Level</h2>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            value={levelInput}
            onChange={(e) => handleLevelChange(e.target.value)}
            className="bg-surface-subtle w-20 rounded border p-2 text-center"
          />
          {levelSaving && <span className="text-sm text-muted">Saving…</span>}
        </div>
      </div>
      {levelError && <p className="text-danger text-sm">{levelError}</p>}

      <StatsSection breakdown={statBreakdown} favoredStatNames={favoredSet} />
      <SkillsSection skills={skills} talents={talents} />

      {canEditGmTier && (classSkillOptions.length > 0 || currentOriginGroups.length > 0) && (
        <section className="rounded border border-accent bg-accent/10 p-4">
          <h2 className="mb-2 font-semibold">Skill Talents</h2>

          {classSkillOptions.length > 0 && (
            <fieldset className="mb-3 flex flex-col gap-2 rounded border p-3 text-sm">
              <legend className="px-1 font-medium">Class Skill Talents (choose 2)</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {/* A Talent already at picked_count 2 (Expert) from other sources -- a Milestone, or
                    the Origin picker below when the same skill is picked from both -- can't be picked
                    a third time (applySkillTalentPicks' own cap), so it's excluded here entirely,
                    same as AdvancedClassPicker.tsx's own heldSkillTalents filter -- unless it's this
                    Trainer's own already-checked pick, which has to stay selectable to uncheck. */}
                {classSkillOptions
                  .filter((s) => (talents[s.id] ?? 0) < 2 || classTalentSkillIds.has(s.id))
                  .map((s) => (
                    <label key={s.id} className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={classTalentSkillIds.has(s.id)}
                        disabled={!classTalentSkillIds.has(s.id) && classTalentSkillIds.size >= 2}
                        onChange={() => toggleClassTalent(s.id)}
                      />
                      {s.name}
                    </label>
                  ))}
              </div>
              <p className="text-xs text-muted">{classTalentSkillIds.size} / 2 picked</p>
            </fieldset>
          )}

          {currentOriginGroups.map((group, i) => (
            <fieldset key={i} className="mb-3 flex flex-col gap-2 rounded border p-3 text-sm">
              <legend className="px-1 font-medium">
                Origin Skill Talents (choose {group.pickCount}
                {currentOriginGroups.length > 1 ? ` -- group ${i + 1}` : ''})
              </legend>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {group.skills
                  .filter((s) => (talents[s.id] ?? 0) < 2 || (originGroupPicks[i]?.has(s.id) ?? false))
                  .map((s) => (
                    <label key={s.id} className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={originGroupPicks[i]?.has(s.id) ?? false}
                        disabled={!(originGroupPicks[i]?.has(s.id) ?? false) && (originGroupPicks[i]?.size ?? 0) >= group.pickCount}
                        onChange={() => toggleOriginTalent(i, group.pickCount, s.id)}
                      />
                      {s.name}
                    </label>
                  ))}
              </div>
              <p className="text-xs text-muted">
                {originGroupPicks[i]?.size ?? 0} / {group.pickCount} picked
              </p>
            </fieldset>
          ))}

          {talentError && <p className="text-danger text-sm">{talentError}</p>}

          <button
            type="button"
            onClick={handleTalentSave}
            disabled={talentSaving || !classTalentsSatisfied || !originTalentsSatisfied}
            className="rounded bg-accent px-3 py-1 text-accent-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            {talentSaving ? 'Saving…' : 'Save Talents'}
          </button>
        </section>
      )}

      {originFeatures.length > 0 && (
        <section className="rounded border border-accent bg-accent/10 p-4">
          <h2 className="mb-2 font-semibold">Origin Features</h2>
          <ul className="flex flex-col gap-2">
            {originFeatures.map((f) => (
              <li key={f.id}>
                <details className="rounded border p-3">
                  <summary className="cursor-pointer font-medium">{f.name}</summary>
                  <p className="mt-1 text-sm text-muted">{f.description}</p>
                </details>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded border border-accent bg-accent/10 p-4">
        <h2 className="mb-2 font-semibold">Class Features</h2>
        <div className="flex flex-col gap-2">
          {cards.length === 0 && <p className="text-sm text-muted">No Class features yet.</p>}
          {cards.map((card) =>
            card.kind === 'milestone' ? (
              <MilestoneCard
                key={`milestone-${card.triggerLevel}`}
                trainerId={trainerId}
                name={card.name}
                description={card.description}
                triggerLevel={card.triggerLevel}
                resolved={card.resolved}
                showBonusTalent={card.showBonusTalent}
                current={card.current}
                options={card.options}
                focused={card.triggerLevel === focusLevel}
                onSaved={applySnapshot}
              />
            ) : (
              <details key={`${card.feature.id}-${card.subclassName ?? ''}`} className="rounded border p-3">
                <summary className="cursor-pointer font-medium">
                  {card.feature.name}{' '}
                  <span className="text-sm font-normal text-muted">
                    Level {card.feature.level_required}
                    {card.subclassName ? ` · ${card.subclassName}` : ''}
                  </span>
                </summary>
                <p className="mt-1 text-sm text-muted">{card.feature.description}</p>
              </details>
            ),
          )}
        </div>

        {higherLevelPreview.length > 0 && (
          <details className="mt-3 rounded border p-3">
            <summary className="cursor-pointer text-sm font-medium">Available at Higher Levels ({higherLevelPreview.length})</summary>
            <ul className="mt-2 flex flex-col gap-1 text-sm text-muted">
              {higherLevelPreview.map((f, i) => (
                <li key={i}>
                  {f.name} — Level {f.levelRequired}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
    </div>
  )
}
