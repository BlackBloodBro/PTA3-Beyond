'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { setFeatureUsesRemaining } from '@/app/(authenticated)/trainers/actions'
import { useItem } from '@/app/(authenticated)/trainers/[id]/bag/actions'

export type TrainerActionsData = {
  trainerId: string
  trainerName: string
  moves: { name: string; usesRemaining: number | null }[]
  features: { id: number; name: string; description: string; usesRemaining: number | null }[]
  items: { id: string; name: string; quantity: number }[]
}

// [[Feature - Trainers should see actions they could do in an Encounter]]: deliberately generic --
// "Use" a Feature or Item calls the exact same setFeatureUsesRemaining/useItem actions the Trainer's
// own page and Bag already call (no new mutations), just surfaced here so a player doesn't have to
// leave the Encounter page to remember or use what their Trainer has. What a specific Feature actually
// *does* when triggered (an Affliction, a stat change, temp HP, ...) stays that Feature's own FR to
// automate -- this only tracks that it was used. Trainer Moves are read-only: no resolution or "use"
// action exists for those, matching attack resolution's own Pokemon-only scoping.
export function TrainerActionsPanel({ trainers }: { trainers: TrainerActionsData[] }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  async function handleUseFeature(trainerId: string, featureId: number, usesRemaining: number) {
    setError(null)
    setPendingId(`feature-${featureId}`)
    const result = await setFeatureUsesRemaining(trainerId, featureId, usesRemaining - 1)
    setPendingId(null)
    if ('error' in result) {
      setError(result.error)
      return
    }
    router.refresh()
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
    router.refresh()
  }

  return (
    <div className="flex w-full max-w-2xl flex-col gap-4 rounded border-accent bg-accent/10 p-4 text-sm">
      <h2 className="font-semibold">Your actions</h2>
      {error && <p className="text-danger">{error}</p>}

      {trainers.map((t) => (
        <div key={t.trainerId} className="flex flex-col gap-3 rounded border p-3">
          {trainers.length > 1 && <p className="font-medium">{t.trainerName}</p>}

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
                {t.features.map((f) => (
                  <li key={f.id} className="flex flex-wrap items-center gap-2">
                    <span>
                      {f.name}
                      {f.usesRemaining !== null && <span className="text-xs text-muted"> ({f.usesRemaining} left)</span>}
                    </span>
                    {f.usesRemaining !== null && (
                      <button
                        type="button"
                        onClick={() => handleUseFeature(t.trainerId, f.id, f.usesRemaining!)}
                        disabled={f.usesRemaining <= 0 || pendingId === `feature-${f.id}`}
                        className="rounded border border-accent px-2 py-0.5 text-xs font-semibold text-accent disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        {pendingId === `feature-${f.id}` ? 'Using…' : 'Use'}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-muted">Items</p>
            {t.items.length === 0 ? (
              <p className="text-xs text-muted">Bag is empty.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {t.items.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center gap-2">
                    <span>
                      {i.name} <span className="text-xs text-muted">×{i.quantity}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleUseItem(t.trainerId, i.id)}
                      disabled={pendingId === `item-${i.id}`}
                      className="rounded border border-accent px-2 py-0.5 text-xs font-semibold text-accent disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      {pendingId === `item-${i.id}` ? 'Using…' : 'Use'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="text-xs text-muted">You can also recall or send out a Pokémon above.</p>
        </div>
      ))}
    </div>
  )
}
