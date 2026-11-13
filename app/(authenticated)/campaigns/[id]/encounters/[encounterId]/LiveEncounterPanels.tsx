'use client'

import { AttackResolver, type AttackerOption, type TargetOption } from './AttackResolver'
import { TrainerActionsPanel, type TrainerActionsData } from './TrainerActionsPanel'
import { useEncounterLive } from './EncounterLiveProvider'

// Thin wrappers that feed the existing client panels from the live store, so whose-turn-it-is and the
// Feature/Move/Item use counts update in place instead of needing a server re-render. The server still
// decides *what the viewer may ever see* (which Pokemon/Trainers are theirs); only the turn gating and the
// numbers are applied live here.

export function LiveAttackResolver({
  candidates,
  targets,
  isGM,
  encounterId,
  campaignId,
}: {
  // Every Pokemon combatant this viewer could ever attack with: all of them for the GM, only their own for a member.
  candidates: AttackerOption[]
  targets: TargetOption[]
  isGM: boolean
  encounterId: string
  campaignId: string
}) {
  const { currentCombatantId } = useEncounterLive()
  // [[Feature - Only active player on initiative tracker can do an action]]: a member's own Pokemon is only
  // offered while it's actually that combatant's turn; the GM is exempt.
  const attackers = isGM ? candidates : candidates.filter((a) => a.id === currentCombatantId)
  // [[Feature - Hide certain sections in Encounters]]: hides entirely for a member when it isn't their turn.
  if (!isGM && attackers.length === 0) return null
  return (
    <AttackResolver
      attackers={attackers}
      targets={targets}
      currentAttackerId={currentCombatantId}
      isGM={isGM}
      encounterId={encounterId}
      campaignId={campaignId}
    />
  )
}

export function LiveTrainerActionsPanel({
  trainers,
  isGM,
  encounterId,
  catchTargets,
  pokemonTargets,
  markTargets,
}: {
  trainers: TrainerActionsData[]
  isGM: boolean
  encounterId: string
  catchTargets: { combatantId: string; label: string }[]
  pokemonTargets: { combatantId: string; label: string }[]
  markTargets: { combatantId: string; label: string }[]
}) {
  const { snapshot, currentCombatantId, pollNow } = useEncounterLive()
  const merged = trainers.map((t) => {
    const isCurrentTurn = isGM || t.combatantId === currentCombatantId
    const live = snapshot.trainers[t.trainerId]
    if (!live) return { ...t, isCurrentTurn }
    return {
      ...t,
      isCurrentTurn,
      moves: t.moves.map((m) => (m.name in live.moveUses ? { ...m, usesRemaining: live.moveUses[m.name] } : m)),
      features: t.features.map((f) => (f.maxUses === null ? f : { ...f, usesRemaining: live.featureUses[f.id] ?? f.maxUses })),
      // A consumed stack drops out of the Bag (quantity 0) -- same as the server-side `quantity > 0` filter.
      items: t.items.flatMap((i) => {
        const quantity = live.itemQuantities[i.id] ?? 0
        return quantity > 0 ? [{ ...i, quantity }] : []
      }),
    }
  })
  return <TrainerActionsPanel trainers={merged} onActionDone={pollNow} encounterId={encounterId} catchTargets={catchTargets} pokemonTargets={pokemonTargets} markTargets={markTargets} />
}
