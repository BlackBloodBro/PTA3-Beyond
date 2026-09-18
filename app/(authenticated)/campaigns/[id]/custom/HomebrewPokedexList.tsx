'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { MultiSelectFilter } from '@/components/MultiSelectFilter'

export type HomebrewSpeciesRow = {
  id: number
  name: string
  sprite_code: string | null
  type1Name: string | null
  type2Name: string | null
  habitatNames: string[]
}

// [[Improvement - Add filters to Homebrew catalog overview pages]]: ports the main `/pokedex` browser's
// own PokedexTab filter set (Search + Type + Habitat, both multi-select) onto the Homebrew Pokédex
// page, scoped to a Campaign's own (much smaller) species list instead of the global catalog -- no
// pagination needed here.
export function HomebrewPokedexList({
  campaignId,
  species,
  types,
  habitats,
}: {
  campaignId: string
  species: HomebrewSpeciesRow[]
  types: { id: number; name: string }[]
  habitats: { id: number; name: string }[]
}) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string[]>([])
  const [habitatFilter, setHabitatFilter] = useState<string[]>([])

  const filtered = useMemo(
    () =>
      species.filter((s) => {
        if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false
        if (typeFilter.length > 0 && !typeFilter.includes(s.type1Name ?? '') && !(s.type2Name && typeFilter.includes(s.type2Name))) return false
        if (habitatFilter.length > 0 && !s.habitatNames.some((h) => habitatFilter.includes(h))) return false
        return true
      }),
    [species, search, typeFilter, habitatFilter],
  )

  return (
    <div className="flex w-full max-w-2xl flex-col gap-2">
      <div className="flex flex-wrap items-end gap-2 text-sm">
        <div className="flex flex-col gap-1">
          <label htmlFor="pokedexSearch">Search</label>
          <input
            id="pokedexSearch"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-surface-subtle rounded border px-2 py-1"
          />
        </div>
        <MultiSelectFilter label="Type" options={types.map((t) => t.name)} selected={typeFilter} onChange={setTypeFilter} />
        <MultiSelectFilter label="Habitat" options={habitats.map((h) => h.name)} selected={habitatFilter} onChange={setHabitatFilter} />
        <p className="ml-auto text-xs text-muted">
          {filtered.length} of {species.length}
        </p>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted">No matches.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((s) => (
            <li key={s.id}>
              <Link href={`/campaigns/${campaignId}/custom/pokedex/${s.id}`} className="block rounded border-accent bg-accent/10 p-3 hover:bg-accent/20">
                <span className="font-semibold underline">{s.name}</span>
                <span className="ml-2 text-sm text-muted">{[s.type1Name, s.type2Name].filter(Boolean).join(' / ') || 'No type'}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
