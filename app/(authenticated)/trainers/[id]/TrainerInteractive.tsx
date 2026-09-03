'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createContext, useContext, useState, type ReactNode } from 'react'
import { statModifier } from '@/lib/pta3/pointBuy'
import { talentBonus } from '@/lib/pta3/skillTalents'
import {
  adjustTrainerHp,
  grantTrainerTemporaryHp,
  clearTrainerTemporaryHp,
  updateTrainerInfo,
  setFeatureUsesRemaining,
  resetFeatureUses,
} from '@/app/(authenticated)/trainers/actions'
import type { TrainerFeature, TrainerAdvancedClass } from '@/lib/pta3/trainerFeatures'
import { ClickTooltip } from '@/components/ClickTooltip'

export type { TrainerFeature, TrainerAdvancedClass }

type StatField = 'attack' | 'defense' | 'special_attack' | 'special_defense' | 'speed'

const STAT_FIELD_BY_NAME: Record<string, StatField> = {
  Attack: 'attack',
  Defense: 'defense',
  'Special Attack': 'special_attack',
  'Special Defense': 'special_defense',
  Speed: 'speed',
}

const STAT_LABELS: Record<StatField, string> = {
  attack: 'Attack',
  defense: 'Defense',
  special_attack: 'Special Attack',
  special_defense: 'Special Defense',
  speed: 'Speed',
}

export type StatBreakdown = Record<StatField, { base: number; increases: { level: number; subclassName: string }[] }>

type TrainerState = {
  name: string
  level: number
  currentHp: number
  temporaryHp: number
  maxHp: number
  attack: number
  defense: number
  special_attack: number
  special_defense: number
  speed: number
  // [[Feature - Let a GM edit a Trainer's base stats]]: the raw base_* columns, distinct from the
  // effective attack/defense/etc. above (which already have milestone stat increases baked in via
  // computeEffectiveStats) -- the edit form has to draft from and write back to these, never the
  // effective ones, or every save would re-bake already-applied milestone increases into the stored
  // base stat, compounding on every edit.
  baseAttack: number
  baseDefense: number
  baseSpecialAttack: number
  baseSpecialDefense: number
  baseSpeed: number
  advancedClasses: TrainerAdvancedClass[]
  activeFeatures: TrainerFeature[]
  passiveFeatures: TrainerFeature[]
  usesRemainingByFeature: Record<number, number>
  classId: number
  className: string
  originId: number
  originName: string
  lifestyle: string | null
  hasPendingMilestone: boolean
  nextMilestoneLevel: number | null
}

// Matches updateTrainerInfo's return shape (app/trainers/actions.ts) -- applied wholesale to state
// after every save, so the client never has to know which specific fields changed.
type InfoSnapshot = {
  name: string
  level: number
  currentHp: number
  maxHp: number
  attack: number
  defense: number
  specialAttack: number
  specialDefense: number
  speed: number
  baseAttack: number
  baseDefense: number
  baseSpecialAttack: number
  baseSpecialDefense: number
  baseSpeed: number
  advancedClasses: TrainerAdvancedClass[]
  activeFeatures: TrainerFeature[]
  passiveFeatures: TrainerFeature[]
  className: string
  originName: string
  lifestyle: string | null
  hasPendingMilestone: boolean
  nextMilestoneLevel: number | null
}

type TrainerContextValue = TrainerState & {
  trainerId: string
  basePath: string
  isOwner: boolean
  isGM: boolean
  applyInfoSnapshot: (snapshot: InfoSnapshot, classId: number, originId: number) => void
  setCurrentHp: (hp: number) => void
  setTemporaryHp: (hp: number) => void
  setFeatureUses: (featureId: number, usesRemaining: number) => void
}

const TrainerStateContext = createContext<TrainerContextValue | null>(null)

export function useTrainerState() {
  const ctx = useContext(TrainerStateContext)
  if (!ctx) throw new Error('useTrainerState must be used within TrainerStateProvider')
  return ctx
}

export function TrainerStateProvider({
  trainerId,
  basePath,
  isOwner,
  isGM,
  initialName,
  initialLevel,
  initialCurrentHp,
  initialTemporaryHp,
  initialMaxHp,
  initialStats,
  initialBaseStats,
  initialAdvancedClasses,
  initialActiveFeatures,
  initialPassiveFeatures,
  initialUsesRemainingByFeature,
  initialClassId,
  initialClassName,
  initialOriginId,
  initialOriginName,
  initialLifestyle,
  initialHasPendingMilestone,
  initialNextMilestoneLevel,
  children,
}: {
  trainerId: string
  basePath: string
  isOwner: boolean
  isGM: boolean
  initialName: string
  initialLevel: number
  initialCurrentHp: number
  initialTemporaryHp: number
  initialMaxHp: number
  initialStats: { attack: number; defense: number; special_attack: number; special_defense: number; speed: number }
  initialBaseStats: { attack: number; defense: number; special_attack: number; special_defense: number; speed: number }
  initialAdvancedClasses: TrainerAdvancedClass[]
  initialActiveFeatures: TrainerFeature[]
  initialPassiveFeatures: TrainerFeature[]
  initialUsesRemainingByFeature: Record<number, number>
  initialClassId: number
  initialClassName: string
  initialOriginId: number
  initialOriginName: string
  initialLifestyle: string | null
  initialHasPendingMilestone: boolean
  initialNextMilestoneLevel: number | null
  children: ReactNode
}) {
  const [state, setState] = useState<TrainerState>({
    name: initialName,
    level: initialLevel,
    currentHp: initialCurrentHp,
    temporaryHp: initialTemporaryHp,
    maxHp: initialMaxHp,
    ...initialStats,
    baseAttack: initialBaseStats.attack,
    baseDefense: initialBaseStats.defense,
    baseSpecialAttack: initialBaseStats.special_attack,
    baseSpecialDefense: initialBaseStats.special_defense,
    baseSpeed: initialBaseStats.speed,
    advancedClasses: initialAdvancedClasses,
    activeFeatures: initialActiveFeatures,
    passiveFeatures: initialPassiveFeatures,
    usesRemainingByFeature: initialUsesRemainingByFeature,
    classId: initialClassId,
    className: initialClassName,
    originId: initialOriginId,
    originName: initialOriginName,
    lifestyle: initialLifestyle,
    hasPendingMilestone: initialHasPendingMilestone,
    nextMilestoneLevel: initialNextMilestoneLevel,
  })

  const value: TrainerContextValue = {
    ...state,
    trainerId,
    basePath,
    isOwner,
    isGM,
    applyInfoSnapshot: (snapshot, classId, originId) =>
      setState((prev) => ({
        ...prev,
        name: snapshot.name,
        level: snapshot.level,
        currentHp: snapshot.currentHp,
        maxHp: snapshot.maxHp,
        attack: snapshot.attack,
        defense: snapshot.defense,
        special_attack: snapshot.specialAttack,
        special_defense: snapshot.specialDefense,
        speed: snapshot.speed,
        baseAttack: snapshot.baseAttack,
        baseDefense: snapshot.baseDefense,
        baseSpecialAttack: snapshot.baseSpecialAttack,
        baseSpecialDefense: snapshot.baseSpecialDefense,
        baseSpeed: snapshot.baseSpeed,
        advancedClasses: snapshot.advancedClasses,
        activeFeatures: snapshot.activeFeatures,
        passiveFeatures: snapshot.passiveFeatures,
        classId,
        className: snapshot.className,
        originId,
        originName: snapshot.originName,
        lifestyle: snapshot.lifestyle,
        hasPendingMilestone: snapshot.hasPendingMilestone,
        nextMilestoneLevel: snapshot.nextMilestoneLevel,
      })),
    setCurrentHp: (hp) => setState((prev) => ({ ...prev, currentHp: hp })),
    setTemporaryHp: (hp) => setState((prev) => ({ ...prev, temporaryHp: hp })),
    setFeatureUses: (featureId, usesRemaining) =>
      setState((prev) => ({ ...prev, usesRemainingByFeature: { ...prev.usesRemainingByFeature, [featureId]: usesRemaining } })),
  }

  return <TrainerStateContext.Provider value={value}>{children}</TrainerStateContext.Provider>
}

// The page's <h1> reads from context too, so editing the name from the Info section below keeps
// the page title in sync instead of going stale until a real reload.
export function TrainerNameHeading() {
  const { name } = useTrainerState()
  return <>{name}</>
}

// Reactive replacement for the old server-rendered-once "Resolve now" banner -- hasPendingMilestone
// now comes from context, since editing Level or Class from the Info section below can create (or
// clear) a pending milestone without a page reload to recompute it.
export function PendingMilestoneBanner() {
  const { basePath, hasPendingMilestone, nextMilestoneLevel } = useTrainerState()
  if (!hasPendingMilestone) return null
  return (
    <div className="flex w-full max-w-6xl items-center justify-between rounded border border-accent bg-accent/10 p-4 text-accent">
      <span>Level {nextMilestoneLevel} unlocked a stat increase and advanced class choice.</span>
      <Link href={`${basePath}/build?level=${nextMilestoneLevel}`} className="rounded bg-accent px-3 py-1 text-sm text-accent-foreground">
        Resolve now
      </Link>
    </div>
  )
}

type ClassOption = { id: number; name: string }
type OriginOption = { id: number; name: string; lifestyle: string | null }

// The trainer's Info card. View mode shows Trainer name, Class, Level (its own line, no per-item
// levels), Subclasses (names only), Background, Lifestyle, and a Campaign link. Edit mode
// (owner-or-GM, matching the old level +/- control's own permission) turns Class/Level/Background
// into a single form; Name is owner-only within it, same scoping renameTrainer had. Deliberately no
// Subclass picker here -- Subclasses are only ever granted through saveMilestone on the Class Builder
// page now (the choice lives inside the level-gated feature, not as a freeform override outside it),
// so Level dropping below a milestone always has something real to lose. Level moving through a
// milestone, or a Class change, can flip hasPendingMilestone -- context carries that so the banner
// above stays in sync without a reload.
export function TrainerInfoSection({
  trainerId,
  campaign,
  classes,
  origins,
}: {
  trainerId: string
  campaign: { id: string; name: string } | null
  classes: ClassOption[]
  origins: OriginOption[]
}) {
  const {
    basePath,
    name,
    level,
    advancedClasses,
    className,
    originName,
    lifestyle,
    classId,
    originId,
    baseAttack,
    baseDefense,
    baseSpecialAttack,
    baseSpecialDefense,
    baseSpeed,
    isOwner,
    isGM,
    applyInfoSnapshot,
  } = useTrainerState()
  const router = useRouter()

  const [isEditing, setIsEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // [[Class can't be edited when editing subclass or level]] / [[Bug - Changing a Trainer's Origin
  // doesn't update Raring to go's bonuses]]: changing Class OR Origin deletes every Advanced Class
  // milestone (server-side, updateTrainerInfo -- Origin now wipes for the same reason Class does:
  // Raring to go's bonus Talent picks live on those same milestone rows, so an Origin change has to
  // invalidate them too, not just a Class change) -- an in-page confirm step naming exactly what's lost
  // before that happens, matching [[Warn a GM before overwriting a Trainer's own build choices]]'s
  // established shape (purely client-side gate, no server-side re-confirmation needed).
  const [pendingMilestoneWipe, setPendingMilestoneWipe] = useState(false)

  const [draftName, setDraftName] = useState(name)
  const [draftClassId, setDraftClassId] = useState(classId)
  const [draftLevel, setDraftLevel] = useState(level)
  const [draftOriginId, setDraftOriginId] = useState(originId)
  // [[Feature - Let a GM edit a Trainer's base stats]]: drafts from the raw base_* values, not the
  // effective attack/defense/etc. (which already have milestone stat increases baked in) -- direct
  // replacement, not an additive bonus, since unlike Pokemon's bonus_base_x columns there's no species
  // template underneath a Trainer's base stats to layer a bonus on top of.
  const [draftAttack, setDraftAttack] = useState(baseAttack)
  const [draftDefense, setDraftDefense] = useState(baseDefense)
  const [draftSpecialAttack, setDraftSpecialAttack] = useState(baseSpecialAttack)
  const [draftSpecialDefense, setDraftSpecialDefense] = useState(baseSpecialDefense)
  const [draftSpeed, setDraftSpeed] = useState(baseSpeed)

  const canEdit = isOwner || isGM
  // "Campaign membership hands GM-tier control to the GM alone" -- a campaign-less trainer's owner
  // has full control over Class/Level/Background (no GM to defer to); once the trainer is in a
  // Campaign, changing those requires being that campaign's actual GM, even for the trainer's own
  // owner. Name stays owner-only regardless (see the isOwner check below), unaffected by this gate.
  // updateTrainerInfo enforces this same rule server-side -- this only controls what's rendered.
  const canEditGmTier = campaign ? isGM : isOwner

  function openEdit() {
    setDraftName(name)
    setDraftClassId(classId)
    setDraftLevel(level)
    setDraftOriginId(originId)
    setDraftAttack(baseAttack)
    setDraftDefense(baseDefense)
    setDraftSpecialAttack(baseSpecialAttack)
    setDraftSpecialDefense(baseSpecialDefense)
    setDraftSpeed(baseSpeed)
    setError(null)
    setPendingMilestoneWipe(false)
    setIsEditing(true)
  }

  function handleSave() {
    if ((draftClassId !== classId || draftOriginId !== originId) && advancedClasses.length > 0) {
      setPendingMilestoneWipe(true)
      return
    }
    commitSave()
  }

  async function commitSave() {
    setError(null)
    setPendingMilestoneWipe(false)
    const result = await updateTrainerInfo(trainerId, {
      name: isOwner ? draftName : null,
      classId: draftClassId,
      level: draftLevel,
      originId: draftOriginId,
      attack: draftAttack,
      defense: draftDefense,
      specialAttack: draftSpecialAttack,
      specialDefense: draftSpecialDefense,
      speed: draftSpeed,
    })
    if ('error' in result) {
      setError(result.error)
      return
    }
    applyInfoSnapshot(result, draftClassId, draftOriginId)
    setIsEditing(false)
    // [[Bug - Bookmarked trainer name is not updated when edited]]: this action is a direct
    // client-invoked call (no <form>, no redirect), so nothing else re-fetches the (authenticated)
    // layout's Sidebar bookmarks -- router.refresh() re-syncs them, same pattern already used by
    // HeldItemGive/HeldItemTakeBack/EvolveButton for the same calling shape.
    router.refresh()
  }

  return (
    <section className="rounded border border-accent bg-accent/10 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="font-semibold">Info</h2>
        {canEdit && !isEditing && (
          <button type="button" onClick={openEdit} className="rounded border px-3 py-1 text-sm">
            Edit
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="flex flex-col gap-3 text-sm">
          {isOwner && (
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

          {canEditGmTier ? (
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
                <label htmlFor="trainerLevel" className="font-semibold">
                  Level
                </label>
                <input
                  id="trainerLevel"
                  type="number"
                  min={1}
                  value={draftLevel}
                  onChange={(e) => setDraftLevel(Math.max(1, Number(e.target.value)))}
                  className="bg-surface-subtle rounded border p-2"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="trainerOrigin" className="font-semibold">
                  Background
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
          ) : (
            <div className="flex flex-col gap-1 text-muted">
              <p>
                <span className="font-semibold">Class:</span> {className}
              </p>
              <p>
                <span className="font-semibold">Level:</span> {level}
              </p>
              <p>
                <span className="font-semibold">Background:</span> {originName}
              </p>
              <p className="text-xs italic">Only {campaign?.name ?? 'this campaign'}&apos;s GM can change these.</p>
            </div>
          )}

          {error && <p className="text-danger">{error}</p>}

          {pendingMilestoneWipe ? (
            <div className="flex flex-col gap-2 rounded border-accent bg-accent/20 p-2 text-sm">
              <p>
                Changing {draftClassId !== classId && draftOriginId !== originId ? 'Class or Background' : draftClassId !== classId ? 'Class' : 'Background'}{' '}
                will remove{' '}
                {advancedClasses.map((ac, i) => (
                  <span key={ac.grantedAtLevel}>
                    {i > 0 && ', '}
                    {ac.name} (Level {ac.grantedAtLevel})
                  </span>
                ))}
                . {name} will need to re-resolve these choices.
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={commitSave} className="rounded border border-danger px-3 py-1 text-sm text-danger">
                  Confirm
                </button>
                <button type="button" onClick={() => setPendingMilestoneWipe(false)} className="rounded border px-3 py-1">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button type="button" onClick={handleSave} className="rounded bg-accent px-3 py-1 text-accent-foreground">
                Save
              </button>
              <button type="button" onClick={() => setIsEditing(false)} className="rounded border px-3 py-1">
                Cancel
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2 text-sm">
          <p className="text-base font-semibold">{name}</p>

          <p>
            <span className="font-semibold">Class:</span> {className}
          </p>
          <p>
            <span className="font-semibold">Level:</span> {level}
          </p>

          {advancedClasses.length > 0 && (
            <div>
              <span className="font-semibold">Subclasses:</span>
              <ul className="ml-4 list-disc">
                {advancedClasses.map((ac) => (
                  <li key={ac.grantedAtLevel}>
                    {ac.name}
                    {canEdit && (
                      <Link href={`${basePath}/build?level=${ac.grantedAtLevel}`} className="ml-2 text-xs text-muted underline">
                        Edit
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p>
            <span className="font-semibold">Background:</span> {originName}
          </p>
          {lifestyle && (
            <p>
              <span className="font-semibold">Lifestyle:</span> {lifestyle}
            </p>
          )}

          {campaign && (
            <p>
              <span className="font-semibold">Campaign:</span>{' '}
              <Link href={`/campaigns/${campaign.id}`} className="underline">
                {campaign.name}
              </Link>
            </p>
          )}
        </div>
      )}
    </section>
  )
}

// [[Let Temporary HP actually be set]]: Grant adds to whatever Temp HP already exists (stacks from
// multiple sources) rather than replacing it. Damage now spends Temp HP first, down to a floor of
// 0, before touching current HP at all -- adjustTrainerHp's own return carries both resulting
// values so a single click updates both without a refetch. Clear is the manual "fight's over"
// button; Temp HP also clears automatically on the next Sleep rest as a backstop (restSleep).
export function TrainerHpSection({ trainerId }: { trainerId: string }) {
  const { currentHp, temporaryHp, maxHp, setCurrentHp, setTemporaryHp } = useTrainerState()
  const [amount, setAmount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleAdjust(sign: 1 | -1) {
    setError(null)
    setPending(true)
    const result = await adjustTrainerHp(trainerId, sign, amount)
    setPending(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setCurrentHp(result.currentHp)
    setTemporaryHp(result.temporaryHp)
  }

  async function handleGrant() {
    setError(null)
    setPending(true)
    const result = await grantTrainerTemporaryHp(trainerId, amount)
    setPending(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setTemporaryHp(result.temporaryHp)
  }

  async function handleClear() {
    setError(null)
    setPending(true)
    const result = await clearTrainerTemporaryHp(trainerId)
    setPending(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setTemporaryHp(result.temporaryHp)
  }

  return (
    <section className="rounded border border-accent bg-accent/10 p-4">
      <h2 className="mb-2 font-semibold">Hit Points</h2>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => handleAdjust(1)}
            className="rounded border border-success px-3 py-2 text-sm font-semibold text-success disabled:opacity-30"
          >
            Heal
          </button>
          <input
            type="number"
            value={amount}
            min={0}
            onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
            className="bg-surface-subtle w-20 rounded border p-2 text-center"
          />
          <button
            type="button"
            disabled={pending}
            onClick={() => handleAdjust(-1)}
            className="rounded border border-danger px-3 py-2 text-sm font-semibold text-danger disabled:opacity-30"
          >
            Damage
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={handleGrant}
            className="rounded border border-accent px-3 py-2 text-sm font-semibold text-accent disabled:opacity-30"
          >
            Grant Temp HP
          </button>
          {temporaryHp > 0 && (
            <button
              type="button"
              disabled={pending}
              onClick={handleClear}
              className="rounded border px-3 py-2 text-sm disabled:opacity-30"
            >
              Clear Temp HP
            </button>
          )}
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold leading-none">
            {currentHp} / {maxHp}
          </p>
          <p className="text-xs uppercase tracking-wide text-muted">Hit Points</p>
          {temporaryHp > 0 && <p className="text-sm text-muted">+{temporaryHp} temp</p>}
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </section>
  )
}

// breakdown is static per page load (it only ever changes via resolveMilestone, a real navigation
// back to this page) -- unlike the reactive stat values themselves, it doesn't need to live in
// context, just be passed down fresh each render.
export function StatsSection({ breakdown, favoredStatNames }: { breakdown: StatBreakdown; favoredStatNames?: Set<string> }) {
  const { attack, defense, special_attack, special_defense, speed } = useTrainerState()
  const stats: Record<StatField, number> = { attack, defense, special_attack, special_defense, speed }
  const fields: StatField[] = ['attack', 'defense', 'special_attack', 'special_defense', 'speed']

  return (
    <section className="rounded border border-accent bg-accent/10 p-4">
      <h2 className="mb-2 font-semibold">Stats</h2>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-muted">
            <th className="pb-1 pr-4 font-normal">Stat</th>
            <th className="pb-1 pr-4 font-normal">Value</th>
            <th className="pb-1 font-normal">Modifier</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field) => {
            const value = stats[field]
            const mod = statModifier(value)
            const b = breakdown[field]
            const tooltip = [
              `Base: ${b.base}`,
              ...b.increases.map((inc) => `+1 at Level ${inc.level} (${inc.subclassName})`),
              `Total: ${value}`,
            ].join('\n')
            return (
              <tr key={field}>
                <td className="py-0.5 pr-4">
                  {STAT_LABELS[field]}
                  {favoredStatNames?.has(STAT_LABELS[field]) && (
                    <span className="ml-1 text-accent" title="Favored stat for this Class">
                      ★
                    </span>
                  )}
                </td>
                <td className="py-0.5 pr-4">
                  <ClickTooltip label={String(value)} tooltip={tooltip} />
                </td>
                <td className="py-0.5">
                  {mod >= 0 ? '+' : ''}
                  {mod}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}

export function SkillsSection({
  skills,
  talents,
}: {
  skills: { id: number; name: string; stats: { name: string } | null }[]
  talents: Record<number, number>
}) {
  const { attack, defense, special_attack, special_defense, speed } = useTrainerState()
  const stats = { attack, defense, special_attack, special_defense, speed }
  return (
    <section className="rounded border border-accent bg-accent/10 p-4">
      <h2 className="mb-2 font-semibold">Skills</h2>
      <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
        {skills.map((s) => {
          const field = STAT_FIELD_BY_NAME[s.stats!.name]
          const pickedCount = talents[s.id] ?? 0
          const mod = statModifier(stats[field]) + (pickedCount > 0 ? talentBonus(pickedCount) : 0)
          return (
            <p key={s.name} className="text-sm">
              {s.name}: {mod >= 0 ? '+' : ''}
              {mod}
              {pickedCount > 0 && <span className="text-muted"> ({pickedCount >= 2 ? 'Expert' : 'Talented'})</span>}
            </p>
          )
        })}
      </div>
    </section>
  )
}

export function ActiveFeaturesSection({ trainerId }: { trainerId: string }) {
  const { activeFeatures, usesRemainingByFeature, setFeatureUses, isOwner } = useTrainerState()
  const [error, setError] = useState<string | null>(null)

  async function handleUse(featureId: number, target: number) {
    setError(null)
    const result = await setFeatureUsesRemaining(trainerId, featureId, target)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setFeatureUses(featureId, result.usesRemaining)
  }

  async function handleReset(featureId: number, maxUses: number) {
    setError(null)
    const result = await resetFeatureUses(trainerId, featureId, maxUses)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setFeatureUses(featureId, result.usesRemaining)
  }

  return (
    <section className="rounded border border-accent bg-accent/10 p-4">
      <h2 className="mb-2 font-semibold">Active Features</h2>
      {error && <p className="mb-2 text-sm text-danger">{error}</p>}
      {activeFeatures.length === 0 ? (
        <p className="text-sm text-muted">None yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {activeFeatures.map((f) => {
            const usesRemaining = usesRemainingByFeature[f.id] ?? f.max_uses
            return (
              // bg-accent/10, not bg-accent-dark/10 -- accent-dark is a plain var(), not the
              // rgb(.../<alpha-value>) pattern, so it can't take an opacity modifier. The darker
              // border alone is enough to read as distinct from a plain border-accent section.
              <li key={f.id} className="rounded border border-accent-dark bg-accent/10 p-3">
                <details>
                  <summary className="cursor-pointer font-medium">
                    {/* text-white, not text-accent-foreground -- accent-dark is always mixed toward
                        black regardless of theme/mode, so a light-on-dark badge is reliably readable
                        here even though accent-foreground (paired with the un-darkened accent) isn't. */}
                    {f.name} <span className="rounded bg-accent-dark px-1.5 py-0.5 text-xs font-semibold text-white">ACTIVE</span>{' '}
                    <span className="text-sm font-normal text-muted">(level {f.level_required})</span>
                  </summary>
                  <p className="mt-1 text-sm text-muted">{f.description}</p>
                </details>
                {f.max_uses !== null &&
                  (() => {
                    // [[Add checkboxes for Trainer features that have uses per day]]: same
                    // row-of-boxes pattern MovesSection already renders per known move -- each box
                    // only ever toggles its own state by ±1, so checking any one unchecked box
                    // consumes exactly 1 use and unchecking any one checked box restores exactly 1,
                    // regardless of which position was clicked.
                    const slotCount = f.max_uses
                    const usedCount = slotCount - usesRemaining
                    return (
                      <div className="mt-2 flex items-center gap-2 text-sm">
                        {f.uses_reset_on && <span className="text-xs text-muted">Resets on {f.uses_reset_on}</span>}
                        {isOwner ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleUse(f.id, slotCount - (usedCount + 1))}
                              disabled={usedCount >= slotCount}
                              className="rounded border border-accent px-2 py-0.5 text-xs font-semibold text-accent disabled:opacity-30"
                            >
                              Use
                            </button>
                            <div className="flex items-center gap-1">
                              {Array.from({ length: slotCount }, (_, slot) => {
                                const isUsed = slot < usedCount
                                const target = isUsed ? slotCount - (usedCount - 1) : slotCount - (usedCount + 1)
                                return (
                                  <button
                                    key={slot}
                                    type="button"
                                    onClick={() => handleUse(f.id, target)}
                                    aria-label={isUsed ? 'Mark use available' : 'Mark use consumed'}
                                    className={`flex h-5 w-5 items-center justify-center rounded border text-xs leading-none ${
                                      isUsed ? 'border-accent bg-accent text-accent-foreground' : 'border text-transparent'
                                    }`}
                                  >
                                    ✓
                                  </button>
                                )
                              })}
                            </div>
                            <button type="button" onClick={() => handleReset(f.id, f.max_uses!)} className="rounded border px-2 py-0.5 text-xs">
                              Reset
                            </button>
                          </>
                        ) : (
                          <div className="flex items-center gap-1">
                            {Array.from({ length: slotCount }, (_, slot) => (
                              <span
                                key={slot}
                                className={`flex h-5 w-5 items-center justify-center rounded border text-xs leading-none ${
                                  slot < usedCount ? 'border-accent bg-accent text-accent-foreground' : 'border text-transparent'
                                }`}
                              >
                                ✓
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })()}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export function PassiveFeaturesSection() {
  const { passiveFeatures } = useTrainerState()
  return (
    <section className="rounded border border-accent bg-accent/10 p-4">
      <h2 className="mb-2 font-semibold">Passive Features</h2>
      {passiveFeatures.length === 0 ? (
        <p className="text-sm text-muted">None yet.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {passiveFeatures.map((f) => (
            <li key={f.id}>
              <details>
                <summary className="cursor-pointer font-medium">
                  {f.name} <span className="text-sm font-normal text-muted">(level {f.level_required})</span>
                </summary>
                <p className="mt-1 pl-4 text-sm text-muted">{f.description}</p>
              </details>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
