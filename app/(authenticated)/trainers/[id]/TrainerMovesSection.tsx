'use client'

import { useState } from 'react'
import { learnTrainerMove, forgetTrainerMove, setTrainerMoveUsesRemaining } from '@/app/(authenticated)/trainers/actions'
import { parseMoveFrequency } from '@/lib/pta3/moveFrequency'
import type { KnownTrainerMove, TrainerMoveInfo } from '@/lib/pta3/trainerMoves'

// [[Feature - Implement Trainer Moves]]: the Trainer's own moves. The owner or the GM adds whichever Move applies (there
// is no learnset to gate it -- a Class Feature, an item or the story hands it out) and removes it again; "N/day" moves
// get the same row of use boxes a Pokemon's moves have, recharged by Sleep.
export function TrainerMovesSection({
  trainerId,
  initialMoves,
  catalog,
  canEdit,
}: {
  trainerId: string
  initialMoves: KnownTrainerMove[]
  catalog: TrainerMoveInfo[]
  canEdit: boolean
}) {
  const [moves, setMoves] = useState(initialMoves)
  const [error, setError] = useState<string | null>(null)
  const [pickedId, setPickedId] = useState('')
  const [search, setSearch] = useState('')
  const [pending, setPending] = useState(false)

  const knownIds = new Set(moves.map((m) => m.id))
  const query = search.trim().toLowerCase()
  const addable = catalog.filter((m) => !knownIds.has(m.id) && (query === '' || m.name.toLowerCase().includes(query)))

  async function handleAdd() {
    const moveId = Number(pickedId)
    const info = catalog.find((m) => m.id === moveId)
    if (!info) return
    setError(null)
    setPending(true)
    const result = await learnTrainerMove(trainerId, moveId)
    setPending(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setMoves((prev) => [...prev, { ...info, usesRemaining: result.usesRemaining }].sort((a, b) => a.name.localeCompare(b.name)))
    setPickedId('')
    setSearch('')
  }

  async function handleForget(moveId: number) {
    setError(null)
    const result = await forgetTrainerMove(trainerId, moveId)
    if (result?.error) {
      setError(result.error)
      return
    }
    setMoves((prev) => prev.filter((m) => m.id !== moveId))
  }

  async function handleUse(moveId: number, target: number) {
    setError(null)
    const result = await setTrainerMoveUsesRemaining(trainerId, moveId, target)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setMoves((prev) => prev.map((m) => (m.id === moveId ? { ...m, usesRemaining: result.usesRemaining } : m)))
  }

  return (
    <section className="rounded border border-accent bg-accent/10 p-4">
      <h2 className="mb-2 font-semibold">Trainer Moves</h2>
      {error && <p className="mb-2 text-sm text-danger">{error}</p>}
      {moves.length === 0 ? (
        <p className="text-sm text-muted">None yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {moves.map((m) => {
            const { maxUses } = parseMoveFrequency(m.frequency)
            const slotCount = maxUses ?? m.usesRemaining ?? 0
            const usedCount = m.usesRemaining !== null ? slotCount - m.usesRemaining : 0
            return (
              <li key={m.id} className="rounded border bg-surface p-3">
                <div className="flex items-start justify-between gap-2">
                  <details className="min-w-0 flex-1">
                    <summary className="cursor-pointer font-medium">
                      {m.name}{' '}
                      <span className="text-sm font-normal text-muted">
                        {[m.typeName, m.frequency, m.damageDice].filter(Boolean).join(' · ')}
                      </span>
                    </summary>
                    <p className="mt-1 text-xs text-muted">
                      {[m.damageStat === 'either' ? null : m.damageStat, m.range].filter(Boolean).join(' · ')}
                    </p>
                    {m.description && <p className="mt-1 text-sm text-muted">{m.description}</p>}
                  </details>
                  {canEdit && (
                    <button type="button" onClick={() => handleForget(m.id)} className="rounded border px-2 py-0.5 text-xs">
                      Remove
                    </button>
                  )}
                </div>
                {slotCount > 0 && (
                  <div className="mt-2 flex items-center gap-1 text-sm">
                    {Array.from({ length: slotCount }, (_, slot) => {
                      const isUsed = slot < usedCount
                      const target = isUsed ? slotCount - (usedCount - 1) : slotCount - (usedCount + 1)
                      const className = `flex h-5 w-5 items-center justify-center rounded border text-xs leading-none ${
                        isUsed ? 'border-accent bg-accent text-accent-foreground' : 'border text-transparent'
                      }`
                      return canEdit ? (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => handleUse(m.id, target)}
                          aria-label={isUsed ? 'Mark use available' : 'Mark use consumed'}
                          className={className}
                        >
                          ✓
                        </button>
                      ) : (
                        <span key={slot} className={className}>
                          ✓
                        </span>
                      )
                    })}
                    <span className="ml-2 text-xs text-muted">Resets on rest</span>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {canEdit && (
        <div className="mt-3 flex flex-col gap-2 border-t pt-3">
          <p className="text-xs text-muted">Add a move this Trainer has gained (from a Class Feature, an item, or the story).</p>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search moves"
            className="rounded border bg-surface px-2 py-1 text-sm"
          />
          <div className="flex gap-2">
            <select
              value={pickedId}
              onChange={(e) => setPickedId(e.target.value)}
              className="min-w-0 flex-1 rounded border bg-surface px-2 py-1 text-sm"
              aria-label="Move to add"
            >
              <option value="">Select a move…</option>
              {addable.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.typeName ? ` (${m.typeName})` : ''}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!pickedId || pending}
              className="rounded border border-accent px-3 py-1 text-sm font-semibold text-accent disabled:opacity-40"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
