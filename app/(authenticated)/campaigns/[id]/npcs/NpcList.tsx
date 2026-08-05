'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { LABEL_CHIP_CLASSES, type LabelColor } from '@/lib/pta3/labelColors'

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
// why URL sync was deliberately skipped). Simpler than WildPokemonList since NPC rows have no
// per-row actions here (assign/label-edit live on the NPC's own page), so this stays one component
// instead of needing a separate Row.
export function NpcList({
  campaignId,
  initialNpcs,
  initialLabels,
}: {
  campaignId: string
  initialNpcs: Npc[]
  initialLabels: Label[]
}) {
  const [searchText, setSearchText] = useState('')
  const [selectedFilterLabelIds, setSelectedFilterLabelIds] = useState<Set<string>>(new Set())

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
    return initialNpcs.filter((n) => {
      if (needle && !n.name.toLowerCase().includes(needle)) return false
      if (selectedFilterLabelIds.size > 0) {
        const npcLabelIds = (n.trainer_labels ?? [])
          .map((tl) => tl.campaign_labels?.id)
          .filter((v): v is string => Boolean(v))
        if (!npcLabelIds.some((id) => selectedFilterLabelIds.has(id))) return false
      }
      return true
    })
  }, [initialNpcs, searchText, selectedFilterLabelIds])

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
      </form>

      <div className="flex w-full max-w-2xl flex-col gap-2">
        {visibleNpcs.length === 0 ? (
          <p className="text-sm text-muted">No NPCs match.</p>
        ) : (
          visibleNpcs.map((n) => (
            <Link
              key={n.id}
              href={`/campaigns/${campaignId}/npcs/${n.id}`}
              className="flex flex-col gap-1 rounded border-accent bg-accent/10 p-3 hover:bg-accent/20"
            >
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
          ))
        )}
      </div>
    </>
  )
}
