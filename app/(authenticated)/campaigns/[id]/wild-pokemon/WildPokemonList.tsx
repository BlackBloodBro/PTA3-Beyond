'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { assignPokemon } from '@/app/(authenticated)/pokemon/actions'
import { bulkSetPokemonLabel, createLabel } from '@/app/(authenticated)/campaigns/[id]/actions'
import { PokemonSprite } from '@/components/PokemonSprite'
import { LABEL_CHIP_CLASSES, LABEL_COLORS, LABEL_SWATCH_CLASSES, type LabelColor } from '@/lib/pta3/labelColors'
import { pokemonHref } from '@/lib/pta3/pokemonPaths'

type Label = { id: string; name: string; color: LabelColor }
type Trainer = { id: string; name: string; is_npc: boolean }
type PokedexType = { id: number; name: string }
export type WildPokemon = {
  id: string
  nickname: string | null
  is_shiny: boolean
  pokedex: { name: string; sprite_code: string } | null
  level: number
  type1Id: number
  type2Id: number | null
  labelIds: string[]
  // [[Users should be able to add Pokemon to their Trainers in a Campaign]]: identified by the
  // creator's own Trainer in this campaign (matches how this app identifies people everywhere else),
  // null for a pre-existing pool Pokemon created before this field existed, or a creator who's since
  // left the campaign.
  createdBy: string | null
}

// Owns the whole Wild Pokemon list client-side so assigning a Pokemon (it leaves the list) and
// editing/creating labels (shared across every row's picker) never need a page reload -- both
// assignPokemon and the label actions are now plain functions returning results instead of
// <form action> + redirect. Per-row "Edit labels" (details/summary) replaced with a bulk
// select-and-assign toolbar ([[Improve label management]]), matching NpcList's own bulk pattern --
// per-row selection checkboxes + a "Manage labels" picker that assigns/unassigns one label across
// every selected row at a time via bulkSetPokemonLabel, not a per-row full-replace.
export function WildPokemonList({
  campaignId,
  initialPokemon,
  initialLabels,
  trainers,
  types,
}: {
  campaignId: string
  initialPokemon: WildPokemon[]
  initialLabels: Label[]
  trainers: Trainer[]
  types: PokedexType[]
}) {
  const [pokemonList, setPokemonList] = useState(initialPokemon)
  const [labels, setLabels] = useState(initialLabels)
  const [searchText, setSearchText] = useState('')
  const [selectedFilterLabelIds, setSelectedFilterLabelIds] = useState<Set<string>>(new Set())
  const [typeId, setTypeId] = useState('')
  const [levelMin, setLevelMin] = useState('')
  const [levelMax, setLevelMax] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [pickerOpen, setPickerOpen] = useState(false)
  const [bulkError, setBulkError] = useState<string | null>(null)
  const [newLabelName, setNewLabelName] = useState('')
  const [newLabelColor, setNewLabelColor] = useState<LabelColor>('gray')

  function toggleFilterLabel(labelId: string) {
    setSelectedFilterLabelIds((prev) => {
      const next = new Set(prev)
      if (next.has(labelId)) {
        next.delete(labelId)
      } else {
        next.add(labelId)
      }
      return next
    })
  }

  const visiblePokemon = useMemo(() => {
    const needle = searchText.trim().toLowerCase()
    return pokemonList.filter((p) => {
      if (needle) {
        const nickname = p.nickname?.toLowerCase() ?? ''
        const speciesName = p.pokedex?.name?.toLowerCase() ?? ''
        if (!nickname.includes(needle) && !speciesName.includes(needle)) return false
      }
      if (selectedFilterLabelIds.size > 0 && !p.labelIds.some((id) => selectedFilterLabelIds.has(id))) {
        return false
      }
      if (typeId) {
        const id = Number(typeId)
        if (p.type1Id !== id && p.type2Id !== id) return false
      }
      if (levelMin && p.level < Number(levelMin)) return false
      if (levelMax && p.level > Number(levelMax)) return false
      return true
    })
  }, [pokemonList, searchText, selectedFilterLabelIds, typeId, levelMin, levelMax])

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function selectAllVisible() {
    setSelectedIds(new Set(visiblePokemon.map((p) => p.id)))
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

  async function handleBulkLabelToggle(label: Label, add: boolean) {
    setBulkError(null)
    const ids = Array.from(selectedIds)
    const result = await bulkSetPokemonLabel(ids, label.id, add)
    if ('error' in result) {
      setBulkError(result.error)
      return
    }
    setPokemonList((prev) =>
      prev.map((p) => {
        if (!selectedIds.has(p.id)) return p
        if (add) {
          if (p.labelIds.includes(label.id)) return p
          return { ...p, labelIds: [...p.labelIds, label.id] }
        }
        return { ...p, labelIds: p.labelIds.filter((id) => id !== label.id) }
      }),
    )
  }

  async function handleCreateLabel() {
    setBulkError(null)
    if (!newLabelName.trim()) return
    const result = await createLabel(campaignId, newLabelName, newLabelColor)
    if ('error' in result) {
      setBulkError(result.error)
      return
    }
    setLabels((prev) => [...prev, result.label].sort((a, b) => a.name.localeCompare(b.name)))
    setNewLabelName('')
  }

  return (
    <>
      <form onSubmit={(e) => e.preventDefault()} className="flex w-full max-w-2xl flex-col gap-2 rounded border-accent bg-accent/10 p-3 text-sm">
        <label htmlFor="wild-pokemon-search" className="font-medium">
          Search by nickname or species
        </label>
        <input
          id="wild-pokemon-search"
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="bg-surface-subtle rounded border px-3 py-2"
        />

        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="wild-pokemon-type" className="font-medium">
              Type
            </label>
            <select
              id="wild-pokemon-type"
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
            <label htmlFor="wild-pokemon-level-min" className="font-medium">
              Min level
            </label>
            <input
              id="wild-pokemon-level-min"
              type="number"
              min={1}
              value={levelMin}
              onChange={(e) => setLevelMin(e.target.value)}
              className="bg-surface-subtle w-20 rounded border px-2 py-1"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="wild-pokemon-level-max" className="font-medium">
              Max level
            </label>
            <input
              id="wild-pokemon-level-max"
              type="number"
              min={1}
              value={levelMax}
              onChange={(e) => setLevelMax(e.target.value)}
              className="bg-surface-subtle w-20 rounded border px-2 py-1"
            />
          </div>
        </div>

        {labels.length > 0 && (
          <>
            <p className="mt-1 font-medium">Labels</p>
            <div className="flex flex-wrap gap-2">
              {labels.map((label) => (
                <label
                  key={label.id}
                  className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs ${LABEL_CHIP_CLASSES[label.color]}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedFilterLabelIds.has(label.id)}
                    onChange={() => toggleFilterLabel(label.id)}
                  />
                  {label.name}
                </label>
              ))}
            </div>
          </>
        )}

        {(searchText || selectedFilterLabelIds.size > 0 || typeId || levelMin || levelMax) && (
          <button
            type="button"
            onClick={() => {
              setSearchText('')
              setSelectedFilterLabelIds(new Set())
              setTypeId('')
              setLevelMin('')
              setLevelMax('')
            }}
            className="mt-1 w-fit text-xs underline"
          >
            Clear filters
          </button>
        )}

        <div className="mt-1 flex flex-wrap items-center gap-2 border-t pt-2">
          <button type="button" onClick={selectAllVisible} className="text-xs underline">
            Select all visible
          </button>
          {selectedIds.size > 0 && (
            <button type="button" onClick={clearSelection} className="text-xs underline">
              Clear selection
            </button>
          )}
          <span className="text-xs text-muted">{selectedIds.size} selected</span>
          <button
            type="button"
            disabled={selectedIds.size === 0}
            onClick={() => setPickerOpen((o) => !o)}
            className="rounded border-accent bg-accent/20 px-3 py-1 text-xs disabled:opacity-50"
          >
            Manage labels
          </button>
        </div>

        {pickerOpen && selectedIds.size > 0 && (
          <div className="flex flex-col gap-2 rounded border-accent bg-accent/20 p-2">
            <p className="text-xs text-muted">
              Check a label to add it to all {selectedIds.size} selected Pokémon, uncheck to remove it.
            </p>
            <div className="flex flex-wrap gap-2">
              {labels.map((label) => (
                <label key={label.id} className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs ${LABEL_CHIP_CLASSES[label.color]}`}>
                  <input type="checkbox" onChange={(e) => handleBulkLabelToggle(label, e.target.checked)} />
                  {label.name}
                </label>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t pt-2">
              <input
                value={newLabelName}
                onChange={(e) => setNewLabelName(e.target.value)}
                type="text"
                placeholder="New label name"
                className="bg-surface-subtle rounded border px-2 py-1 text-xs"
              />
              {LABEL_COLORS.map((color) => (
                <label key={color} className="flex items-center gap-1">
                  <input
                    type="radio"
                    name="wild-pokemon-new-label-color"
                    checked={newLabelColor === color}
                    onChange={() => setNewLabelColor(color)}
                    className="sr-only peer"
                  />
                  <span className={`h-4 w-4 rounded-full ${LABEL_SWATCH_CLASSES[color]} ring-offset-1 peer-checked:ring-2 peer-checked:ring-black`} />
                </label>
              ))}
              <button type="button" onClick={handleCreateLabel} className="rounded bg-accent px-2 py-1 text-xs text-accent-foreground">
                + Add label
              </button>
            </div>
            {bulkError && <p className="text-xs text-danger">{bulkError}</p>}
          </div>
        )}
      </form>

      <div className="flex w-full max-w-2xl flex-col gap-2">
        {visiblePokemon.length === 0 ? (
          <p className="text-sm text-muted">No wild Pokémon match.</p>
        ) : (
          visiblePokemon.map((p) => (
            <WildPokemonRow
              key={p.id}
              pokemon={p}
              campaignId={campaignId}
              trainers={trainers}
              labels={labels}
              selected={selectedIds.has(p.id)}
              onToggleSelected={() => toggleSelected(p.id)}
              onAssigned={() => setPokemonList((prev) => prev.filter((row) => row.id !== p.id))}
            />
          ))
        )}
      </div>
    </>
  )
}

function WildPokemonRow({
  pokemon,
  campaignId,
  trainers,
  labels,
  selected,
  onToggleSelected,
  onAssigned,
}: {
  pokemon: WildPokemon
  campaignId: string
  trainers: Trainer[]
  labels: Label[]
  selected: boolean
  onToggleSelected: () => void
  onAssigned: () => void
}) {
  const [selectedTrainer, setSelectedTrainer] = useState('')
  const [assignError, setAssignError] = useState<string | null>(null)

  async function handleAssign() {
    setAssignError(null)
    if (!selectedTrainer) return
    const result = await assignPokemon(pokemon.id, selectedTrainer)
    if ('error' in result) {
      setAssignError(result.error)
      return
    }
    onAssigned()
  }

  const currentLabels = labels.filter((l) => pokemon.labelIds.includes(l.id))

  return (
    <div className="flex items-start gap-2 rounded border-accent bg-accent/10 p-3">
      <input type="checkbox" className="mt-1" checked={selected} onChange={onToggleSelected} />
      <div className="flex-1">
        <div className="flex items-center justify-between gap-2">
          <Link href={pokemonHref({ id: pokemon.id, hasOwner: false, campaignId })} className="flex items-center gap-2 underline">
            {pokemon.pokedex && (
              <PokemonSprite spriteCode={pokemon.pokedex.sprite_code} shiny={pokemon.is_shiny} alt={pokemon.pokedex.name} size={32} />
            )}
            <span>
              {pokemon.nickname ? `${pokemon.nickname} (${pokemon.pokedex?.name})` : pokemon.pokedex?.name}
              <span className="ml-2 text-xs text-muted">Level {pokemon.level}</span>
              {pokemon.createdBy && <span className="ml-2 text-xs text-muted">Created by {pokemon.createdBy}</span>}
            </span>
          </Link>
          {trainers.length > 0 && (
            <span className="flex items-center gap-2">
              <select
                value={selectedTrainer}
                onChange={(e) => setSelectedTrainer(e.target.value)}
                className="bg-surface-subtle rounded border p-1 text-sm"
              >
                <option value="" disabled>
                  Assign to...
                </option>
                {trainers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.is_npc ? ' (NPC)' : ''}
                  </option>
                ))}
              </select>
              <button type="button" onClick={handleAssign} className="rounded bg-accent px-3 py-1 text-sm text-accent-foreground">
                Assign
              </button>
            </span>
          )}
        </div>
        {assignError && <p className="mt-1 text-xs text-danger">{assignError}</p>}

        {currentLabels.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {currentLabels.map((l) => (
              <span key={l.id} className={`rounded-full px-2 py-0.5 text-xs ${LABEL_CHIP_CLASSES[l.color]}`}>
                {l.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
