'use client'

import { useMemo, useState } from 'react'
import type { BagItem, CatalogItem } from '@/lib/pta3/bag'
import { grantItem, discardItem, useItem, buyItem, sellItem, adjustMoney, updateSellPricePercent, giveHeldItem } from './actions'

export type BagPokemonOption = {
  id: string
  name: string
  hasHeldItem: boolean
}

function matchesCatalogFilter(item: CatalogItem, searchText: string, category: string): boolean {
  if (searchText && !item.name.toLowerCase().includes(searchText.toLowerCase())) return false
  if (category && !item.categoryNames.includes(category)) return false
  return true
}

// Whole-number quantity, clamped to [1, cap] -- mirrors the server-side clampQuantity guard
// (bag/actions.ts) so the input never visibly disagrees with what the action will actually do.
function clampQty(value: number, cap: number): number {
  const n = Math.floor(value) || 1
  return Math.max(1, Math.min(cap, n))
}

export function BagBoard({
  trainerId,
  canManage,
  canAdjustMoney,
  canEditSellPercent,
  initialItems,
  initialMoney,
  initialSellPricePercent,
  catalog,
  pokemonOptions,
}: {
  trainerId: string
  canManage: boolean
  canAdjustMoney: boolean
  canEditSellPercent: boolean
  initialItems: BagItem[]
  initialMoney: number
  initialSellPricePercent: number
  catalog: CatalogItem[]
  pokemonOptions: BagPokemonOption[]
}) {
  const [items, setItems] = useState(initialItems)
  const [money, setMoney] = useState(initialMoney)
  const [sellPricePercent, setSellPricePercent] = useState(initialSellPricePercent)
  const [sellPercentInput, setSellPercentInput] = useState(initialSellPricePercent)
  const [error, setError] = useState<string | null>(null)
  const [moneyDelta, setMoneyDelta] = useState(0)
  const [view, setView] = useState<'bag' | 'catalog'>('bag')

  const [bagCategory, setBagCategory] = useState('')
  const [catalogSearch, setCatalogSearch] = useState('')
  const [catalogCategory, setCatalogCategory] = useState('')
  const [givingItemId, setGivingItemId] = useState<string | null>(null)
  const [givePokemonId, setGivePokemonId] = useState('')
  const [bagQuantities, setBagQuantities] = useState<Record<string, number>>({})
  const [catalogQuantities, setCatalogQuantities] = useState<Record<number, number>>({})

  const allCategoryNames = useMemo(() => {
    const set = new Set<string>()
    catalog.forEach((c) => c.categoryNames.forEach((n) => set.add(n)))
    return Array.from(set).sort()
  }, [catalog])

  const filteredItems = useMemo(
    () => (bagCategory ? items.filter((it) => it.categoryNames.includes(bagCategory)) : items),
    [items, bagCategory],
  )

  const filteredCatalog = useMemo(
    () => catalog.filter((it) => matchesCatalogFilter(it, catalogSearch, catalogCategory)),
    [catalog, catalogSearch, catalogCategory],
  )

  function getBagQty(id: string, max: number): number {
    return clampQty(bagQuantities[id] ?? 1, Math.min(100, max))
  }

  function setBagQty(id: string, max: number, value: number) {
    setBagQuantities((prev) => ({ ...prev, [id]: clampQty(value, Math.min(100, max)) }))
  }

  function getCatalogQty(id: number): number {
    return clampQty(catalogQuantities[id] ?? 1, 100)
  }

  function setCatalogQty(id: number, value: number) {
    setCatalogQuantities((prev) => ({ ...prev, [id]: clampQty(value, 100) }))
  }

  function applySnapshot(snapshot: { items: BagItem[]; money: number; sellPricePercent: number }) {
    setItems(snapshot.items)
    setMoney(snapshot.money)
    setSellPricePercent(snapshot.sellPricePercent)
  }

  async function handleGrant(itemId: number) {
    setError(null)
    const result = await grantItem(trainerId, itemId, getCatalogQty(itemId))
    if ('error' in result) {
      setError(result.error)
      return
    }
    applySnapshot(result)
  }

  async function handleBuy(item: CatalogItem) {
    setError(null)
    const qty = getCatalogQty(item.id)
    const totalCost = (item.price ?? 0) * qty
    if (!window.confirm(`Buy ${qty} × ${item.name} for ${totalCost} P?`)) return
    const result = await buyItem(trainerId, item.id, qty)
    if ('error' in result) {
      setError(result.error)
      return
    }
    applySnapshot(result)
  }

  async function handleUse(it: BagItem) {
    setError(null)
    if (!window.confirm(`Use ${it.name}?`)) return
    const result = await useItem(trainerId, it.id)
    if ('error' in result) {
      setError(result.error)
      return
    }
    applySnapshot(result)
  }

  async function handleDiscard(it: BagItem) {
    setError(null)
    const qty = getBagQty(it.id, it.quantity)
    if (!window.confirm(`Discard ${qty} × ${it.name}? This cannot be undone.`)) return
    const result = await discardItem(trainerId, it.id, qty)
    if ('error' in result) {
      setError(result.error)
      return
    }
    applySnapshot(result)
  }

  async function handleSell(it: BagItem) {
    setError(null)
    const qty = getBagQty(it.id, it.quantity)
    const saleValue = it.price !== null ? Math.floor((it.price * sellPricePercent) / 100) * qty : 0
    if (!window.confirm(`Sell ${qty} × ${it.name} for ${saleValue} P?`)) return
    const result = await sellItem(trainerId, it.id, qty)
    if ('error' in result) {
      setError(result.error)
      return
    }
    applySnapshot(result)
  }

  async function handleMoneyAdjust(sign: 1 | -1) {
    setError(null)
    const result = await adjustMoney(trainerId, sign * moneyDelta)
    if ('error' in result) {
      setError(result.error)
      return
    }
    applySnapshot(result)
  }

  async function handleSaveSellPercent() {
    setError(null)
    const result = await updateSellPricePercent(trainerId, sellPercentInput)
    if ('error' in result) {
      setError(result.error)
      return
    }
    applySnapshot(result)
  }

  async function handleGive(trainersItemId: string) {
    if (!givePokemonId) return
    setError(null)
    const result = await giveHeldItem(trainerId, trainersItemId, givePokemonId)
    if ('error' in result) {
      setError(result.error)
      return
    }
    applySnapshot(result)
    setGivingItemId(null)
    setGivePokemonId('')
  }

  return (
    <div className="flex w-full max-w-4xl flex-col gap-6">
      {error && <p className="text-danger">{error}</p>}

      <section className="rounded border border-accent bg-accent/10 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-2xl font-bold leading-none">{money} P</p>
            <p className="text-xs uppercase tracking-wide text-muted">Money</p>
          </div>
          {canAdjustMoney && (
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => handleMoneyAdjust(1)} className="rounded border border-success px-3 py-2 text-sm font-semibold text-success">
                Add
              </button>
              <input
                type="number"
                value={moneyDelta}
                min={0}
                onChange={(e) => setMoneyDelta(Math.max(0, Number(e.target.value)))}
                className="bg-surface-subtle w-20 rounded border p-2 text-center"
              />
              <button type="button" onClick={() => handleMoneyAdjust(-1)} className="rounded border border-danger px-3 py-2 text-sm font-semibold text-danger">
                Remove
              </button>
            </div>
          )}
        </div>
        {canEditSellPercent && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3 text-sm">
            <label htmlFor="sellPercent">Sell price</label>
            <input
              id="sellPercent"
              type="number"
              min={0}
              max={100}
              value={sellPercentInput}
              onChange={(e) => setSellPercentInput(Math.max(0, Math.min(100, Number(e.target.value))))}
              className="bg-surface-subtle w-16 rounded border p-2 text-center"
            />
            <span className="text-muted">% of buy price (currently {sellPricePercent}%)</span>
            <button type="button" onClick={handleSaveSellPercent} className="rounded border px-3 py-1 text-sm">
              Save
            </button>
          </div>
        )}
      </section>

      {canManage && (
        <div className="flex gap-2 border-b">
          <button
            type="button"
            onClick={() => setView('bag')}
            className={`px-3 py-2 text-sm font-semibold ${view === 'bag' ? 'border-b-2 border-accent text-foreground' : 'text-muted'}`}
          >
            Bag
          </button>
          <button
            type="button"
            onClick={() => setView('catalog')}
            className={`px-3 py-2 text-sm font-semibold ${view === 'catalog' ? 'border-b-2 border-accent text-foreground' : 'text-muted'}`}
          >
            Manage Inventory
          </button>
        </div>
      )}

      {view === 'bag' && (
      <section>
        <h2 className="mb-2 font-semibold">Bag ({filteredItems.length} of {items.length})</h2>
        <div className="mb-2 flex items-center gap-2 text-sm">
          <label htmlFor="bagCategory">Category</label>
          <select id="bagCategory" value={bagCategory} onChange={(e) => setBagCategory(e.target.value)} className="bg-surface-subtle rounded border px-2 py-1">
            <option value="">All</option>
            {allCategoryNames.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        {filteredItems.length === 0 ? (
          <p className="text-sm text-muted">No items.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {filteredItems.map((it) => (
              <li key={it.id} className="rounded border-accent bg-accent/10 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {it.name} x{it.quantity}
                      {it.moveName ? ` (${it.moveName})` : ''}
                      {it.pokedexName ? ` (${it.pokedexName})` : ''}
                    </p>
                    <p className="text-xs text-muted">{it.categoryNames.join(', ')}</p>
                    {it.description && <p className="mt-1 text-sm">{it.description}</p>}
                  </div>
                  {canManage && (
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={Math.min(100, it.quantity)}
                        value={getBagQty(it.id, it.quantity)}
                        onChange={(e) => setBagQty(it.id, it.quantity, Number(e.target.value))}
                        className="bg-surface-subtle w-14 rounded border p-1 text-center text-xs"
                      />
                      <button type="button" onClick={() => handleUse(it)} className="rounded bg-accent px-2 py-1 text-xs text-accent-foreground">
                        Use
                      </button>
                      {it.price !== null && (
                        <button type="button" onClick={() => handleSell(it)} className="rounded border border-success px-2 py-1 text-xs text-success">
                          Sell
                        </button>
                      )}
                      <button type="button" onClick={() => handleDiscard(it)} className="rounded border border-danger px-2 py-1 text-xs text-danger">
                        Discard
                      </button>
                      {it.holdable && (
                        <button
                          type="button"
                          onClick={() => setGivingItemId(givingItemId === it.id ? null : it.id)}
                          className="rounded border px-2 py-1 text-xs"
                        >
                          Give to Pokémon
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {givingItemId === it.id && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 border-t pt-2 text-sm">
                    <select
                      value={givePokemonId}
                      onChange={(e) => setGivePokemonId(e.target.value)}
                      className="bg-surface-subtle rounded border px-2 py-1"
                    >
                      <option value="">Select a Pokémon…</option>
                      {pokemonOptions.map((p) => (
                        <option key={p.id} value={p.id} disabled={p.hasHeldItem}>
                          {p.name}{p.hasHeldItem ? ' (already holding an item)' : ''}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={!givePokemonId}
                      onClick={() => handleGive(it.id)}
                      className="rounded bg-accent px-3 py-1 text-accent-foreground disabled:opacity-50"
                    >
                      Confirm
                    </button>
                    <button type="button" onClick={() => setGivingItemId(null)} className="rounded border px-2 py-1">
                      Cancel
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      )}

      {canManage && view === 'catalog' && (
        <section>
          <h2 className="mb-2 font-semibold">Catalog</h2>
          <div className="mb-2 flex flex-wrap items-end gap-2 text-sm">
            <div className="flex flex-col gap-1">
              <label htmlFor="catalogSearch">Search</label>
              <input
                id="catalogSearch"
                type="text"
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                className="bg-surface-subtle rounded border px-2 py-1"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="catalogCategory">Category</label>
              <select
                id="catalogCategory"
                value={catalogCategory}
                onChange={(e) => setCatalogCategory(e.target.value)}
                className="bg-surface-subtle rounded border px-2 py-1"
              >
                <option value="">All</option>
                {allCategoryNames.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <p className="ml-auto text-xs text-muted">{filteredCatalog.length} of {catalog.length}</p>
          </div>
          <ul className="flex max-h-96 flex-col gap-1 overflow-y-auto">
            {filteredCatalog.map((it) => (
              <li key={it.id} className="flex flex-col gap-1 rounded border px-2 py-1 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate">
                    {it.name}
                    {it.price !== null && <span className="text-muted"> — {it.price} P</span>}
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={getCatalogQty(it.id)}
                      onChange={(e) => setCatalogQty(it.id, Number(e.target.value))}
                      className="bg-surface-subtle w-14 rounded border p-1 text-center text-xs"
                    />
                    <button type="button" onClick={() => handleGrant(it.id)} className="rounded border px-2 py-1 text-xs">
                      Grant
                    </button>
                    {it.buyable && it.price !== null && (
                      <button
                        type="button"
                        disabled={money < it.price * getCatalogQty(it.id)}
                        onClick={() => handleBuy(it)}
                        className="rounded bg-accent px-2 py-1 text-xs text-accent-foreground disabled:opacity-50"
                      >
                        Buy
                      </button>
                    )}
                  </div>
                </div>
                {it.description && (
                  <details className="text-xs text-muted">
                    <summary className="cursor-pointer">Details</summary>
                    <p className="mt-1">{it.description}</p>
                  </details>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
