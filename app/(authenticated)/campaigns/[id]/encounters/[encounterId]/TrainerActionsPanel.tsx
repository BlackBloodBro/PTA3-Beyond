'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { setFeatureUsesRemaining } from '@/app/(authenticated)/trainers/actions'
import { useItem } from '@/app/(authenticated)/trainers/[id]/bag/actions'
import { attemptCatch } from './catchActions'
import { useIntimidate } from './featureActions'

export type TrainerActionsData = {
  trainerId: string
  // The Trainer's own combatant row, so the live store can work out whose turn it is without a server refresh.
  combatantId: string
  trainerName: string
  isCurrentTurn: boolean
  moves: { name: string; usesRemaining: number | null }[]
  // maxUses: what an absent trainer_feature_uses row means (a rest deletes the row to recharge it).
  features: { id: number; name: string; description: string; usesRemaining: number | null; maxUses: number | null }[]
  // battle: in a category flagged show_in_encounters -- the only items listed unless "Show all items" is on.
  // ball: a Poke Ball with catch data -- thrown at a wild Pokemon (see attemptCatch) instead of just "used".
  // condition is its free-text rule (e.g. "If the Pokemon is in water."); isTimer is the Timer Ball's duration tier.
  items: { id: string; name: string; quantity: number; battle: boolean; ball: { condition: string | null; isTimer: boolean } | null }[]
}

// [[Feature - Trainers should see actions they could do in an Encounter]]: deliberately generic --
// "Use" a Feature or Item calls the exact same setFeatureUsesRemaining/useItem actions the Trainer's
// own page and Bag already call (no new mutations), just surfaced here so a player doesn't have to
// leave the Encounter page to remember or use what their Trainer has. What a specific Feature actually
// *does* when triggered (an Affliction, a stat change, temp HP, ...) stays that Feature's own FR to
// automate -- this only tracks that it was used. Trainer Moves are read-only: no resolution or "use"
// action exists for those, matching attack resolution's own Pokemon-only scoping.
export function TrainerActionsPanel({
  trainers,
  onActionDone,
  encounterId,
  catchTargets = [],
  pokemonTargets = [],
}: {
  trainers: TrainerActionsData[]
  onActionDone?: () => void
  encounterId?: string
  // The enemy wild Pokemon a Ball can be thrown at (empty when there are none).
  catchTargets?: { combatantId: string; label: string }[]
  // Every Pokemon combatant, enemies first -- the targets Intimidate can be used on.
  pokemonTargets?: { combatantId: string; label: string }[]
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  // [[Feature - Show feature description in Encounters]]: expandable/on-demand rather than always
  // visible, per the user -- collapsed by default, keeps the list compact when a Trainer has several
  // Features. A plain Set of currently-expanded Feature ids, not per-Trainer-scoped -- two Trainers
  // sharing the same Feature id can't happen (Features are id'd globally, not per-Trainer), so this is
  // safe without needing a composite key.
  const [expandedFeatureIds, setExpandedFeatureIds] = useState<Set<number>>(new Set())
  // [[Improvement - Only show battle items in an encounter]]: per-Trainer, local, off by default.
  const [showAllItemsFor, setShowAllItemsFor] = useState<Set<string>>(new Set())
  // [[Feature - Create Pokemon catching mechanic]]: the open "throw a Ball" form (one at a time) and its inputs.
  const [throwingItemId, setThrowingItemId] = useState<string | null>(null)
  const [throwTargetId, setThrowTargetId] = useState('')
  const [throwConditionMet, setThrowConditionMet] = useState(false)
  const [throwTimerTier, setThrowTimerTier] = useState<0 | 1 | 2>(0)
  const [throwResult, setThrowResult] = useState<{ trainerId: string; text: string } | null>(null)
  // [[Feature - Apply Intimidate's stat penalty in Encounters (Ace trainer)]]: the open Intimidate form (one at a time).
  const [intimidatingFeatureId, setIntimidatingFeatureId] = useState<number | null>(null)
  const [intimidateTargetId, setIntimidateTargetId] = useState('')
  const [intimidateStat, setIntimidateStat] = useState<'attack' | 'special_attack'>('attack')
  const [intimidateResult, setIntimidateResult] = useState<{ trainerId: string; text: string } | null>(null)

  function openThrow(itemId: string) {
    setThrowResult(null)
    setThrowTargetId(catchTargets.length === 1 ? catchTargets[0].combatantId : '')
    setThrowConditionMet(false)
    setThrowTimerTier(0)
    setThrowingItemId((prev) => (prev === itemId ? null : itemId))
  }

  function promptForD100(): number | null {
    let entry = window.prompt('Roll a d100 for real and enter the result (1-100).')
    while (entry !== null) {
      const n = Number(entry)
      if (Number.isInteger(n) && n >= 1 && n <= 100) return n
      entry = window.prompt('Enter a whole number from 1 to 100:')
    }
    return null
  }

  function toggleShowAllItems(trainerId: string) {
    setShowAllItemsFor((prev) => {
      const next = new Set(prev)
      if (next.has(trainerId)) next.delete(trainerId)
      else next.add(trainerId)
      return next
    })
  }

  function toggleFeatureDescription(featureId: number) {
    setExpandedFeatureIds((prev) => {
      const next = new Set(prev)
      if (next.has(featureId)) {
        next.delete(featureId)
      } else {
        next.add(featureId)
      }
      return next
    })
  }

  // [[Feature - Hide certain sections in Encounters]]: each Trainer's own block hides independently
  // once it isn't their turn, rather than showing it with a "Not your turn yet" message -- replaces
  // the isCurrentTurn-gated messaging/disabled-buttons this used to render inline. isCurrentTurn is
  // always true for the GM (see page.tsx's own computation), so this filter is a no-op for the GM's
  // view -- every Trainer combatant still shows, matching every other Combat v1 access model.
  const visibleTrainers = trainers.filter((t) => t.isCurrentTurn)
  if (visibleTrainers.length === 0) return null

  async function handleUseFeature(trainerId: string, featureId: number, usesRemaining: number) {
    setError(null)
    setPendingId(`feature-${featureId}`)
    const result = await setFeatureUsesRemaining(trainerId, featureId, usesRemaining - 1)
    setPendingId(null)
    if ('error' in result) {
      setError(result.error)
      return
    }
    // Re-read just the live state (cheap) instead of re-running the whole server page.
    if (onActionDone) onActionDone()
    else router.refresh()
  }

  async function handleThrow(trainerId: string, item: TrainerActionsData['items'][number]) {
    if (!encounterId || !throwTargetId) return
    const target = catchTargets.find((c) => c.combatantId === throwTargetId)
    const roll = promptForD100()
    if (roll === null) return
    setError(null)
    setThrowResult(null)
    setPendingId(`item-${item.id}`)
    const result = await attemptCatch({
      encounterId,
      combatantId: throwTargetId,
      trainerId,
      trainersItemId: item.id,
      conditionMet: throwConditionMet,
      timerTier: throwTimerTier,
      roll,
    })
    setPendingId(null)
    if ('error' in result) {
      setError(result.error)
      return
    }
    const name = target?.label ?? 'The Pokémon'
    setThrowResult({
      trainerId,
      text: result.success
        ? `Rolled ${result.roll}, needed ≤ ${result.targetPercent}% — ${name} was caught!`
        : `Rolled ${result.roll}, needed ≤ ${result.targetPercent}% — ${name} broke free!`,
    })
    setThrowingItemId(null)
    // The Ball count, the turn and (on a catch) the combatant list all changed -- re-read the live state; a
    // changed combatant list triggers the one full refresh itself.
    if (onActionDone) onActionDone()
    else router.refresh()
  }

  async function handleIntimidate(trainerId: string, featureId: number) {
    if (!encounterId || !intimidateTargetId) return
    setError(null)
    setIntimidateResult(null)
    setPendingId(`feature-${featureId}`)
    const result = await useIntimidate({ encounterId, trainerId, targetCombatantId: intimidateTargetId, stat: intimidateStat })
    setPendingId(null)
    if ('error' in result) {
      setError(result.error)
      return
    }
    const target = pokemonTargets.find((p) => p.combatantId === intimidateTargetId)
    setIntimidateResult({ trainerId, text: `${target?.label ?? 'The Pokémon'}'s ${intimidateStat === 'attack' ? 'Attack' : 'Special Attack'} is lowered by 2.` })
    setIntimidatingFeatureId(null)
    // The use count changed -- re-read the live state (cheap) instead of re-running the whole server page.
    if (onActionDone) onActionDone()
    else router.refresh()
  }

  async function handleUseItem(trainerId: string, trainersItemId: string) {
    setError(null)
    setPendingId(`item-${trainersItemId}`)
    const result = await useItem(trainerId, trainersItemId)
    setPendingId(null)
    if ('error' in result) {
      setError(result.error)
      return
    }
    // Re-read just the live state (cheap) instead of re-running the whole server page.
    if (onActionDone) onActionDone()
    else router.refresh()
  }

  return (
    <div className="flex w-full max-w-2xl flex-col gap-4 rounded border-accent bg-accent/10 p-4 text-sm">
      <h2 className="font-semibold">Your actions</h2>
      {error && <p className="text-danger">{error}</p>}

      {visibleTrainers.map((t) => (
        <div key={t.trainerId} className="flex flex-col gap-3 rounded border p-3">
          {visibleTrainers.length > 1 && <p className="font-medium">{t.trainerName}</p>}

          <div>
            <p className="text-xs font-semibold text-muted">Moves</p>
            {t.moves.length === 0 ? (
              <p className="text-xs text-muted">None known.</p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {t.moves.map((m) => (
                  <li key={m.name}>
                    {m.name}
                    {m.usesRemaining !== null && <span className="text-xs text-muted"> ({m.usesRemaining} left)</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-muted">Features</p>
            {t.features.length === 0 ? (
              <p className="text-xs text-muted">None usable.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {t.features.map((f) => {
                  const isExpanded = expandedFeatureIds.has(f.id)
                  return (
                    <li key={f.id} className="flex flex-col gap-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleFeatureDescription(f.id)}
                          className="text-left underline decoration-dotted underline-offset-2"
                          aria-expanded={isExpanded}
                        >
                          {isExpanded ? '▾' : '▸'} {f.name}
                          {f.usesRemaining !== null && <span className="text-xs text-muted"> ({f.usesRemaining} left)</span>}
                        </button>
                        {f.usesRemaining !== null && f.name === 'Intimidate' && encounterId ? (
                          <button
                            type="button"
                            onClick={() => {
                              setIntimidateResult(null)
                              setIntimidateTargetId('')
                              setIntimidatingFeatureId((prev) => (prev === f.id ? null : f.id))
                            }}
                            disabled={f.usesRemaining <= 0 || pokemonTargets.length === 0 || pendingId === `feature-${f.id}`}
                            title={pokemonTargets.length === 0 ? 'No Pokémon in this encounter to target' : undefined}
                            className="rounded border border-accent px-2 py-0.5 text-xs font-semibold text-accent disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            {pendingId === `feature-${f.id}` ? 'Using…' : intimidatingFeatureId === f.id ? 'Cancel' : 'Use'}
                          </button>
                        ) : (
                          f.usesRemaining !== null && (
                            <button
                              type="button"
                              onClick={() => handleUseFeature(t.trainerId, f.id, f.usesRemaining!)}
                              disabled={f.usesRemaining <= 0 || pendingId === `feature-${f.id}`}
                              className="rounded border border-accent px-2 py-0.5 text-xs font-semibold text-accent disabled:cursor-not-allowed disabled:opacity-30"
                            >
                              {pendingId === `feature-${f.id}` ? 'Using…' : 'Use'}
                            </button>
                          )
                        )}
                      </div>
                      {f.name === 'Intimidate' && intimidatingFeatureId === f.id && (
                        <div className="flex flex-col gap-2 rounded border bg-surface-subtle p-2">
                          <label className="flex flex-col gap-1 text-xs">
                            Intimidate
                            <select value={intimidateTargetId} onChange={(e) => setIntimidateTargetId(e.target.value)} className="bg-surface-subtle rounded border px-2 py-1 text-sm">
                              <option value="">Select a Pokémon...</option>
                              {pokemonTargets.map((p) => (
                                <option key={p.combatantId} value={p.combatantId}>
                                  {p.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="flex flex-col gap-1 text-xs">
                            Lower its
                            <select value={intimidateStat} onChange={(e) => setIntimidateStat(e.target.value as 'attack' | 'special_attack')} className="bg-surface-subtle rounded border px-2 py-1 text-sm">
                              <option value="attack">Attack (-2)</option>
                              <option value="special_attack">Special Attack (-2)</option>
                            </select>
                          </label>
                          <button
                            type="button"
                            onClick={() => handleIntimidate(t.trainerId, f.id)}
                            disabled={!intimidateTargetId || pendingId === `feature-${f.id}`}
                            className="self-start rounded bg-accent px-3 py-1 text-xs text-accent-foreground disabled:opacity-40"
                          >
                            Intimidate
                          </button>
                        </div>
                      )}
                      {isExpanded && <p className="text-xs text-muted">{f.description}</p>}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-muted">Items</p>
              {t.items.some((i) => !i.battle) && (
                <button type="button" onClick={() => toggleShowAllItems(t.trainerId)} className="text-xs underline">
                  {showAllItemsFor.has(t.trainerId) ? 'Show battle items only' : 'Show all items'}
                </button>
              )}
            </div>
            {t.items.length === 0 ? (
              <p className="text-xs text-muted">Bag is empty.</p>
            ) : t.items.filter((i) => showAllItemsFor.has(t.trainerId) || i.battle).length === 0 ? (
              <p className="text-xs text-muted">No battle items.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {t.items.filter((i) => showAllItemsFor.has(t.trainerId) || i.battle).map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center gap-2">
                    <span>
                      {i.name} <span className="text-xs text-muted">×{i.quantity}</span>
                    </span>
                    {i.ball && encounterId ? (
                      <button
                        type="button"
                        onClick={() => openThrow(i.id)}
                        disabled={catchTargets.length === 0 || pendingId === `item-${i.id}`}
                        title={catchTargets.length === 0 ? 'No wild Pokémon in this encounter to catch' : undefined}
                        className="rounded border border-accent px-2 py-0.5 text-xs font-semibold text-accent disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        {pendingId === `item-${i.id}` ? 'Throwing…' : throwingItemId === i.id ? 'Cancel' : 'Throw'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleUseItem(t.trainerId, i.id)}
                        disabled={pendingId === `item-${i.id}`}
                        className="rounded border border-accent px-2 py-0.5 text-xs font-semibold text-accent disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        {pendingId === `item-${i.id}` ? 'Using…' : 'Use'}
                      </button>
                    )}
                    {i.ball && throwingItemId === i.id && (
                      <div className="flex w-full flex-col gap-2 rounded border bg-surface-subtle p-2">
                        <label className="flex flex-col gap-1 text-xs">
                          Throw at
                          <select value={throwTargetId} onChange={(e) => setThrowTargetId(e.target.value)} className="bg-surface-subtle rounded border px-2 py-1 text-sm">
                            <option value="">Select...</option>
                            {catchTargets.map((c) => (
                              <option key={c.combatantId} value={c.combatantId}>
                                {c.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        {i.ball.isTimer ? (
                          <label className="flex flex-col gap-1 text-xs">
                            How long has the encounter lasted?
                            <select value={throwTimerTier} onChange={(e) => setThrowTimerTier(Number(e.target.value) as 0 | 1 | 2)} className="bg-surface-subtle rounded border px-2 py-1 text-sm">
                              <option value={0}>Under a minute (no bonus)</option>
                              <option value={1}>At least a minute (+10)</option>
                              <option value={2}>At least two minutes (+25)</option>
                            </select>
                          </label>
                        ) : (
                          i.ball.condition && (
                            <label className="flex items-start gap-2 text-xs">
                              <input type="checkbox" checked={throwConditionMet} onChange={(e) => setThrowConditionMet(e.target.checked)} className="mt-0.5" />
                              <span>{i.ball.condition} (tick if this applies — it adds the Ball&apos;s bonus)</span>
                            </label>
                          )
                        )}
                        <button
                          type="button"
                          onClick={() => handleThrow(t.trainerId, i)}
                          disabled={!throwTargetId || pendingId === `item-${i.id}`}
                          className="self-start rounded bg-accent px-3 py-1 text-xs text-accent-foreground disabled:opacity-40"
                        >
                          Throw &amp; roll d100
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {intimidateResult && intimidateResult.trainerId === t.trainerId && <p className="text-sm font-semibold">{intimidateResult.text}</p>}
          {throwResult && throwResult.trainerId === t.trainerId && <p className="text-sm font-semibold">{throwResult.text}</p>}

          <p className="text-xs text-muted">You can also recall or send out a Pokémon above.</p>
        </div>
      ))}
    </div>
  )
}
