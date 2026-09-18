'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'

export type HomebrewMoveRow = { id: number; name: string; typeName: string | null; damage_stat: string; frequency: string | null; range: string | null }

// [[Improvement - Add filters to Homebrew catalog overview pages]]: ports the main `/pokedex` browser's
// own MovesTab filter set (Search + Type + Damage Stat + Frequency + Range) onto the Homebrew Moves
// page, scoped to a Campaign's own (much smaller) move list instead of the global catalog -- no
// pagination needed here.
export function HomebrewMovesList({ campaignId, moves, types }: { campaignId: string; moves: HomebrewMoveRow[]; types: { id: number; name: string }[] }) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [damageStatFilter, setDamageStatFilter] = useState('')
  const [frequencyFilter, setFrequencyFilter] = useState('')
  const [rangeFilter, setRangeFilter] = useState('')

  const damageStatOptions = useMemo(() => Array.from(new Set(moves.map((m) => m.damage_stat))).sort(), [moves])
  const frequencyOptions = useMemo(
    () => Array.from(new Set(moves.map((m) => m.frequency).filter((f): f is string => f !== null))).sort(),
    [moves],
  )
  const rangeOptions = useMemo(() => Array.from(new Set(moves.map((m) => m.range).filter((r): r is string => r !== null))).sort(), [moves])

  const filtered = useMemo(
    () =>
      moves.filter((m) => {
        if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false
        if (typeFilter && m.typeName !== typeFilter) return false
        if (damageStatFilter && m.damage_stat !== damageStatFilter) return false
        if (frequencyFilter && m.frequency !== frequencyFilter) return false
        if (rangeFilter && m.range !== rangeFilter) return false
        return true
      }),
    [moves, search, typeFilter, damageStatFilter, frequencyFilter, rangeFilter],
  )

  return (
    <div className="flex w-full max-w-2xl flex-col gap-2">
      <div className="flex flex-wrap items-end gap-2 text-sm">
        <div className="flex flex-col gap-1">
          <label htmlFor="moveSearch">Search</label>
          <input
            id="moveSearch"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-surface-subtle rounded border px-2 py-1"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="moveType">Type</label>
          <select id="moveType" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="bg-surface-subtle rounded border px-2 py-1">
            <option value="">Any</option>
            {types.map((t) => (
              <option key={t.id} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="moveDamageStat">Damage stat</label>
          <select
            id="moveDamageStat"
            value={damageStatFilter}
            onChange={(e) => setDamageStatFilter(e.target.value)}
            className="bg-surface-subtle rounded border px-2 py-1"
          >
            <option value="">Any</option>
            {damageStatOptions.map((s) => (
              <option key={s} value={s}>
                {s.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="moveFrequency">Frequency</label>
          <select
            id="moveFrequency"
            value={frequencyFilter}
            onChange={(e) => setFrequencyFilter(e.target.value)}
            className="bg-surface-subtle rounded border px-2 py-1"
          >
            <option value="">Any</option>
            {frequencyOptions.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="moveRange">Range</label>
          <select id="moveRange" value={rangeFilter} onChange={(e) => setRangeFilter(e.target.value)} className="bg-surface-subtle rounded border px-2 py-1">
            <option value="">Any</option>
            {rangeOptions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <p className="ml-auto text-xs text-muted">
          {filtered.length} of {moves.length}
        </p>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted">No matches.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((m) => (
            <li key={m.id}>
              <Link href={`/campaigns/${campaignId}/custom/moves/${m.id}`} className="block rounded border-accent bg-accent/10 p-3 hover:bg-accent/20">
                <span className="font-semibold underline">{m.name}</span>
                <span className="ml-2 text-sm text-muted">
                  {m.typeName} · {m.damage_stat.replace('_', ' ')}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
