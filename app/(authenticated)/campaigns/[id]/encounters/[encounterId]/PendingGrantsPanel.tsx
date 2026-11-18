'use client'

import { useState } from 'react'
import type { PendingGrant } from '@/lib/pta3/pendingGrants'
import { approveAllPendingGrants, approvePendingGrant, loadPendingGrants, rejectPendingGrant } from './pendingGrantActions'

// [[Feature - Let the GM approve EXP and LP gained in an Encounter]]: GM-only review of the EXP/LP that Move used and
// Fainted have collected per Pokemon during this Encounter. Each line is editable; Approve applies it, Reject discards
// it, Approve all applies every line as shown. Not part of the live poll (players never see this), so it refreshes
// on demand and after every action.
export function PendingGrantsPanel({ encounterId, initialGrants }: { encounterId: string; initialGrants: PendingGrant[] }) {
  const [grants, setGrants] = useState(initialGrants)
  const [drafts, setDrafts] = useState<Record<string, { exp: string; lp: string }>>({})
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function draftFor(g: PendingGrant) {
    return drafts[g.pokemonId] ?? { exp: String(g.exp), lp: String(g.loyaltyPoints) }
  }

  function setDraft(pokemonId: string, field: 'exp' | 'lp', value: string, g: PendingGrant) {
    setDrafts((prev) => ({ ...prev, [pokemonId]: { ...draftFor(g), ...prev[pokemonId], [field]: value } }))
  }

  function parsed(g: PendingGrant): { exp: number; loyaltyPoints: number } | null {
    const d = draftFor(g)
    const exp = Number(d.exp)
    const loyaltyPoints = Number(d.lp)
    if (d.exp.trim() === '' || d.lp.trim() === '' || !Number.isInteger(exp) || !Number.isInteger(loyaltyPoints)) return null
    return { exp, loyaltyPoints }
  }

  async function refresh() {
    setPending('refresh')
    setError(null)
    const fresh = await loadPendingGrants(encounterId)
    setGrants(fresh)
    // Keep edits only for lines whose stored totals haven't moved since; a line that grew gets the new numbers.
    setDrafts((prev) =>
      Object.fromEntries(
        Object.entries(prev).filter(([id]) => {
          const before = grants.find((g) => g.pokemonId === id)
          const after = fresh.find((g) => g.pokemonId === id)
          return before && after && before.exp === after.exp && before.loyaltyPoints === after.loyaltyPoints
        }),
      ),
    )
    setPending(null)
  }

  function removeLines(ids: string[]) {
    setGrants((prev) => prev.filter((g) => !ids.includes(g.pokemonId)))
    setDrafts((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => !ids.includes(id))))
  }

  async function handleApprove(g: PendingGrant) {
    const amounts = parsed(g)
    if (!amounts) {
      setError(`Enter whole numbers for ${g.name}`)
      return
    }
    setPending(g.pokemonId)
    setError(null)
    const result = await approvePendingGrant(encounterId, g.pokemonId, amounts.exp, amounts.loyaltyPoints)
    setPending(null)
    if ('error' in result) {
      setError(result.error)
      return
    }
    removeLines([g.pokemonId])
  }

  async function handleReject(g: PendingGrant) {
    setPending(g.pokemonId)
    setError(null)
    const result = await rejectPendingGrant(encounterId, g.pokemonId)
    setPending(null)
    if ('error' in result) {
      setError(result.error)
      return
    }
    removeLines([g.pokemonId])
  }

  async function handleApproveAll() {
    const lines: { pokemonId: string; exp: number; loyaltyPoints: number }[] = []
    for (const g of grants) {
      const amounts = parsed(g)
      if (!amounts) {
        setError(`Enter whole numbers for ${g.name}`)
        return
      }
      lines.push({ pokemonId: g.pokemonId, ...amounts })
    }
    setPending('all')
    setError(null)
    const result = await approveAllPendingGrants(encounterId, lines)
    setPending(null)
    if ('error' in result) {
      removeLines(result.approvedPokemonIds)
      setError(result.error)
      return
    }
    removeLines(lines.map((l) => l.pokemonId))
  }

  const busy = pending !== null

  return (
    <section className="w-full max-w-2xl rounded border border-accent bg-accent/10 p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">
          EXP &amp; LP to approve {grants.length > 0 && <span className="text-sm font-normal text-muted">({grants.length})</span>}
        </h2>
        <div className="flex gap-2">
          <button type="button" onClick={refresh} disabled={busy} className="rounded border px-3 py-1 text-sm disabled:opacity-40">
            {pending === 'refresh' ? 'Refreshing…' : 'Refresh'}
          </button>
          {grants.length > 0 && (
            <button
              type="button"
              onClick={handleApproveAll}
              disabled={busy}
              className="rounded bg-accent px-3 py-1 text-sm text-accent-foreground disabled:opacity-40"
            >
              {pending === 'all' ? 'Approving…' : 'Approve all'}
            </button>
          )}
        </div>
      </div>
      <p className="mb-2 text-xs text-muted">
        Collected from Moves used and Pokémon fainting in this encounter. Only you can see this; Pokémon only change once
        you approve.
      </p>
      {error && <p className="mb-2 text-sm text-danger">{error}</p>}
      {grants.length === 0 ? (
        <p className="text-sm text-muted">Nothing waiting for approval.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {grants.map((g) => {
            const d = draftFor(g)
            return (
              <li key={g.pokemonId} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="min-w-40 flex-1 font-medium">{g.name}</span>
                <label className="flex items-center gap-1">
                  EXP
                  <input
                    type="number"
                    step={1}
                    value={d.exp}
                    onChange={(e) => setDraft(g.pokemonId, 'exp', e.target.value, g)}
                    disabled={busy}
                    className="bg-surface-subtle w-20 rounded border px-2 py-0.5"
                  />
                </label>
                <label className="flex items-center gap-1">
                  LP
                  <input
                    type="number"
                    step={1}
                    value={d.lp}
                    onChange={(e) => setDraft(g.pokemonId, 'lp', e.target.value, g)}
                    disabled={busy}
                    className="bg-surface-subtle w-16 rounded border px-2 py-0.5"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => handleApprove(g)}
                  disabled={busy}
                  className="rounded border border-accent px-2 py-0.5 text-xs font-semibold text-accent disabled:opacity-40"
                >
                  {pending === g.pokemonId ? '…' : 'Approve'}
                </button>
                <button
                  type="button"
                  onClick={() => handleReject(g)}
                  disabled={busy}
                  className="rounded border px-2 py-0.5 text-xs disabled:opacity-40"
                >
                  Reject
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
