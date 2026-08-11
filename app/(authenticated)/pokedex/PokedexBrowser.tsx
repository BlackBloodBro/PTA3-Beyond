'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { PokemonSprite } from '@/components/PokemonSprite'
import { PaginationControls } from '@/components/PaginationControls'
import { usePagination } from '@/lib/pta3/usePagination'
import type { PokedexBrowseRow, MoveBrowseRow, SkillBrowseRow } from '@/lib/pta3/referenceBrowser'
import type { CatalogItem } from '@/lib/pta3/bag'

type TypeOption = { id: number; name: string }
type HabitatOption = { id: number; name: string }

const DAMAGE_STATS = ['physical', 'special', 'either', 'effect']

// Dropdown multi-select: a button trigger (label + selected count) that opens a checkbox-list panel,
// so a large option set (e.g. 33 habitats) doesn't permanently eat vertical space the way an always-
// expanded checkbox row did. Closes on outside click, same as any standard dropdown.
function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: string[]
  selected: string[]
  onChange: (next: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  function toggle(name: string) {
    onChange(selected.includes(name) ? selected.filter((n) => n !== name) : [...selected, name])
  }

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1">
      <span>{label}</span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`rounded border px-2 py-1 text-left hover:bg-accent/10 ${selected.length > 0 ? 'border-accent bg-accent/10 font-medium text-accent' : 'bg-surface-subtle'}`}
      >
        {selected.length === 0 ? 'Any' : `${selected.length} selected`}
      </button>
      {open && (
        <div className="bg-surface absolute top-full left-0 z-10 mt-1 flex max-h-64 w-48 flex-col gap-1 overflow-y-auto rounded border border-accent p-2 shadow-md">
          {selected.length > 0 && (
            <button type="button" onClick={() => onChange([])} className="mb-1 self-start text-xs text-accent underline">
              Clear
            </button>
          )}
          {options.map((name) => (
            <label key={name} className="flex items-center gap-1 whitespace-nowrap">
              <input type="checkbox" checked={selected.includes(name)} onChange={() => toggle(name)} />
              {name}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

export function PokedexBrowser({
  pokedex,
  moves,
  items,
  skills,
  types,
  habitats,
}: {
  pokedex: PokedexBrowseRow[]
  moves: MoveBrowseRow[]
  items: CatalogItem[]
  skills: SkillBrowseRow[]
  types: TypeOption[]
  habitats: HabitatOption[]
}) {
  const [tab, setTab] = useState<'pokedex' | 'moves' | 'items' | 'skills'>('pokedex')

  return (
    <div className="flex w-full max-w-4xl flex-col gap-6">
      <div className="flex gap-2 border-b">
        {(
          [
            ['pokedex', 'Pokédex'],
            ['moves', 'Moves'],
            ['items', 'Items'],
            ['skills', 'Skills'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-3 py-2 text-sm font-semibold ${tab === key ? 'border-b-2 border-accent text-foreground' : 'text-muted'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'pokedex' && <PokedexTab pokedex={pokedex} types={types} habitats={habitats} />}
      {tab === 'moves' && <MovesTab moves={moves} types={types} />}
      {tab === 'items' && <ItemsTab items={items} />}
      {tab === 'skills' && <SkillsTab skills={skills} />}
    </div>
  )
}

function PokedexTab({ pokedex, types, habitats }: { pokedex: PokedexBrowseRow[]; types: TypeOption[]; habitats: HabitatOption[] }) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string[]>([])
  const [habitatFilter, setHabitatFilter] = useState<string[]>([])

  const filtered = useMemo(
    () =>
      pokedex.filter((p) => {
        if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false
        if (typeFilter.length > 0 && !typeFilter.includes(p.type1Name) && !(p.type2Name && typeFilter.includes(p.type2Name))) return false
        if (habitatFilter.length > 0 && !p.habitatNames.some((h) => habitatFilter.includes(h))) return false
        return true
      }),
    [pokedex, search, typeFilter, habitatFilter],
  )

  const { page, setPage, pageSize, setPageSize, pageItems, totalPages } = usePagination(filtered)

  return (
    <section>
      <div className="mb-2 flex flex-wrap items-end gap-2 text-sm">
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
        <p className="ml-auto text-xs text-muted">{filtered.length} of {pokedex.length}</p>
      </div>
      <ul className="flex max-h-96 flex-col gap-1 overflow-y-auto">
        {pageItems.map((p) => (
          <li key={p.id} className="rounded border px-2 py-1 text-sm">
            <details>
              <summary className="flex cursor-pointer flex-wrap items-center gap-1.5">
                <span className="font-medium">{p.name}</span>
                <span className="rounded bg-surface-muted px-1.5 py-0.5 text-xs">{p.type1Name}</span>
                {p.type2Name && <span className="rounded bg-surface-muted px-1.5 py-0.5 text-xs">{p.type2Name}</span>}
              </summary>
              <div className="mt-2 flex flex-wrap gap-3">
                {p.sprite_code && <PokemonSprite spriteCode={p.sprite_code} alt={p.name} size={64} />}
                <div className="flex-1 text-xs text-muted">
                  <p>
                    HP {p.base_hp} · Atk {p.base_atk} · Def {p.base_def} · Sp.Atk {p.base_sp_atk} · Sp.Def {p.base_sp_def} · Speed {p.base_speed}
                  </p>
                  <p>
                    {p.sizeName ?? '—'} · {p.weightName ?? '—'} · {p.growthRateName ?? '—'} growth
                  </p>
                  {p.catch_rate !== null && <p>Catch rate: {p.catch_rate}</p>}
                  {p.egg_hatch_rate && <p>Egg hatch rate: {p.egg_hatch_rate}</p>}
                  {p.habitatNames.length > 0 && <p>Habitat: {p.habitatNames.join(', ')}</p>}
                  {p.dietNames.length > 0 && <p>Diet: {p.dietNames.join(', ')}</p>}
                  {p.eggGroupNames.length > 0 && <p>Egg groups: {p.eggGroupNames.join(', ')}</p>}
                  {p.proficiencyNames.length > 0 && <p>Proficiencies: {p.proficiencyNames.join(', ')}</p>}
                  {p.description && <p className="mt-1 text-sm text-foreground">{p.description}</p>}
                </div>
              </div>
            </details>
          </li>
        ))}
      </ul>
      <PaginationControls page={page} totalPages={totalPages} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
    </section>
  )
}

function MovesTab({ moves, types }: { moves: MoveBrowseRow[]; types: TypeOption[] }) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [damageStatFilter, setDamageStatFilter] = useState('')
  const [frequencyFilter, setFrequencyFilter] = useState('')
  const [rangeFilter, setRangeFilter] = useState('')

  const frequencyOptions = useMemo(
    () => Array.from(new Set(moves.map((m) => m.frequency).filter((f): f is string => f !== null))).sort(),
    [moves],
  )
  const rangeOptions = useMemo(
    () => Array.from(new Set(moves.map((m) => m.range).filter((r): r is string => r !== null))).sort(),
    [moves],
  )

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

  const { page, setPage, pageSize, setPageSize, pageItems, totalPages } = usePagination(filtered)

  return (
    <section>
      <div className="mb-2 flex flex-wrap items-end gap-2 text-sm">
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
              <option key={t.id} value={t.name}>{t.name}</option>
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
            {DAMAGE_STATS.map((d) => (
              <option key={d} value={d}>{d}</option>
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
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="moveRange">Range</label>
          <select
            id="moveRange"
            value={rangeFilter}
            onChange={(e) => setRangeFilter(e.target.value)}
            className="bg-surface-subtle rounded border px-2 py-1"
          >
            <option value="">Any</option>
            {rangeOptions.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <p className="ml-auto text-xs text-muted">{filtered.length} of {moves.length}</p>
      </div>
      <ul className="flex max-h-96 flex-col gap-1 overflow-y-auto">
        {pageItems.map((m) => (
          <li key={m.id} className="rounded border px-2 py-1 text-sm">
            <details>
              <summary className="flex cursor-pointer flex-wrap items-center gap-1.5">
                <span className="font-medium">{m.name}</span>
                <span className="rounded bg-surface-muted px-1.5 py-0.5 text-xs">{m.typeName}</span>
              </summary>
              <div className="mt-1 text-xs text-muted">
                <p>
                  {m.range ?? '—'} · {m.damage_stat} · {m.frequency ?? '—'}
                </p>
                {m.damage_dice && <p>Damage: {m.damage_dice}</p>}
                {m.description && <p className="mt-1 text-sm text-foreground">{m.description}</p>}
              </div>
            </details>
          </li>
        ))}
      </ul>
      <PaginationControls page={page} totalPages={totalPages} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
    </section>
  )
}

function matchesCatalogFilter(item: CatalogItem, search: string, category: string): boolean {
  if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false
  if (category && !item.categoryNames.includes(category)) return false
  return true
}

function ItemsTab({ items }: { items: CatalogItem[] }) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [sort, setSort] = useState<'name' | 'price-asc' | 'price-desc'>('name')

  const allCategoryNames = useMemo(() => Array.from(new Set(items.flatMap((i) => i.categoryNames))).sort(), [items])

  const filtered = useMemo(() => {
    const matches = items.filter((i) => matchesCatalogFilter(i, search, category))
    if (sort === 'name') return matches
    const sign = sort === 'price-asc' ? 1 : -1
    return [...matches].sort((a, b) => {
      if (a.price === null && b.price === null) return 0
      if (a.price === null) return 1
      if (b.price === null) return -1
      return sign * (a.price - b.price)
    })
  }, [items, search, category, sort])

  const { page, setPage, pageSize, setPageSize, pageItems, totalPages } = usePagination(filtered)

  return (
    <section>
      <div className="mb-2 flex flex-wrap items-end gap-2 text-sm">
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
              <option key={c} value={c}>{c}</option>
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
        <p className="ml-auto text-xs text-muted">{filtered.length} of {items.length}</p>
      </div>
      <ul className="flex max-h-96 flex-col gap-1 overflow-y-auto">
        {pageItems.map((it) => (
          <li key={it.id} className="flex flex-col gap-1 rounded border px-2 py-1 text-sm">
            <span className="truncate">
              {it.name}
              {it.price !== null && <span className="text-muted"> — {it.price} P</span>}
            </span>
            {it.description && (
              <details className="text-xs text-muted">
                <summary className="cursor-pointer">Details</summary>
                <p className="mt-1">{it.description}</p>
              </details>
            )}
          </li>
        ))}
      </ul>
      <PaginationControls page={page} totalPages={totalPages} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
    </section>
  )
}

function SkillsTab({ skills }: { skills: SkillBrowseRow[] }) {
  return (
    <section>
      <ul className="flex flex-col gap-1">
        {skills.map((s) => (
          <li key={s.id} className="rounded border px-2 py-1 text-sm">
            {s.name} — {s.statName ?? '—'}
          </li>
        ))}
      </ul>
    </section>
  )
}
