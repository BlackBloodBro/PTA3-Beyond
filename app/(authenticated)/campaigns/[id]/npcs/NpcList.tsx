'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { bulkSetTrainerLabel, createLabel } from '@/app/(authenticated)/campaigns/[id]/actions'
import { LABEL_CHIP_CLASSES, LABEL_COLORS, LABEL_SWATCH_CLASSES, type LabelColor } from '@/lib/pta3/labelColors'

type Label = { id: string; name: string; color: LabelColor }
export type Npc = {
  id: string
  name: string
  level: number
  classes: { name: string } | null
  trainer_labels: { campaign_labels: { id: string; name: string; color: LabelColor } | null }[]
}

// Mirrors WildPokemonList's live-filtering shape (search text + label checkboxes, no "Apply
// filters" step, no URL sync -- see [[Improve the search and filter function]]'s Design notes for
// why URL sync was deliberately skipped). Now also mirrors WildPokemonList's bulk label-management
// toolbar ([[Improve label management]]) -- per-row selection checkboxes + a "Manage labels" picker
// that assigns/unassigns one label across every selected row at a time via bulkSetTrainerLabel,
// rather than the single-entity full-replace setTrainerLabels used on the NPC's own detail page.
export function NpcList({
  campaignId,
  initialNpcs,
  initialLabels,
}: {
  campaignId: string
  initialNpcs: Npc[]
  initialLabels: Label[]
}) {
  const [npcs, setNpcs] = useState(initialNpcs)
  const [labels, setLabels] = useState(initialLabels)
  const [searchText, setSearchText] = useState('')
  const [selectedFilterLabelIds, setSelectedFilterLabelIds] = useState<Set<string>>(new Set())
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

  const visibleNpcs = useMemo(() => {
    const needle = searchText.trim().toLowerCase()
    return npcs.filter((n) => {
      if (needle && !n.name.toLowerCase().includes(needle)) return false
      if (selectedFilterLabelIds.size > 0) {
        const npcLabelIds = (n.trainer_labels ?? [])
          .map((tl) => tl.campaign_labels?.id)
          .filter((v): v is string => Boolean(v))
        if (!npcLabelIds.some((id) => selectedFilterLabelIds.has(id))) return false
      }
      return true
    })
  }, [npcs, searchText, selectedFilterLabelIds])

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
    setSelectedIds(new Set(visibleNpcs.map((n) => n.id)))
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

  async function handleBulkLabelToggle(label: Label, add: boolean) {
    setBulkError(null)
    const ids = Array.from(selectedIds)
    const result = await bulkSetTrainerLabel(ids, label.id, add)
    if ('error' in result) {
      setBulkError(result.error)
      return
    }
    setNpcs((prev) =>
      prev.map((n) => {
        if (!selectedIds.has(n.id)) return n
        if (add) {
          if (n.trainer_labels.some((tl) => tl.campaign_labels?.id === label.id)) return n
          return { ...n, trainer_labels: [...n.trainer_labels, { campaign_labels: label }] }
        }
        return { ...n, trainer_labels: n.trainer_labels.filter((tl) => tl.campaign_labels?.id !== label.id) }
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
        <label htmlFor="npc-search" className="font-medium">
          Search by name
        </label>
        <input
          id="npc-search"
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="bg-surface-subtle rounded border px-3 py-2"
        />

        {initialLabels.length > 0 && (
          <>
            <p className="mt-1 font-medium">Labels</p>
            <div className="flex flex-wrap gap-2">
              {initialLabels.map((label) => (
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

        {(searchText || selectedFilterLabelIds.size > 0) && (
          <button
            type="button"
            onClick={() => {
              setSearchText('')
              setSelectedFilterLabelIds(new Set())
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
            <p className="text-xs text-muted">Check a label to add it to all {selectedIds.size} selected NPCs, uncheck to remove it.</p>
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
                    name="npc-list-new-label-color"
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
        {visibleNpcs.length === 0 ? (
          <p className="text-sm text-muted">No NPCs match.</p>
        ) : (
          visibleNpcs.map((n) => (
            <div key={n.id} className="flex items-start gap-2 rounded border-accent bg-accent/10 p-3 hover:bg-accent/20">
              <input
                type="checkbox"
                className="mt-1"
                checked={selectedIds.has(n.id)}
                onChange={() => toggleSelected(n.id)}
              />
              <Link href={`/campaigns/${campaignId}/npcs/${n.id}`} className="flex flex-1 flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{n.name}</span>
                  <span className="text-sm text-muted">
                    Level {n.level} {n.classes?.name}
                  </span>
                </div>
                {(n.trainer_labels ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {(n.trainer_labels ?? []).map(
                      (tl, i) =>
                        tl.campaign_labels && (
                          <span key={i} className={`rounded-full px-2 py-0.5 text-xs ${LABEL_CHIP_CLASSES[tl.campaign_labels.color]}`}>
                            {tl.campaign_labels.name}
                          </span>
                        ),
                    )}
                  </div>
                )}
              </Link>
            </div>
          ))
        )}
      </div>
    </>
  )
}
