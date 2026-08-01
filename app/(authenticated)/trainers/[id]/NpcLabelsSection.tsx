'use client'

import { useState } from 'react'
import { createLabel, setTrainerLabels } from '@/app/(authenticated)/campaigns/[id]/actions'
import { LABEL_CHIP_CLASSES, LABEL_COLORS, LABEL_SWATCH_CLASSES, type LabelColor } from '@/lib/pta3/labelColors'

type Label = { id: string; name: string; color: LabelColor }

// Replaces the old <form action={setTrainerLabels}> + <form action={createLabel}> pair -- both are
// now plain functions called directly, so toggling an NPC's labels or adding a brand new campaign
// label updates this section in place instead of reloading the whole trainer page.
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
  const [selectedLabelIds, setSelectedLabelIds] = useState<Set<string>>(new Set(initialSelectedLabelIds))
  const [error, setError] = useState<string | null>(null)
  const [newLabelName, setNewLabelName] = useState('')
  const [newLabelColor, setNewLabelColor] = useState<LabelColor>('gray')

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
    setSelectedLabelIds(new Set(result.labelIds))
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

  return (
    <section className="w-full max-w-4xl rounded border p-4">
      <h2 className="mb-2 font-semibold">Labels</h2>
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
        <button type="button" onClick={handleSave} className="w-fit rounded border px-3 py-1 text-sm">
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
        <button type="button" onClick={handleCreateLabel} className="rounded border px-3 py-1 text-sm">
          + Add label
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </section>
  )
}
