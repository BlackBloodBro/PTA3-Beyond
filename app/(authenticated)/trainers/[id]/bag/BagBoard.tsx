'use client'

import { useMemo, useState } from 'react'
import type { BagItem, CatalogItem, TmMoveOption, TmPriceOption } from '@/lib/pta3/bag'
import { SpeciesPicker } from '@/components/SpeciesPicker'
import { grantItem, discardItem, useItem, buyItem, sellItem, adjustMoney, giveHeldItem, teachTmMove } from './actions'

type SpeciesOption = { id: number; name: string; sprite_code: string }

export type BagPokemonOption = {
  id: string
  name: string
  hasHeldItem: boolean
  partySlot: number | null
}

function matchesCatalogFilter(item: CatalogItem, searchText: string, category: string): boolean {
  if (searchText && !item.name.toLowerCase().includes(searchText.toLowerCase())) return false
  if (category && !item.categoryNames.includes(category)) return false
  return true
}

// Team first (in slot order), then PC (alphabetically) -- see [[Held item list shouldn't show all
// Pokemon]]. Same native <optgroup> approach PokemonAssignmentPanel.tsx already uses for its own
// (differently-grouped) trainer <select>, not a new UI pattern.
function groupPokemonOptions(options: BagPokemonOption[]): [string, BagPokemonOption[]][] {
  const team = options.filter((p) => p.partySlot !== null).sort((a, b) => a.partySlot! - b.partySlot!)
  const pc = options.filter((p) => p.partySlot === null).sort((a, b) => a.name.localeCompare(b.name))
  const groups: [string, BagPokemonOption[]][] = []
  if (team.length > 0) groups.push(['Team', team])
  if (pc.length > 0) groups.push(['PC', pc])
  return groups
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
  initialItems,
  initialMoney,
  initialSellPricePercent,
  catalog,
  pokemonOptions,
  speciesList,
  tmMoves,
  tmPrices,
}: {
  trainerId: string
  canManage: boolean
  canAdjustMoney: boolean
  initialItems: BagItem[]
  initialMoney: number
  initialSellPricePercent: number
  catalog: CatalogItem[]
  pokemonOptions: BagPokemonOption[]
  speciesList: SpeciesOption[]
  tmMoves: TmMoveOption[]
  tmPrices: TmPriceOption[]
}) {
  const [items, setItems] = useState(initialItems)
  const [money, setMoney] = useState(initialMoney)
  const [sellPricePercent, setSellPricePercent] = useState(initialSellPricePercent)
  const [error, setError] = useState<string | null>(null)
  const [moneyDelta, setMoneyDelta] = useState(0)
  const [view, setView] = useState<'bag' | 'catalog'>('bag')

  const [bagCategory, setBagCategory] = useState('')
  const [catalogSearch, setCatalogSearch] = useState('')
  const [catalogCategory, setCatalogCategory] = useState('')
  const [givingItemId, setGivingItemId] = useState<string | null>(null)
  const [givePokemonId, setGivePokemonId] = useState('')
  const [catalogSort, setCatalogSort] = useState<'name' | 'price-asc' | 'price-desc'>('name')
  const [bagQuantities, setBagQuantities] = useState<Record<string, number>>({})
  const [catalogQuantities, setCatalogQuantities] = useState<Record<number, number>>({})
  // Species picked per catalog row -- only meaningful for items in the "Eggs" category, keyed by
  // item id so switching rows doesn't clobber each other's in-progress pick.
  const [catalogSpecies, setCatalogSpecies] = useState<Record<number, string>>({})
  // Move picked per catalog row -- only meaningful for items in the "Technical Machines" category.
  const [catalogMove, setCatalogMove] = useState<Record<number, string>>({})
  const [teachingItemId, setTeachingItemId] = useState<string | null>(null)
  const [teachPokemonId, setTeachPokemonId] = useState('')

  const allCategoryNames = useMemo(() => {
    const set = new Set<string>()
    catalog.forEach((c) => c.categoryNames.forEach((n) => set.add(n)))
    return Array.from(set).sort()
  }, [catalog])

  const groupedPokemonOptions = useMemo(() => groupPokemonOptions(pokemonOptions), [pokemonOptions])

  const filteredItems = useMemo(
    () => (bagCategory ? items.filter((it) => it.categoryNames.includes(bagCategory)) : items),
    [items, bagCategory],
  )

  const filteredCatalog = useMemo(() => {
    const matches = catalog.filter((it) => matchesCatalogFilter(it, catalogSearch, catalogCategory))
    if (catalogSort === 'name') return matches
    // Unpriced items (plates, gems, etc. -- see [[Fill out the Items table]]) have nothing to compare,
    // so they sink to the end under either price sort rather than clustering at the top under "asc".
    const sign = catalogSort === 'price-asc' ? 1 : -1
    return [...matches].sort((a, b) => {
      if (a.price === null && b.price === null) return 0
      if (a.price === null) return 1
      if (b.price === null) return -1
      return sign * (a.price - b.price)
    })
  }, [catalog, catalogSearch, catalogCategory, catalogSort])

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

  // Resolves the species picked for this catalog row (defaulting to the first species alphabetically,
  // same default SpeciesPicker itself falls back to) into an id -- null for any non-Egg item, since
  // pokedexId is meaningless for those.
  function resolveCatalogPokedexId(item: CatalogItem): number | null {
    if (!item.categoryNames.includes('Eggs')) return null
    const pickedName = catalogSpecies[item.id] ?? speciesList[0]?.name
    return speciesList.find((s) => s.name === pickedName)?.id ?? null
  }

  // TM and TR are now single generic items (not one row per frequency tier), so the full TM-eligible
  // movepool is offered on both -- whichever move you pick determines the price (see
  // resolveCatalogPrice below), not the other way around.
  function eligibleTmMoves(): TmMoveOption[] {
    return tmMoves
  }

  // Resolves the move picked for this catalog row into an id -- null for any non-Technical-Machines
  // item, or if no eligible move exists to default to.
  function resolveCatalogMoveId(item: CatalogItem): number | null {
    if (!item.categoryNames.includes('Technical Machines')) return null
    const options = eligibleTmMoves()
    const pickedName = catalogMove[item.id] ?? options[0]?.name
    return options.find((m) => m.name === pickedName)?.id ?? null
  }

  // Client-side price preview only -- buyItem/sellItem always recompute this server-side, so a stale
  // value here can never change what's actually charged. Static `items.price` for everything except
  // TM/TR, which have none of their own and price by the picked move's frequency instead.
  function resolveCatalogPrice(item: CatalogItem): number | null {
    if (item.price !== null) return item.price
    const moveId = resolveCatalogMoveId(item)
    const move = moveId !== null ? tmMoves.find((m) => m.id === moveId) : undefined
    if (!move) return null
    return tmPrices.find((p) => p.itemName === item.name && p.frequency === move.frequency)?.price ?? null
  }

  // Same preview-only price resolution for an already-owned Bag row (Sell), using its own attached
  // move rather than a live picker.
  function resolveBagItemPrice(it: BagItem): number | null {
    if (it.price !== null) return it.price
    if (it.moveName === null) return null
    const move = tmMoves.find((m) => m.name === it.moveName)
    if (!move) return null
    return tmPrices.find((p) => p.itemName === it.name && p.frequency === move.frequency)?.price ?? null
  }

  async function handleGrant(item: CatalogItem) {
    setError(null)
    const result = await grantItem(trainerId, item.id, getCatalogQty(item.id), resolveCatalogPokedexId(item), resolveCatalogMoveId(item))
    if ('error' in result) {
      setError(result.error)
      return
    }
    applySnapshot(result)
  }

  async function handleBuy(item: CatalogItem) {
    setError(null)
    const qty = getCatalogQty(item.id)
    const totalCost = (resolveCatalogPrice(item) ?? 0) * qty
    if (!window.confirm(`Buy ${qty} × ${item.name} for ${totalCost} P?`)) return
    const result = await buyItem(trainerId, item.id, qty, resolveCatalogPokedexId(item), resolveCatalogMoveId(item))
    if ('error' in result) {
      setError(result.error)
      return
    }
    applySnapshot(result)
  }

  async function handleTeach(trainersItemId: string) {
    if (!teachPokemonId) return
    setError(null)
    const result = await teachTmMove(trainerId, trainersItemId, teachPokemonId)
    if ('error' in result) {
      setError(result.error)
      return
    }
    applySnapshot(result)
    setTeachingItemId(null)
    setTeachPokemonId('')
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
    const price = resolveBagItemPrice(it)
    const saleValue = price !== null ? Math.floor((price * sellPricePercent) / 100) * qty : 0
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
      </section>

      {canManage && (
        <div className="flex gap-2 border-b">
          <button
            type="button"
            onClick={() => setView('bag')}
            className={`px-3 py-2 text-sm font-semibold ${view === 'bag' ? 'border-b-2 border-accent text-foreground' : 'text-muted'}`}
          >
            Inventory
          </button>
          <button
            type="button"
            onClick={() => setView('catalog')}
            className={`px-3 py-2 text-sm font-semibold ${view === 'catalog' ? 'border-b-2 border-accent text-foreground' : 'text-muted'}`}
          >
            Catalog
          </button>
        </div>
      )}

      {view === 'bag' && (
      <section>
        <h2 className="mb-2 font-semibold">Inventory ({filteredItems.length} of {items.length})</h2>
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
                      {it.usesRemaining !== null ? ` — ${it.usesRemaining} use${it.usesRemaining === 1 ? '' : 's'} left` : ''}
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
                      {resolveBagItemPrice(it) !== null && (
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
                      {it.moveId !== null && (
                        <button
                          type="button"
                          onClick={() => setTeachingItemId(teachingItemId === it.id ? null : it.id)}
                          className="rounded border px-2 py-1 text-xs"
                        >
                          Teach this Pokémon
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {teachingItemId === it.id && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 border-t pt-2 text-sm">
                    <select
                      value={teachPokemonId}
                      onChange={(e) => setTeachPokemonId(e.target.value)}
                      className="bg-surface-subtle rounded border px-2 py-1"
                    >
                      <option value="">Select a Pokémon…</option>
                      {groupedPokemonOptions.map(([groupName, group]) => (
                        <optgroup key={groupName} label={groupName}>
                          {group.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={!teachPokemonId}
                      onClick={() => handleTeach(it.id)}
                      className="rounded bg-accent px-3 py-1 text-accent-foreground disabled:opacity-50"
                    >
                      Confirm
                    </button>
                    <button type="button" onClick={() => setTeachingItemId(null)} className="rounded border px-2 py-1">
                      Cancel
                    </button>
                  </div>
                )}
                {givingItemId === it.id && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 border-t pt-2 text-sm">
                    <select
                      value={givePokemonId}
                      onChange={(e) => setGivePokemonId(e.target.value)}
                      className="bg-surface-subtle rounded border px-2 py-1"
                    >
                      <option value="">Select a Pokémon…</option>
                      {groupedPokemonOptions.map(([groupName, group]) => (
                        <optgroup key={groupName} label={groupName}>
                          {group.map((p) => (
                            <option key={p.id} value={p.id} disabled={p.hasHeldItem}>
                              {p.name}{p.hasHeldItem ? ' (already holding an item)' : ''}
                            </option>
                          ))}
                        </optgroup>
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
            <div className="flex flex-col gap-1">
              <label htmlFor="catalogSort">Sort by</label>
              <select
                id="catalogSort"
                value={catalogSort}
                onChange={(e) => setCatalogSort(e.target.value as 'name' | 'price-asc' | 'price-desc')}
                className="bg-surface-subtle rounded border px-2 py-1"
              >
                <option value="name">Name</option>
                <option value="price-asc">Price (low-high)</option>
                <option value="price-desc">Price (high-low)</option>
              </select>
            </div>
            <p className="ml-auto text-xs text-muted">{filteredCatalog.length} of {catalog.length}</p>
          </div>
          <ul className="flex max-h-96 flex-col gap-1 overflow-y-auto">
            {filteredCatalog.map((it) => {
              const isTmFamily = it.categoryNames.includes('Technical Machines')
              const catalogPrice = resolveCatalogPrice(it)
              return (
              <li key={it.id} className="flex flex-col gap-1 rounded border px-2 py-1 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate">
                    {it.name}
                    {catalogPrice !== null && <span className="text-muted"> — {catalogPrice} P</span>}
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
                    <button type="button" onClick={() => handleGrant(it)} className="rounded border px-2 py-1 text-xs">
                      Grant
                    </button>
                    {it.buyable && catalogPrice !== null && (
                      <button
                        type="button"
                        disabled={money < catalogPrice * getCatalogQty(it.id)}
                        onClick={() => handleBuy(it)}
                        className="rounded bg-accent px-2 py-1 text-xs text-accent-foreground disabled:opacity-50"
                      >
                        Buy
                      </button>
                    )}
                  </div>
                </div>
                {it.categoryNames.includes('Eggs') && (
                  <div className="mt-1">
                    <SpeciesPicker
                      species={speciesList}
                      name={`egg-species-${it.id}`}
                      label="Species"
                      value={catalogSpecies[it.id] ?? speciesList[0]?.name ?? ''}
                      onChange={(name) => setCatalogSpecies((prev) => ({ ...prev, [it.id]: name }))}
                    />
                  </div>
                )}
                {isTmFamily && (
                  <div className="mt-1 flex flex-col gap-1">
                    <label htmlFor={`tm-move-${it.id}`} className="text-xs text-muted">Move (sets the price above)</label>
                    {eligibleTmMoves().length === 0 ? (
                      <p className="text-xs text-muted">No eligible moves found.</p>
                    ) : (
                      <select
                        id={`tm-move-${it.id}`}
                        value={catalogMove[it.id] ?? eligibleTmMoves()[0]?.name ?? ''}
                        onChange={(e) => setCatalogMove((prev) => ({ ...prev, [it.id]: e.target.value }))}
                        className="bg-surface-subtle rounded border px-2 py-1 text-xs"
                      >
                        {eligibleTmMoves().map((m) => (
                          <option key={m.id} value={m.name}>
                            {m.name}{m.typeName ? ` (${m.typeName})` : ''}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
                {it.description && (
                  <details className="text-xs text-muted">
                    <summary className="cursor-pointer">Details</summary>
                    <p className="mt-1">{it.description}</p>
                  </details>
                )}
              </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
