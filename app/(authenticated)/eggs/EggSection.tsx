'use client'

import { useState } from 'react'
import { startHatchingEgg, hatchEgg, stopHatchingEgg, previewNaturalEdgeHatch, type NaturalEdgePreview } from './actions'
import type { EggSnapshot } from '@/lib/pta3/eggs'
import type { NaturalEdgeStatChoice } from '@/lib/pta3/eggHatching'

// [[Feature - Add Egg hatching logic]]: rendered on all 3 Trainer page variants (campaign-less,
// campaign player, campaign NPC), same shared-component shape as BreedingBoard.tsx across its own 3
// page.tsx callers. The page itself only renders this when there's something to show (an in-progress
// Egg, or at least one Egg in the Bag) -- see each page.tsx's own guard.
export function EggSection({ trainerId, initialSnapshot }: { trainerId: string; initialSnapshot: EggSnapshot }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot)
  const [selectedTrainersItemId, setSelectedTrainersItemId] = useState(snapshot.availableEggs[0]?.trainersItemId ?? '')
  const [preview, setPreview] = useState<NaturalEdgePreview | null>(null)
  const [targetStat, setTargetStat] = useState<NaturalEdgeStatChoice>('attack')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleStart() {
    if (!selectedTrainersItemId) return
    setSubmitting(true)
    setError(null)
    const result = await startHatchingEgg(trainerId, selectedTrainersItemId)
    setSubmitting(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setSnapshot(result)
    setMessage('Started hatching.')
  }

  // Natural Edge needs the Pokémon's nature known before picking a stat (per the Feature's own text),
  // so Hatch loads a preview first instead of hatching immediately -- see previewNaturalEdgeHatch's own
  // comment for why this also locks in a random nature right here, not just when Hatch is confirmed.
  async function handleHatchClick() {
    if (!snapshot.inProgress) return
    if (!snapshot.hasNaturalEdge) {
      await doHatch(null)
      return
    }
    setSubmitting(true)
    setError(null)
    const result = await previewNaturalEdgeHatch(trainerId, snapshot.inProgress.id)
    setSubmitting(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setPreview(result)
    setTargetStat(result.options[0]?.key ?? 'attack')
  }

  async function handleConfirmHatch() {
    await doHatch({ targetStat })
  }

  // [[Feature - Add a 'Stop hatching' functionality for the hatching section]]: abandons the
  // in-progress Egg (resetting its Sleep progress) and returns it to the Bag, so a different Egg can
  // be started instead. Warns first, per the FR's own requirement -- this can't be undone.
  async function handleStopHatching() {
    if (!snapshot.inProgress) return
    if (!window.confirm('Stop hatching this Egg? Progress made on it will be reset, and it will be returned to your Bag.')) {
      return
    }
    setSubmitting(true)
    setError(null)
    const result = await stopHatchingEgg(trainerId)
    setSubmitting(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setSnapshot(result)
    setPreview(null)
    setSelectedTrainersItemId(result.availableEggs[0]?.trainersItemId ?? '')
    setMessage('Stopped hatching. The Egg is back in your Bag.')
  }

  async function doHatch(naturalEdgeChoice: { targetStat: NaturalEdgeStatChoice } | null) {
    if (!snapshot.inProgress) return
    setSubmitting(true)
    setError(null)
    const result = await hatchEgg(trainerId, snapshot.inProgress.id, naturalEdgeChoice)
    setSubmitting(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setSnapshot(result.snapshot)
    setPreview(null)
    setMessage('Hatched! The new Pokémon has been added.')
  }

  // Ready-to-hatch gets the same "needs your attention" warning highlight as an evolution-eligible
  // Team card, rather than the plain accent styling every other sidebar section uses.
  const ready = snapshot.inProgress?.ready ?? false

  return (
    <section className={`rounded p-4 ${ready ? 'border-2 border-warning bg-warning/10' : 'border border-accent bg-accent/10'}`}>
      <h2 className="mb-2 font-semibold">Egg</h2>

      {snapshot.inProgress ? (
        <div className="flex flex-col gap-2 text-sm">
          <p>
            {snapshot.inProgress.speciesName} — {snapshot.inProgress.sleepsCompleted} / {snapshot.inProgress.sleepsRequired} Sleeps
          </p>
          <button
            type="button"
            onClick={handleStopHatching}
            disabled={submitting}
            className="w-fit rounded border px-4 py-2 text-sm disabled:opacity-50"
          >
            Stop Hatching
          </button>
          {snapshot.inProgress.ready ? (
            preview ? (
              <div className="flex flex-col gap-2">
                <p>
                  Nature: <span className="font-semibold">{preview.natureName}</span>
                </p>
                <p className="text-xs text-muted">Natural Edge: pick a stat to permanently raise.</p>
                <table className="text-left">
                  <thead>
                    <tr className="text-xs text-muted">
                      <th className="pr-2"></th>
                      <th className="pr-2">Stat</th>
                      <th className="pr-2">Now</th>
                      <th>If chosen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.options.map((opt) => (
                      <tr key={opt.key}>
                        <td className="pr-2">
                          <input
                            type="radio"
                            name="natural-edge-target"
                            checked={targetStat === opt.key}
                            onChange={() => setTargetStat(opt.key)}
                          />
                        </td>
                        <td className="pr-2">{opt.label}</td>
                        <td className="pr-2">{opt.current}</td>
                        <td className="font-semibold">{opt.withBonus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button
                  type="button"
                  onClick={handleConfirmHatch}
                  disabled={submitting}
                  className="w-fit rounded bg-accent px-4 py-2 text-accent-foreground disabled:opacity-50"
                >
                  Confirm Hatch
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleHatchClick}
                disabled={submitting}
                className="w-fit rounded bg-accent px-4 py-2 text-accent-foreground disabled:opacity-50"
              >
                Hatch
              </button>
            )
          ) : (
            <p className="text-xs text-muted">Sleep to make progress.</p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2 text-sm">
          <select value={selectedTrainersItemId} onChange={(e) => setSelectedTrainersItemId(e.target.value)} className="bg-surface-subtle rounded border p-2">
            {snapshot.availableEggs.map((eg) => (
              <option key={eg.trainersItemId} value={eg.trainersItemId}>
                Egg — {eg.speciesName ?? 'Unknown species'}
                {eg.natureName ? ` (${eg.natureName})` : ''} ×{eg.quantity}
              </option>
            ))}
          </select>
          <button type="button" onClick={handleStart} disabled={submitting} className="w-fit rounded bg-accent px-4 py-2 text-accent-foreground disabled:opacity-50">
            Start Hatching
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-danger">{error}</p>}
      {message && !error && <p className="mt-2 text-success">{message}</p>}
    </section>
  )
}
