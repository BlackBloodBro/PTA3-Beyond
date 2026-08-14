'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { PokemonSprite } from '@/components/PokemonSprite'
import { MAX_TEAM_SIZE } from '@/lib/pta3/pokemonTeam'
import { pokemonHref } from '@/lib/pta3/pokemonPaths'
import { assignToTeam, sendToPC, swapTeamSlot } from './actions'

export type PcPokemon = {
  id: string
  nickname: string | null
  currentHp: number
  maxHp: number
  isShiny: boolean
  spriteCode: string
  speciesName: string
  level: number
  loyaltyName: string | null
  type1Id: number
  type2Id: number | null
  partySlot: number | null
  heldItemName: string | null
  // [[Add Evolution functionality]]: true when this Pokemon's level meets a level-based evolution
  // requirement -- drives the gold card highlight so it's visible while browsing without opening
  // each Pokemon individually.
  evolutionEligible: boolean
}

type SortBy = 'species' | 'level' | 'nickname'
type SortDir = 'asc' | 'desc'

// Matches the Trainer page's hpColorClass boundaries (>50% green, >1/6 and <=50% orange, <=1/6 red)
// -- small enough that duplicating it here (rather than extracting a shared helper for one caller
// each) matches this codebase's existing tolerance for this amount of repetition.
function hpColorClass(current: number, max: number): string {
  if (max <= 0) return 'text-muted'
  const ratio = current / max
  if (ratio > 0.5) return 'text-success'
  if (ratio > 1 / 6) return 'text-warning'
  return 'text-danger'
}

function matchesFilters(p: PcPokemon, searchText: string, typeId: string, levelMin: string, levelMax: string, heldItemOnly: boolean): boolean {
  if (searchText) {
    const needle = searchText.toLowerCase()
    const haystack = `${p.nickname ?? ''} ${p.speciesName}`.toLowerCase()
    if (!haystack.includes(needle)) return false
  }
  if (typeId) {
    const id = Number(typeId)
    if (p.type1Id !== id && p.type2Id !== id) return false
  }
  if (levelMin && p.level < Number(levelMin)) return false
  if (levelMax && p.level > Number(levelMax)) return false
  if (heldItemOnly && p.heldItemName === null) return false
  return true
}

function sortPokemon(list: PcPokemon[], sortBy: SortBy, sortDir: SortDir): PcPokemon[] {
  const sorted = [...list]
  const dir = sortDir === 'asc' ? 1 : -1
  if (sortBy === 'level') {
    sorted.sort((a, b) => (a.level - b.level) * dir)
  } else if (sortBy === 'nickname') {
    sorted.sort((a, b) => (a.nickname ?? a.speciesName).localeCompare(b.nickname ?? b.speciesName) * dir)
  } else {
    sorted.sort((a, b) => a.speciesName.localeCompare(b.speciesName) * dir)
  }
  return sorted
}

export function PcBoard({
  trainerId,
  campaignId,
  canManage,
  initialTeam,
  initialPc,
  types,
}: {
  trainerId: string
  campaignId: string | null
  canManage: boolean
  initialTeam: PcPokemon[]
  initialPc: PcPokemon[]
  types: { id: number; name: string }[]
}) {
  const [team, setTeam] = useState(initialTeam)
  const [pc, setPc] = useState(initialPc)
  const [error, setError] = useState<string | null>(null)

  const [searchText, setSearchText] = useState('')
  const [typeId, setTypeId] = useState('')
  const [levelMin, setLevelMin] = useState('')
  const [levelMax, setLevelMax] = useState('')
  const [sortBy, setSortBy] = useState<SortBy>('species')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [heldItemOnly, setHeldItemOnly] = useState(false)

  // The Pokemon currently mid-"add to Team" while the Team is full -- set when assignToTeam comes
  // back { full: true }, cleared once the bench choice is confirmed (or cancelled).
  const [pendingAdd, setPendingAdd] = useState<PcPokemon | null>(null)

  const filteredPc = useMemo(
    () => sortPokemon(pc.filter((p) => matchesFilters(p, searchText, typeId, levelMin, levelMax, heldItemOnly)), sortBy, sortDir),
    [pc, searchText, typeId, levelMin, levelMax, heldItemOnly, sortBy, sortDir],
  )

  async function handleAddToTeam(pokemon: PcPokemon) {
    setError(null)
    const result = await assignToTeam(trainerId, pokemon.id)
    if ('error' in result) {
      setError(result.error)
      return
    }
    if ('full' in result) {
      setPendingAdd(pokemon)
      return
    }
    setPc((prev) => prev.filter((p) => p.id !== pokemon.id))
    setTeam((prev) => [...prev, { ...pokemon, partySlot: result.slot }].sort((a, b) => (a.partySlot ?? 0) - (b.partySlot ?? 0)))
  }

  async function handleConfirmSwap(benchPokemon: PcPokemon) {
    if (!pendingAdd) return
    setError(null)
    const result = await swapTeamSlot(trainerId, benchPokemon.id, pendingAdd.id)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setTeam((prev) =>
      prev
        .filter((p) => p.id !== benchPokemon.id)
        .concat({ ...pendingAdd, partySlot: result.slot })
        .sort((a, b) => (a.partySlot ?? 0) - (b.partySlot ?? 0)),
    )
    setPc((prev) => prev.filter((p) => p.id !== pendingAdd.id).concat({ ...benchPokemon, partySlot: null }))
    setPendingAdd(null)
  }

  async function handleSendToPC(pokemon: PcPokemon) {
    setError(null)
    const result = await sendToPC(trainerId, pokemon.id)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setTeam((prev) => prev.filter((p) => p.id !== pokemon.id))
    setPc((prev) => [...prev, { ...pokemon, partySlot: null }])
  }

  return (
    <div className="flex w-full max-w-6xl items-start gap-4">
      <div className="flex flex-1 flex-col gap-4">
        {error && <p className="text-danger">{error}</p>}

        <form onSubmit={(e) => e.preventDefault()} className="flex flex-wrap items-end gap-2 rounded border-accent bg-accent/10 p-3 text-sm">
          <div className="flex flex-col gap-1">
            <label htmlFor="pcSearch">Search</label>
            <input
              id="pcSearch"
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Nickname or species"
              className="bg-surface-subtle rounded border px-2 py-1"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="pcType">Type</label>
            <select id="pcType" value={typeId} onChange={(e) => setTypeId(e.target.value)} className="bg-surface-subtle rounded border px-2 py-1">
              <option value="">Any type</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="pcLevelMin">Min level</label>
            <input
              id="pcLevelMin"
              type="number"
              min={1}
              value={levelMin}
              onChange={(e) => setLevelMin(e.target.value)}
              className="bg-surface-subtle w-20 rounded border px-2 py-1"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="pcLevelMax">Max level</label>
            <input
              id="pcLevelMax"
              type="number"
              min={1}
              value={levelMax}
              onChange={(e) => setLevelMax(e.target.value)}
              className="bg-surface-subtle w-20 rounded border px-2 py-1"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="pcSort">Sort by</label>
            <div className="flex gap-1">
              <select
                id="pcSort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className="bg-surface-subtle rounded border px-2 py-1"
              >
                <option value="species">Species</option>
                <option value="level">Level</option>
                <option value="nickname">Nickname</option>
              </select>
              <button
                type="button"
                onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                className="rounded border px-2 py-1"
                aria-label={sortDir === 'asc' ? 'Sort ascending' : 'Sort descending'}
                title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
              >
                {sortDir === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>
          <label htmlFor="pcHeldItemOnly" className="flex items-center gap-1">
            <input
              id="pcHeldItemOnly"
              type="checkbox"
              checked={heldItemOnly}
              onChange={(e) => setHeldItemOnly(e.target.checked)}
            />
            Holding an item
          </label>
          <p className="ml-auto text-xs text-muted">
            {filteredPc.length} of {pc.length} in PC
          </p>
        </form>

        <div className="flex flex-col gap-2">
          {filteredPc.length === 0 ? (
            <p className="text-sm text-muted">No Pokémon match.</p>
          ) : (
            filteredPc.map((p) => (
              <div
                key={p.id}
                className={`flex items-center gap-2 rounded p-2 ${p.evolutionEligible ? 'border-2 border-warning bg-warning/10' : 'border-accent bg-accent/10'}`}
              >
                <PokemonSprite spriteCode={p.spriteCode} shiny={p.isShiny} alt={p.speciesName} size={40} />
                <div className="min-w-0 flex-1 text-sm">
                  <Link href={pokemonHref({ id: p.id, hasOwner: true, campaignId })} className="block truncate font-medium underline">
                    {p.nickname ? `${p.nickname} (${p.speciesName})` : p.speciesName}
                  </Link>
                  <p className="text-xs text-muted">
                    Level {p.level} · Loyalty: {p.loyaltyName ?? '—'}
                  </p>
                  <p className={`font-semibold ${hpColorClass(p.currentHp, p.maxHp)}`}>
                    {p.currentHp} / {p.maxHp} HP
                  </p>
                  {p.heldItemName && (
                    <p className="text-xs text-muted">
                      Holding: {p.heldItemName} —{' '}
                      <Link href={pokemonHref({ id: p.id, hasOwner: true, campaignId })} className="underline">
                        take back
                      </Link>
                    </p>
                  )}
                </div>
                {canManage &&
                  (pendingAdd?.id === p.id ? (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted">Pick who to bench in the Team sidebar →</span>
                      <button type="button" onClick={() => setPendingAdd(null)} className="rounded border px-2 py-1">
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleAddToTeam(p)}
                      className="shrink-0 rounded bg-accent px-3 py-1 text-sm text-accent-foreground"
                    >
                      Add to Team
                    </button>
                  ))}
              </div>
            ))
          )}
        </div>
      </div>

      <aside className="sticky top-4 w-64 shrink-0">
        <section className="rounded border-accent bg-accent/10 p-4">
          <h2 className="mb-2 font-semibold">
            Team ({team.length}/{MAX_TEAM_SIZE})
          </h2>
          {pendingAdd && (
            <p className="mb-2 text-xs text-muted">
              Team is full — pick who to bench to bring in {pendingAdd.nickname ?? pendingAdd.speciesName}.
            </p>
          )}
          {team.length === 0 ? (
            <p className="text-sm text-muted">No Pokémon yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {team.map((p) => (
                <li
                  key={p.id}
                  className={`flex items-center gap-2 rounded p-2 ${p.evolutionEligible ? 'border-2 border-warning bg-warning/10' : 'border'}`}
                >
                  <PokemonSprite spriteCode={p.spriteCode} shiny={p.isShiny} alt={p.speciesName} size={40} />
                  <div className="min-w-0 flex-1 text-sm">
                    <Link href={pokemonHref({ id: p.id, hasOwner: true, campaignId })} className="block truncate font-medium underline">
                      {p.nickname ? `${p.nickname} (${p.speciesName})` : p.speciesName}
                    </Link>
                    <p className="text-xs text-muted">
                      Level {p.level} · Loyalty: {p.loyaltyName ?? '—'}
                    </p>
                    <p className={`font-semibold ${hpColorClass(p.currentHp, p.maxHp)}`}>
                      {p.currentHp} / {p.maxHp} HP
                    </p>
                  </div>
                  {canManage &&
                    (pendingAdd ? (
                      <button
                        type="button"
                        onClick={() => handleConfirmSwap(p)}
                        className="shrink-0 rounded bg-accent px-2 py-1 text-xs text-accent-foreground"
                      >
                        Bench
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSendToPC(p)}
                        className="shrink-0 rounded border px-2 py-1 text-xs"
                      >
                        Send to PC
                      </button>
                    ))}
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>
    </div>
  )
}
