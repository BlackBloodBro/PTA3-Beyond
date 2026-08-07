'use client'

import { useState } from 'react'
import { useTrainerState, StatsSection, SkillsSection, type StatBreakdown } from '@/app/(authenticated)/trainers/[id]/TrainerInteractive'
import { updateBuilderLevel, type ClassBuilderSnapshot } from '@/app/(authenticated)/trainers/actions'
import type { ClassBuilderCard, TrainerFeature } from '@/lib/pta3/trainerFeatures'
import { MilestoneCard } from './MilestoneCard'

// The Class Builder page's body -- a Level selector, the fixed Stats/Skills panel (never buried under
// the scrollable list, per explicit feedback), the level-gated Class Features list (plain cards +
// MilestoneCard for "Advanced class" choices), and a collapsed higher-level preview. Consumes
// TrainerStateProvider's context (same as the trainer sheet) so a milestone/Level save flows through
// the existing applyInfoSnapshot-shaped update -- no separate state machine.
export function ClassBuilder({
  trainerId,
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
  initialCards: ClassBuilderCard[]
  initialHigherLevelPreview: { name: string; levelRequired: number }[]
  statBreakdown: StatBreakdown
  skills: { id: number; name: string; stats: { name: string } | null }[]
  initialTalents: Record<number, number>
  favoredStatNames: string[]
  originFeatures: TrainerFeature[]
  focusLevel?: number
}) {
  const { level, classId, originId, applyInfoSnapshot } = useTrainerState()

  const [cards, setCards] = useState(initialCards)
  const [higherLevelPreview, setHigherLevelPreview] = useState(initialHigherLevelPreview)
  const [talents, setTalents] = useState(initialTalents)
  const [levelInput, setLevelInput] = useState(String(level))
  const [levelError, setLevelError] = useState<string | null>(null)
  const [levelSaving, setLevelSaving] = useState(false)

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
