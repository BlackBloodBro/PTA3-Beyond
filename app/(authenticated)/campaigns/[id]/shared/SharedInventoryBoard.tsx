'use client'

import { useEffect, useState, useTransition } from 'react'
import type { SharedItem, SharedSnapshot } from '@/lib/pta3/sharedInventory'
import { loadSharedState, transferItem, transferMoney, type SharedState, type TrainerItemRow } from './actions'

export type SharedTrainerOption = { id: string; name: string; isNpc: boolean; money: number }

function sharedItemLabel(i: SharedItem): string {
  return `${i.name}${i.moveName ? ` (${i.moveName})` : ''}${i.pokedexName ? ` (${i.pokedexName})` : ''}${i.natureName ? ` (${i.natureName} nature)` : ''}${
    i.usesRemaining !== null ? ` — ${i.usesRemaining} use${i.usesRemaining === 1 ? '' : 's'} left` : ''
  }`
}

// [[Feature - Shared currency and inventory]]: everything here is done "as" one Trainer -- money and items move between
// that Trainer's own balance / inventory and the Campaign's pool. All the rules (who may act, enough money / items,
// stacking, no double-spend when two people act at once) live in the database functions the actions call.
export function SharedInventoryBoard({
  campaignId,
  initialShared,
  trainers: initialTrainers,
}: {
  campaignId: string
  initialShared: SharedSnapshot
  trainers: SharedTrainerOption[]
}) {
  const [shared, setShared] = useState(initialShared)
  const [trainers, setTrainers] = useState(initialTrainers)
  const [actingId, setActingId] = useState(initialTrainers[0]?.id ?? '')
  const [trainerItems, setTrainerItems] = useState<TrainerItemRow[] | null>(null)
  const [amount, setAmount] = useState('')
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const acting = trainers.find((t) => t.id === actingId) ?? null

  function apply(state: SharedState) {
    setShared(state.shared)
    setTrainerItems(state.trainerItems)
    setTrainers((prev) => prev.map((t) => (t.id === actingId ? { ...t, money: state.trainerMoney } : t)))
  }

  // Load the acting Trainer's own inventory (the list to deposit from) whenever they change.
  useEffect(() => {
    if (!actingId) return
    let cancelled = false
    setTrainerItems(null)
    loadSharedState(campaignId, actingId).then((res) => {
      if (cancelled) return
      if ('error' in res) {
        setError(res.error)
        return
      }
      setShared(res.shared)
      setTrainerItems(res.trainerItems)
      setTrainers((prev) => prev.map((t) => (t.id === actingId ? { ...t, money: res.trainerMoney } : t)))
    })
    return () => {
      cancelled = true
    }
  }, [campaignId, actingId])

  function runMoney(direction: 'deposit' | 'withdraw') {
    setError(null)
    setMessage(null)
    const n = Number(amount)
    startTransition(async () => {
      const res = await transferMoney(campaignId, actingId, direction, n)
      if ('error' in res) {
        setError(res.error)
        return
      }
      apply(res)
      setMessage(`${direction === 'deposit' ? 'Deposited' : 'Withdrew'} ${n} P.`)
      setAmount('')
    })
  }

  function runItem(direction: 'deposit' | 'withdraw', rowId: string, label: string) {
    setError(null)
    setMessage(null)
    const q = Number(quantities[`${direction}-${rowId}`] ?? '1')
    startTransition(async () => {
      const res = await transferItem(campaignId, actingId, direction, rowId, q)
      if ('error' in res) {
        setError(res.error)
        return
      }
      apply(res)
      setMessage(`${direction === 'deposit' ? 'Deposited' : 'Withdrew'} ${q} × ${label}.`)
      setQuantities((prev) => ({ ...prev, [`${direction}-${rowId}`]: '1' }))
    })
  }

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <section className="rounded border-accent bg-accent/10 p-4">
        <h2 className="text-lg font-semibold">Shared fund</h2>
        <p className="text-3xl font-bold">{shared.money} P</p>
      </section>

      {trainers.length === 0 ? (
        <p className="text-sm text-muted">You have no Trainer in this Campaign, so you can look at the shared inventory but not move anything.</p>
      ) : (
        <section className="flex flex-col gap-3 rounded border-accent bg-accent/10 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Acting as
              <select value={actingId} onChange={(e) => setActingId(e.target.value)} className="bg-surface-subtle rounded border px-2 py-1">
                {trainers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.isNpc ? ' (NPC)' : ''}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-sm">
              Their money: <span className="font-semibold">{acting?.money ?? 0} P</span>
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-sm">
              Amount (P)
              <input
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-surface-subtle w-32 rounded border px-2 py-1"
              />
            </label>
            <button type="button" onClick={() => runMoney('deposit')} disabled={isPending || !amount} className="rounded border border-accent px-3 py-1 text-sm text-accent disabled:opacity-40">
              Deposit to shared fund
            </button>
            <button type="button" onClick={() => runMoney('withdraw')} disabled={isPending || !amount} className="rounded border border-accent px-3 py-1 text-sm text-accent disabled:opacity-40">
              Withdraw from shared fund
            </button>
          </div>

          {error && <p className="text-danger">{error}</p>}
          {message && <p className="text-sm font-semibold">{message}</p>}
        </section>
      )}

      <section className="flex flex-col gap-2 rounded border-accent bg-accent/10 p-4">
        <h2 className="text-lg font-semibold">Shared items</h2>
        {shared.items.length === 0 ? (
          <p className="text-sm text-muted">Nothing in the shared inventory yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {shared.items.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="min-w-48 flex-1" title={i.description ?? undefined}>
                  {sharedItemLabel(i)} <span className="text-xs text-muted">×{i.quantity}</span>
                </span>
                {trainers.length > 0 && (
                  <>
                    {i.stackable && (
                      <input
                        type="number"
                        min={1}
                        max={i.quantity}
                        value={quantities[`withdraw-${i.id}`] ?? '1'}
                        onChange={(e) => setQuantities((prev) => ({ ...prev, [`withdraw-${i.id}`]: e.target.value }))}
                        aria-label={`Quantity of ${i.name} to withdraw`}
                        className="bg-surface-subtle w-16 rounded border px-2 py-1"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => runItem('withdraw', i.id, i.name)}
                      disabled={isPending}
                      className="rounded border border-accent px-2 py-0.5 text-xs font-semibold text-accent disabled:opacity-40"
                    >
                      Withdraw
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {trainers.length > 0 && (
        <section className="flex flex-col gap-2 rounded border-accent bg-accent/10 p-4">
          <h2 className="text-lg font-semibold">Deposit from {acting?.name ?? 'a Trainer'}&apos;s inventory</h2>
          {trainerItems === null ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : trainerItems.length === 0 ? (
            <p className="text-sm text-muted">This Trainer&apos;s inventory is empty.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {trainerItems.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="min-w-48 flex-1">
                    {i.label} <span className="text-xs text-muted">×{i.quantity}</span>
                  </span>
                  {i.stackable && i.quantity > 1 && (
                    <input
                      type="number"
                      min={1}
                      max={i.quantity}
                      value={quantities[`deposit-${i.id}`] ?? '1'}
                      onChange={(e) => setQuantities((prev) => ({ ...prev, [`deposit-${i.id}`]: e.target.value }))}
                      aria-label={`Quantity of ${i.name} to deposit`}
                      className="bg-surface-subtle w-16 rounded border px-2 py-1"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => runItem('deposit', i.id, i.name)}
                    disabled={isPending}
                    className="rounded border border-accent px-2 py-0.5 text-xs font-semibold text-accent disabled:opacity-40"
                  >
                    Deposit
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
