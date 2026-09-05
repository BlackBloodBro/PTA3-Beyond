'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { deletePokemon } from '@/app/(authenticated)/pokemon/actions'
import { PokemonSprite } from '@/components/PokemonSprite'
import { ConfirmButton } from '@/components/ConfirmButton'
import { PokemonAssignmentPanel, type Trainer } from './PokemonAssignmentPanel'
import { pokemonHref } from '@/lib/pta3/pokemonPaths'

export type PokemonListRow = {
  id: string
  nickname: string | null
  is_shiny: boolean
  speciesName: string | null
  spriteCode: string | null
  level: number
  type1Id: number | null
  type2Id: number | null
  // [[Add Evolution functionality]]: true when this Pokemon's level meets a level-based evolution
  // requirement -- drives the gold card highlight so it's visible while browsing.
  evolutionEligible: boolean
  trainerId: string | null
  trainerName: string | null
  trainerIsNpc: boolean | null
  trainerCampaignId: string | null
  campaignId: string | null
  // [[Improvement - Add additional filters to Pokemon overview]]: resolved server-side (covers a
  // Trainer's Campaign even when this user isn't its GM, unlike assignableCampaigns) -- null when
  // this Pokemon has no Campaign at all, via either its Trainer or its own pool tag.
  campaignName: string | null
}

// A real campaign id (UUID) never collides with this sentinel, so it's safe as the "No campaign"
// filter option's value.
const NO_CAMPAIGN_VALUE = '__none__'

// [[Improvement - Add additional filters to Pokemon overview]]: a Pokemon's "effective" Campaign is
// its Trainer's Campaign once assigned, otherwise its own pool tag -- same precedence pokemonHref
// already uses for routing.
function effectiveCampaignId(p: PokemonListRow): string | null {
  return p.trainerId !== null ? p.trainerCampaignId : p.campaignId
}

// Same client-side, no-URL-sync filtering approach as PcBoard.tsx -- copied verbatim
// ([[Improve Pokemon overview search]]) so this list's filter behavior matches the PC's.
// [[Improvement - Add additional filters to Pokemon overview]]: search now also matches the owning
// Trainer's name; ownedFilter distinguishes an unassigned pool Pokemon ("Wild") from one assigned to
// a Trainer ("Owned"); campaignFilter matches by id (including the NO_CAMPAIGN_VALUE sentinel).
function matchesFilters(
  p: PokemonListRow,
  searchText: string,
  typeId: string,
  levelMin: string,
  levelMax: string,
  ownedFilter: string,
  campaignFilter: string,
): boolean {
  if (searchText) {
    const needle = searchText.toLowerCase()
    const haystack = `${p.nickname ?? ''} ${p.speciesName ?? ''} ${p.trainerName ?? ''}`.toLowerCase()
    if (!haystack.includes(needle)) return false
  }
  if (typeId) {
    const id = Number(typeId)
    if (p.type1Id !== id && p.type2Id !== id) return false
  }
  if (levelMin && p.level < Number(levelMin)) return false
  if (levelMax && p.level > Number(levelMax)) return false
  if (ownedFilter === 'wild' && p.trainerId !== null) return false
  if (ownedFilter === 'owned' && p.trainerId === null) return false
  const campaignId = effectiveCampaignId(p)
  if (campaignFilter === NO_CAMPAIGN_VALUE) {
    if (campaignId !== null) return false
  } else if (campaignFilter && campaignId !== campaignFilter) {
    return false
  }
  return true
}

export function PokemonListBoard({
  pokemon,
  assignableTrainers,
  assignableCampaigns,
  types,
}: {
  pokemon: PokemonListRow[]
  assignableTrainers: Trainer[]
  assignableCampaigns: { id: string; name: string }[]
  types: { id: number; name: string }[]
}) {
  const [searchText, setSearchText] = useState('')
  const [typeId, setTypeId] = useState('')
  const [levelMin, setLevelMin] = useState('')
  const [levelMax, setLevelMax] = useState('')
  const [ownedFilter, setOwnedFilter] = useState('')
  const [campaignFilter, setCampaignFilter] = useState('')

  const typeNameById = useMemo(() => new Map(types.map((t) => [t.id, t.name])), [types])

  // Options built from what's actually present among these Pokemon, not a full Campaigns fetch --
  // only values that could ever actually match something are offered.
  const campaignOptions = useMemo(() => {
    const byId = new Map<string, string>()
    for (const p of pokemon) {
      const id = effectiveCampaignId(p)
      if (id && p.campaignName) byId.set(id, p.campaignName)
    }
    return Array.from(byId, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [pokemon])

  const filtered = useMemo(
    () => pokemon.filter((p) => matchesFilters(p, searchText, typeId, levelMin, levelMax, ownedFilter, campaignFilter)),
    [pokemon, searchText, typeId, levelMin, levelMax, ownedFilter, campaignFilter],
  )

  return (
    <div className="flex w-full max-w-2xl flex-col gap-2">
      {pokemon.length > 0 && (
        <div className="flex flex-wrap items-end gap-2 text-sm">
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor="pokemonSearch">Search</label>
            <input
              id="pokemonSearch"
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Nickname, species, or trainer"
              className="bg-surface-subtle rounded border px-2 py-1"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="pokemonOwned">Owned</label>
            <select
              id="pokemonOwned"
              value={ownedFilter}
              onChange={(e) => setOwnedFilter(e.target.value)}
              className="bg-surface-subtle rounded border px-2 py-1"
            >
              <option value="">Any</option>
              <option value="owned">Owned</option>
              <option value="wild">Wild</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="pokemonCampaign">Campaign</label>
            <select
              id="pokemonCampaign"
              value={campaignFilter}
              onChange={(e) => setCampaignFilter(e.target.value)}
              className="bg-surface-subtle rounded border px-2 py-1"
            >
              <option value="">Any campaign</option>
              <option value={NO_CAMPAIGN_VALUE}>No campaign</option>
              {campaignOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="pokemonType">Type</label>
            <select
              id="pokemonType"
              value={typeId}
              onChange={(e) => setTypeId(e.target.value)}
              className="bg-surface-subtle rounded border px-2 py-1"
            >
              <option value="">Any type</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="pokemonLevelMin">Min level</label>
            <input
              id="pokemonLevelMin"
              type="number"
              min={1}
              value={levelMin}
              onChange={(e) => setLevelMin(e.target.value)}
              className="bg-surface-subtle w-20 rounded border px-2 py-1"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="pokemonLevelMax">Max level</label>
            <input
              id="pokemonLevelMax"
              type="number"
              min={1}
              value={levelMax}
              onChange={(e) => setLevelMax(e.target.value)}
              className="bg-surface-subtle w-20 rounded border px-2 py-1"
            />
          </div>
          <p className="ml-auto text-xs text-muted">{filtered.length} of {pokemon.length}</p>
        </div>
      )}

      {pokemon.length === 0 ? (
        <p className="text-sm text-muted">You don&apos;t have any Pokémon yet.</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted">No Pokémon match.</p>
      ) : (
        filtered.map((p) => (
          <div
            key={p.id}
            className={`flex flex-col gap-2 rounded p-3 ${p.evolutionEligible ? 'border-2 border-warning bg-warning/10' : 'border-accent bg-accent/10'}`}
          >
            <div className="flex items-center justify-between gap-2">
              <Link
                href={pokemonHref({
                  id: p.id,
                  hasOwner: p.trainerId !== null,
                  campaignId: p.trainerId !== null ? p.trainerCampaignId : p.campaignId,
                })}
                className="flex items-center gap-2 underline"
              >
                {p.spriteCode && <PokemonSprite spriteCode={p.spriteCode} shiny={p.is_shiny} alt={p.speciesName ?? ''} size={32} />}
                {p.nickname ? `${p.nickname} (${p.speciesName})` : p.speciesName}
                <span className="text-xs text-muted">Level {p.level}</span>
              </Link>
              <form action={deletePokemon.bind(null, p.id)}>
                <ConfirmButton
                  confirmMessage={`Permanently delete ${p.nickname ? `${p.nickname} (${p.speciesName})` : p.speciesName}? This cannot be undone.`}
                  className="rounded border border-danger px-3 py-1 text-xs text-danger"
                >
                  Delete
                </ConfirmButton>
              </form>
            </div>

            {/* [[Improvement - Add additional filters to Pokemon overview]]: Type badge(s) (same
                small-pill style used elsewhere, e.g. PokemonInteractive.tsx's move-type badges) and
                Campaign name, when this Pokemon actually has one. */}
            {(p.type1Id !== null || p.campaignName) && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                {p.type1Id !== null && (
                  <span className="rounded bg-surface-muted px-1.5 py-0.5">{typeNameById.get(p.type1Id) ?? p.type1Id}</span>
                )}
                {p.type2Id !== null && (
                  <span className="rounded bg-surface-muted px-1.5 py-0.5">{typeNameById.get(p.type2Id) ?? p.type2Id}</span>
                )}
                {p.campaignName && <span className="text-muted">{p.campaignName}</span>}
              </div>
            )}

            <PokemonAssignmentPanel
              pokemonId={p.id}
              initialTrainerId={p.trainerId}
              initialTrainerName={p.trainerName}
              initialTrainerIsNpc={p.trainerIsNpc}
              initialTrainerCampaignId={p.trainerCampaignId}
              initialCampaignId={p.campaignId}
              assignableTrainers={assignableTrainers}
              assignableCampaigns={assignableCampaigns}
            />
          </div>
        ))
      )}
    </div>
  )
}
