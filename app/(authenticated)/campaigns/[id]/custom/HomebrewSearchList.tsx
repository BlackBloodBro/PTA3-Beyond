'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'

// [[Improvement - Add filters to Homebrew catalog overview pages]]: shared by every Homebrew catalog
// whose global-browser tab only ever had a name search (Afflictions/Passives/Item Categories/
// Proficiencies/Types), plus Skills (which had no filter at all in the global browser either) --
// same "load everything, filter in memory" pattern as those tabs, just scoped to a Campaign's own
// (much smaller) homebrew list instead of the global catalog, so no pagination is needed here.
export function HomebrewSearchList<T extends { id: number; name: string }>({
  items,
  href,
  renderExtra,
  searchLabel = 'Search',
}: {
  items: T[]
  href: (item: T) => string
  renderExtra?: (item: T) => React.ReactNode
  searchLabel?: string
}) {
  const [search, setSearch] = useState('')
  const filtered = useMemo(() => items.filter((i) => !search || i.name.toLowerCase().includes(search.toLowerCase())), [items, search])

  return (
    <div className="flex w-full max-w-2xl flex-col gap-2">
      <div className="flex flex-wrap items-end gap-2 text-sm">
        <div className="flex flex-col gap-1">
          <label htmlFor="homebrewSearch">{searchLabel}</label>
          <input
            id="homebrewSearch"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-surface-subtle rounded border px-2 py-1"
          />
        </div>
        <p className="ml-auto text-xs text-muted">
          {filtered.length} of {items.length}
        </p>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted">No matches.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((item) => (
            <li key={item.id}>
              <Link href={href(item)} className="block rounded border-accent bg-accent/10 p-3 hover:bg-accent/20">
                <span className="font-semibold underline">{item.name}</span>
                {renderExtra?.(item)}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
