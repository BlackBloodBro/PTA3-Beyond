'use client'

import Link from 'next/link'
import { createContext, useContext, useState, type ReactNode } from 'react'
import { statModifier } from '@/lib/pta3/pointBuy'
import { talentBonus } from '@/lib/pta3/skillTalents'
import { adjustTrainerHp, updateTrainerInfo, useFeatureCharge, resetFeatureUses } from '@/app/(authenticated)/trainers/actions'
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
  maxHp: number
  attack: number
  defense: number
  special_attack: number
  special_defense: number
  speed: number
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
  setFeatureUses: (featureId: number, usesRemaining: number) => void
}

const TrainerStateContext = createContext<TrainerContextValue | null>(null)

function useTrainerState() {
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
  initialMaxHp,
  initialStats,
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
  initialMaxHp: number
  initialStats: { attack: number; defense: number; special_attack: number; special_defense: number; speed: number }
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
    maxHp: initialMaxHp,
    ...initialStats,
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
      <Link href={`${basePath}/level-up`} className="rounded bg-accent px-3 py-1 text-sm text-accent-foreground">
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
// Subclass picker here -- Subclasses are only ever granted through resolveMilestone on the level-up
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
  const { basePath, name, level, advancedClasses, className, originName, lifestyle, classId, originId, isOwner, isGM, applyInfoSnapshot } =
    useTrainerState()

  const [isEditing, setIsEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [draftName, setDraftName] = useState(name)
  const [draftClassId, setDraftClassId] = useState(classId)
  const [draftLevel, setDraftLevel] = useState(level)
  const [draftOriginId, setDraftOriginId] = useState(originId)

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
    setError(null)
    setIsEditing(true)
  }

  async function handleSave() {
    setError(null)
    const result = await updateTrainerInfo(trainerId, {
      name: isOwner ? draftName : null,
      classId: draftClassId,
      level: draftLevel,
      originId: draftOriginId,
    })
    if ('error' in result) {
      setError(result.error)
      return
    }
    applyInfoSnapshot(result, draftClassId, draftOriginId)
    setIsEditing(false)
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

          <div className="flex gap-2">
            <button type="button" onClick={handleSave} className="rounded bg-accent px-3 py-1 text-accent-foreground">
              Save
            </button>
            <button type="button" onClick={() => setIsEditing(false)} className="rounded border px-3 py-1">
              Cancel
            </button>
          </div>
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
                      <Link href={`${basePath}/level-up/${ac.grantedAtLevel}`} className="ml-2 text-xs text-muted underline">
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

export function TrainerHpSection({ trainerId, temporaryHp }: { trainerId: string; temporaryHp: number }) {
  const { currentHp, maxHp, setCurrentHp } = useTrainerState()
  const [amount, setAmount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  async function handleAdjust(sign: 1 | -1) {
    setError(null)
    const result = await adjustTrainerHp(trainerId, sign, amount)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setCurrentHp(result.currentHp)
  }

  return (
    <section className="rounded border border-accent bg-accent/10 p-4">
      <h2 className="mb-2 font-semibold">Hit Points</h2>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleAdjust(1)}
            className="rounded border border-success px-3 py-2 text-sm font-semibold text-success"
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
            onClick={() => handleAdjust(-1)}
            className="rounded border border-danger px-3 py-2 text-sm font-semibold text-danger"
          >
            Damage
          </button>
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
export function StatsSection({ breakdown }: { breakdown: StatBreakdown }) {
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
                <td className="py-0.5 pr-4">{STAT_LABELS[field]}</td>
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

  async function handleUse(featureId: number, maxUses: number) {
    setError(null)
    const result = await useFeatureCharge(trainerId, featureId, maxUses)
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
                {f.max_uses !== null && (
                  <div className="mt-2 flex items-center gap-2 text-sm">
                    <span>
                      {usesRemaining} / {f.max_uses} uses
                      {f.uses_reset_on && ` (resets on ${f.uses_reset_on})`}
                    </span>
                    {isOwner && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleUse(f.id, f.max_uses!)}
                          disabled={usesRemaining !== null && usesRemaining <= 0}
                          className="rounded border px-2 py-0.5 disabled:opacity-30"
                        >
                          Use
                        </button>
                        <button type="button" onClick={() => handleReset(f.id, f.max_uses!)} className="rounded border px-2 py-0.5">
                          Reset
                        </button>
                      </>
                    )}
                  </div>
                )}
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
