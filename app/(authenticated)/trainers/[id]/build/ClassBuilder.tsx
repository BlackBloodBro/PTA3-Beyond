'use client'

import { useState } from 'react'
import { useTrainerState, StatsSection, SkillsSection, type StatBreakdown } from '@/app/(authenticated)/trainers/[id]/TrainerInteractive'
import { updateBuilderLevel, updateTrainerInfo, type ClassBuilderSnapshot } from '@/app/(authenticated)/trainers/actions'
import type { ClassBuilderCard, TrainerFeature } from '@/lib/pta3/trainerFeatures'
import { MilestoneCard } from './MilestoneCard'

// The Class Builder page's body -- a Level selector, the fixed Stats/Skills panel (never buried under
// the scrollable list, per explicit feedback), the level-gated Class Features list (plain cards +
// MilestoneCard for "Advanced class" choices), and a collapsed higher-level preview. Consumes
// TrainerStateProvider's context (same as the trainer sheet) so a milestone/Level save flows through
// the existing applyInfoSnapshot-shaped update -- no separate state machine.
export function ClassBuilder({
  trainerId,
  classes,
  canEditClass,
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
  // "Campaign membership hands GM-tier control to the GM alone" -- same rule as TrainerInfoSection's
  // own canEditGmTier, computed by the caller since only it knows whether this Trainer/NPC has a
  // campaign at all (this component alone can't tell from useTrainerState()).
  canEditClass: boolean
  initialCards: ClassBuilderCard[]
  initialHigherLevelPreview: { name: string; levelRequired: number }[]
  statBreakdown: StatBreakdown
  skills: { id: number; name: string; stats: { name: string } | null }[]
  initialTalents: Record<number, number>
  favoredStatNames: string[]
  originFeatures: TrainerFeature[]
  focusLevel?: number
}) {
  const { name, level, originId, className, classId, advancedClasses, applyInfoSnapshot, baseAttack, baseDefense, baseSpecialAttack, baseSpecialDefense, baseSpeed } =
    useTrainerState()

  const [cards, setCards] = useState(initialCards)
  const [higherLevelPreview, setHigherLevelPreview] = useState(initialHigherLevelPreview)
  const [talents, setTalents] = useState(initialTalents)
  const [levelInput, setLevelInput] = useState(String(level))
  const [levelError, setLevelError] = useState<string | null>(null)
  const [levelSaving, setLevelSaving] = useState(false)

  // [[Class can't be edited when editing subclass or level]]: a workflow convenience so a GM/owner
  // doesn't have to leave mid-resolution to change Class elsewhere -- reuses updateTrainerInfo (not a
  // new action), same as Info's own Class control, gated by the same canEditClass rule (see above).
  const [isEditingClass, setIsEditingClass] = useState(false)
  const [draftClassId, setDraftClassId] = useState(classId)
  const [classError, setClassError] = useState<string | null>(null)
  const [classSaving, setClassSaving] = useState(false)
  const [pendingClassChange, setPendingClassChange] = useState(false)

  function openClassEdit() {
    setDraftClassId(classId)
    setClassError(null)
    setPendingClassChange(false)
    setIsEditingClass(true)
  }

  function handleClassSave() {
    if (draftClassId !== classId && advancedClasses.length > 0) {
      setPendingClassChange(true)
      return
    }
    commitClassSave()
  }

  // Changing Class invalidates almost everything this page shows (Class Features cards, higher-level
  // preview, Skill Talent bonuses, favored stats) -- rather than hand-recomputing every one of those
  // from updateTrainerInfo's TrainerInfoSnapshot return shape (which doesn't carry them), a full
  // reload after a successful save gets a fully consistent page. Deliberate exception to this app's
  // usual no-full-reload convention -- this is a rare, already-confirmed, genuinely page-invalidating
  // action, not a case worth a bespoke re-fetch just to avoid one reload.
  async function commitClassSave() {
    setClassError(null)
    setClassSaving(true)
    // [[Feature - Let a GM edit a Trainer's base stats]]: this save only ever changes Class -- pass the
    // current base stats through unchanged rather than dropping them (updateTrainerInfo writes whatever
    // it's given for a GM-tier caller, same as Class/Origin here).
    const result = await updateTrainerInfo(trainerId, {
      name: null,
      classId: draftClassId,
      level,
      originId,
      attack: baseAttack,
      defense: baseDefense,
      specialAttack: baseSpecialAttack,
      specialDefense: baseSpecialDefense,
      speed: baseSpeed,
    })
    setClassSaving(false)
    if ('error' in result) {
      setClassError(result.error)
      setPendingClassChange(false)
      return
    }
    window.location.reload()
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

  return (
    <div className="flex w-full max-w-3xl flex-col gap-4">
      {canEditClass && (
        <div className="rounded border border-accent bg-accent/10 p-4">
          {isEditingClass ? (
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold">Class</h2>
                <select
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

              {classError && <p className="text-danger text-sm">{classError}</p>}

              {pendingClassChange ? (
                <div className="flex flex-col gap-2 rounded border-accent bg-accent/20 p-2">
                  <p>
                    Changing Class will remove{' '}
                    {advancedClasses.map((ac, i) => (
                      <span key={ac.grantedAtLevel}>
                        {i > 0 && ', '}
                        {ac.name} (Level {ac.grantedAtLevel})
                      </span>
                    ))}
                    . {name} will need to re-resolve these under the new Class.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={commitClassSave}
                      disabled={classSaving}
                      className="rounded border border-danger px-3 py-1 text-sm text-danger disabled:opacity-50"
                    >
                      {classSaving ? 'Saving…' : 'Confirm'}
                    </button>
                    <button type="button" onClick={() => setPendingClassChange(false)} className="rounded border px-3 py-1 text-sm">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleClassSave}
                    disabled={classSaving}
                    className="rounded bg-accent px-3 py-1 text-accent-foreground disabled:opacity-50"
                  >
                    {classSaving ? 'Saving…' : 'Save'}
                  </button>
                  <button type="button" onClick={() => setIsEditingClass(false)} className="rounded border px-3 py-1">
                    Cancel
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <p>
                <span className="font-semibold">Class:</span> {className}
              </p>
              <button type="button" onClick={openClassEdit} className="rounded border px-3 py-1 text-sm">
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
