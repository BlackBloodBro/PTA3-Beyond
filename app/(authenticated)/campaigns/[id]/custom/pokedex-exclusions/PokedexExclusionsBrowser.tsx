'use client'

import { useMemo, useState, useTransition } from 'react'
import { PokemonSprite } from '@/components/PokemonSprite'
import { PaginationControls } from '@/components/PaginationControls'
import { usePagination } from '@/lib/pta3/usePagination'
import { excludeSpecies, includeSpecies } from './actions'

type SpeciesRow = { id: number; name: string; sprite_code: string | null; type_1: { name: string } | null; type_2: { name: string } | null }

// [[Feature - GM can restrict global catalog entries from a Campaign]]: same search+paginate shape as
// PokedexTab (app/(authenticated)/pokedex/PokedexBrowser.tsx) -- ~985 global species is too large for
// a plain checkbox wall, and a GM curating their world naturally works by searching for the handful
// they want to remove rather than scanning the whole list.
export function PokedexExclusionsBrowser({
  campaignId,
  species,
  initialExcludedIds,
}: {
  campaignId: string
  species: SpeciesRow[]
  initialExcludedIds: number[]
}) {
  const [excludedIds, setExcludedIds] = useState<Set<number>>(new Set(initialExcludedIds))
  const [search, setSearch] = useState('')
  const [pendingId, setPendingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const filtered = useMemo(() => species.filter((s) => !search || s.name.toLowerCase().includes(search.toLowerCase())), [species, search])

  const { page, setPage, pageSize, setPageSize, pageItems, totalPages } = usePagination(filtered)

  function toggle(s: SpeciesRow) {
    const isExcluded = excludedIds.has(s.id)
    setError(null)
    setPendingId(s.id)
    startTransition(async () => {
      const result = isExcluded ? await includeSpecies(campaignId, s.id) : await excludeSpecies(campaignId, s.id)
      setPendingId(null)
      if ('error' in result) {
        setError(result.error)
        return
      }
      setExcludedIds((prev) => {
        const next = new Set(prev)
        if (isExcluded) next.delete(s.id)
        else next.add(s.id)
        return next
      })
    })
  }

  return (
    <div className="flex w-full max-w-2xl flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2 text-sm">
        <div className="flex flex-col gap-1">
          <label htmlFor="exclusionSearch">Search</label>
          <input
            id="exclusionSearch"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-surface-subtle rounded border px-2 py-1"
          />
        </div>
        <p className="ml-auto text-xs text-muted">
          {excludedIds.size} excluded of {species.length}
        </p>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <ul className="flex max-h-[32rem] flex-col gap-1 overflow-y-auto">
        {pageItems.map((s) => {
          const isExcluded = excludedIds.has(s.id)
          return (
            <li
              key={s.id}
              className={`flex items-center gap-3 rounded border px-2 py-1.5 text-sm ${isExcluded ? 'border-danger/50 bg-danger/10' : ''}`}
            >
              {s.sprite_code && <PokemonSprite spriteCode={s.sprite_code} alt={s.name} size={32} />}
              <div className="flex-1">
                <span className={`font-medium ${isExcluded ? 'text-muted line-through' : ''}`}>{s.name}</span>
                <span className="ml-2 text-xs text-muted">{[s.type_1?.name, s.type_2?.name].filter(Boolean).join(' / ')}</span>
              </div>
              <button
                type="button"
                onClick={() => toggle(s)}
                disabled={isPending && pendingId === s.id}
                className={`rounded border px-2 py-1 text-xs ${isExcluded ? 'border-accent text-accent' : 'border-danger text-danger'}`}
              >
                {isPending && pendingId === s.id ? '...' : isExcluded ? 'Include' : 'Exclude'}
              </button>
            </li>
          )
        })}
      </ul>

      <PaginationControls page={page} totalPages={totalPages} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
    </div>
  )
}
