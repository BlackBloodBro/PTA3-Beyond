'use client'

import { useState } from 'react'
import { createLabel, setTrainerLabels } from '@/app/(authenticated)/campaigns/[id]/actions'
import { LABEL_CHIP_CLASSES, LABEL_COLORS, LABEL_SWATCH_CLASSES, type LabelColor } from '@/lib/pta3/labelColors'

type Label = { id: string; name: string; color: LabelColor }

// Replaces the old <form action={setTrainerLabels}> + <form action={createLabel}> pair -- both are
// now plain functions called directly, so toggling an NPC's labels or adding a brand new campaign
// label updates this section in place instead of reloading the whole trainer page.
// [[Improve label management]]: collapsed behind an edit-toggle -- same isEditing/openEdit/Cancel
// shape as CampaignInfoSection/TrainerInfoSection -- so this section reads as a compact chip row by
// default instead of a full-height form competing with the rest of the NPC sheet. Kept in place (not
// removed) and still the only per-NPC label editor -- the bulk pattern lives on the NPC overview,
// this stays for single-NPC touch-ups and for creating brand new campaign labels.
export function NpcLabelsSection({
  trainerId,
  campaignId,
  initialLabels,
  initialSelectedLabelIds,
}: {
  trainerId: string
  campaignId: string
  initialLabels: Label[]
  initialSelectedLabelIds: string[]
}) {
  const [labels, setLabels] = useState(initialLabels)
  const [savedLabelIds, setSavedLabelIds] = useState<string[]>(initialSelectedLabelIds)
  const [selectedLabelIds, setSelectedLabelIds] = useState<Set<string>>(new Set(initialSelectedLabelIds))
  const [isEditing, setIsEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newLabelName, setNewLabelName] = useState('')
  const [newLabelColor, setNewLabelColor] = useState<LabelColor>('gray')

  function openEdit() {
    setSelectedLabelIds(new Set(savedLabelIds))
    setError(null)
    setIsEditing(true)
  }

  function toggleLabel(labelId: string) {
    setSelectedLabelIds((prev) => {
      const next = new Set(prev)
      if (next.has(labelId)) {
        next.delete(labelId)
      } else {
        next.add(labelId)
      }
      return next
    })
  }

  async function handleSave() {
    setError(null)
    const result = await setTrainerLabels(trainerId, Array.from(selectedLabelIds))
    if ('error' in result) {
      setError(result.error)
      return
    }
    setSavedLabelIds(result.labelIds)
    setSelectedLabelIds(new Set(result.labelIds))
    setIsEditing(false)
  }

  async function handleCreateLabel() {
    setError(null)
    if (!newLabelName.trim()) return
    const result = await createLabel(campaignId, newLabelName, newLabelColor)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setLabels((prev) => [...prev, result.label].sort((a, b) => a.name.localeCompare(b.name)))
    setNewLabelName('')
  }

  if (!isEditing) {
    const currentLabels = labels.filter((l) => savedLabelIds.includes(l.id))
    return (
      <section className="w-full max-w-4xl rounded border-accent bg-accent/10 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">Labels</h2>
          <button type="button" onClick={openEdit} className="rounded border px-3 py-1 text-sm">
            Edit
          </button>
        </div>
        {currentLabels.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No labels.</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {currentLabels.map((label) => (
              <span key={label.id} className={`rounded-full px-2 py-1 text-xs ${LABEL_CHIP_CLASSES[label.color]}`}>
                {label.name}
              </span>
            ))}
          </div>
        )}
      </section>
    )
  }

  return (
    <section className="w-full max-w-4xl rounded border-accent bg-accent/10 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="font-semibold">Labels</h2>
        <button type="button" onClick={() => setIsEditing(false)} className="rounded border px-3 py-1 text-sm">
          Cancel
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {labels.length === 0 ? (
          <p className="text-sm text-muted">No labels in this campaign yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {labels.map((label) => (
              <label key={label.id} className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs ${LABEL_CHIP_CLASSES[label.color]}`}>
                <input type="checkbox" checked={selectedLabelIds.has(label.id)} onChange={() => toggleLabel(label.id)} />
                {label.name}
              </label>
            ))}
          </div>
        )}
        <button type="button" onClick={handleSave} className="w-fit rounded bg-accent px-3 py-1 text-sm text-accent-foreground">
          Save labels
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
        <input
          value={newLabelName}
          onChange={(e) => setNewLabelName(e.target.value)}
          type="text"
          placeholder="New label name"
          className="bg-surface-subtle rounded border px-2 py-1 text-sm"
        />
        {LABEL_COLORS.map((color) => (
          <label key={color} className="flex items-center gap-1">
            <input
              type="radio"
              name="npc-label-color"
              checked={newLabelColor === color}
              onChange={() => setNewLabelColor(color)}
              className="sr-only peer"
            />
            <span className={`h-4 w-4 rounded-full ${LABEL_SWATCH_CLASSES[color]} ring-offset-1 peer-checked:ring-2 peer-checked:ring-black`} />
          </label>
        ))}
        <button type="button" onClick={handleCreateLabel} className="rounded bg-accent px-3 py-1 text-sm text-accent-foreground">
          + Add label
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </section>
  )
}
