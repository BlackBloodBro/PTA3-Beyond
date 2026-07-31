'use client'

import { useState } from 'react'
import { assignTrainerToCampaign } from '@/app/campaigns/actions'

type Campaign = { id: string; name: string }

// Replaces the old <form action={assignTrainerToCampaign}> -- now a plain function called directly,
// so re-assigning a trainer's campaign from the /trainers list updates this row's "Campaign: X" line
// in place instead of reloading the whole list.
export function TrainerCampaignControl({
  trainerId,
  initialCampaignId,
  initialCampaignName,
  assignableCampaigns,
}: {
  trainerId: string
  initialCampaignId: string | null
  initialCampaignName: string | null
  assignableCampaigns: Campaign[]
}) {
  const [campaignName, setCampaignName] = useState(initialCampaignName)
  const [selected, setSelected] = useState(initialCampaignId ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setError(null)
    setSaved(false)
    const result = await assignTrainerToCampaign(trainerId, selected)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setCampaignName(result.campaignName)
    setSaved(true)
  }

  return (
    <div className="mt-1 flex flex-col gap-1">
      <p className="text-sm text-neutral-500">Campaign: {campaignName ?? 'None'}</p>
      {assignableCampaigns.length > 0 && (
        <div className="flex items-center gap-2">
          <select
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value)
              setSaved(false)
            }}
            className="rounded border p-1 text-sm"
          >
            <option value="">No campaign</option>
            {assignableCampaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={handleSave} className="rounded border px-3 py-1 text-sm">
            Save
          </button>
          {saved && <span className="text-sm text-green-700">Saved</span>}
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
