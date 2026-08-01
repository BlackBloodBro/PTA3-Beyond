'use client'

import { useState } from 'react'
import { updateCampaign } from '../actions'

// Same inline edit-toggle pattern as Trainer/Pokemon Info sections -- GM-only, calls the server
// action directly (no <form action>, no redirect) so the campaign page updates in place.
export function CampaignInfoSection({
  campaignId,
  isGM,
  initialName,
  initialDescription,
}: {
  campaignId: string
  isGM: boolean
  initialName: string
  initialDescription: string | null
}) {
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription)
  const [isEditing, setIsEditing] = useState(false)
  const [draftName, setDraftName] = useState(initialName)
  const [draftDescription, setDraftDescription] = useState(initialDescription ?? '')
  const [error, setError] = useState<string | null>(null)

  function openEdit() {
    setDraftName(name)
    setDraftDescription(description ?? '')
    setError(null)
    setIsEditing(true)
  }

  async function handleSave() {
    setError(null)
    const result = await updateCampaign(campaignId, { name: draftName, description: draftDescription })
    if ('error' in result) {
      setError(result.error)
      return
    }
    setName(result.name)
    setDescription(result.description)
    setIsEditing(false)
  }

  if (isEditing) {
    return (
      <div className="flex w-full max-w-2xl flex-col gap-3 rounded border border-accent bg-accent/10 p-4 text-sm">
        <div className="flex flex-col gap-1">
          <label htmlFor="campaignName" className="font-semibold">
            Name
          </label>
          <input
            id="campaignName"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            className="bg-surface-subtle rounded border p-2"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="campaignDescription" className="font-semibold">
            Description
          </label>
          <textarea
            id="campaignDescription"
            rows={3}
            value={draftDescription}
            onChange={(e) => setDraftDescription(e.target.value)}
            className="bg-surface-subtle rounded border p-2"
          />
        </div>

        {error && <p className="text-danger">{error}</p>}

        <div className="flex gap-2">
          <button type="button" onClick={handleSave} className="rounded bg-accent px-3 py-1 text-accent-foreground">
            Save
          </button>
          <button type="button" onClick={() => setIsEditing(false)} className="rounded border px-3 py-1">
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-2xl">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{name}</h1>
        {isGM && (
          <button type="button" onClick={openEdit} className="rounded border px-3 py-1 text-sm">
            Edit
          </button>
        )}
      </div>
      {description && <p className="text-muted">{description}</p>}
    </div>
  )
}
