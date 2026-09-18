'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'

export type HomebrewItemRow = { id: number; name: string; buyable: boolean; price: number | null; categoryNames: string[] }

// [[Improvement - Add filters to Homebrew catalog overview pages]]: ports the main `/pokedex` browser's
// own ItemsTab filter set (Search + Category + Sort) onto the Homebrew Items page, scoped to a
// Campaign's own (much smaller) item list instead of the global catalog -- no pagination needed here.
export function HomebrewItemsList({ campaignId, items }: { campaignId: string; items: HomebrewItemRow[] }) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [sort, setSort] = useState<'name' | 'price-asc' | 'price-desc'>('name')

  const allCategoryNames = useMemo(() => Array.from(new Set(items.flatMap((i) => i.categoryNames))).sort(), [items])

  const filtered = useMemo(() => {
    const matches = items.filter((i) => {
      if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false
      if (category && !i.categoryNames.includes(category)) return false
      return true
    })
    if (sort === 'name') return matches
    const sign = sort === 'price-asc' ? 1 : -1
    return [...matches].sort((a, b) => {
      if (a.price === null && b.price === null) return 0
      if (a.price === null) return 1
      if (b.price === null) return -1
      return sign * (a.price - b.price)
    })
  }, [items, search, category, sort])

  return (
    <div className="flex w-full max-w-2xl flex-col gap-2">
      <div className="flex flex-wrap items-end gap-2 text-sm">
        <div className="flex flex-col gap-1">
          <label htmlFor="itemSearch">Search</label>
          <input
            id="itemSearch"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-surface-subtle rounded border px-2 py-1"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="itemCategory">Category</label>
          <select id="itemCategory" value={category} onChange={(e) => setCategory(e.target.value)} className="bg-surface-subtle rounded border px-2 py-1">
            <option value="">All</option>
            {allCategoryNames.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="itemSort">Sort by</label>
          <select
            id="itemSort"
            value={sort}
            onChange={(e) => setSort(e.target.value as 'name' | 'price-asc' | 'price-desc')}
            className="bg-surface-subtle rounded border px-2 py-1"
          >
            <option value="name">Name</option>
            <option value="price-asc">Price (low-high)</option>
            <option value="price-desc">Price (high-low)</option>
          </select>
        </div>
        <p className="ml-auto text-xs text-muted">
          {filtered.length} of {items.length}
        </p>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted">No matches.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((it) => (
            <li key={it.id}>
              <Link href={`/campaigns/${campaignId}/custom/items/${it.id}`} className="block rounded border-accent bg-accent/10 p-3 hover:bg-accent/20">
                <span className="font-semibold underline">{it.name}</span>
                <span className="ml-2 text-sm text-muted">
                  {it.buyable ? (it.price !== null ? `${it.price}` : 'Buyable, no price set') : 'Not buyable'}
                  {it.categoryNames.length > 0 ? ` · ${it.categoryNames.join(', ')}` : ''}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
