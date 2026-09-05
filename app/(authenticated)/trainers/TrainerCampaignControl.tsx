'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { assignTrainerToCampaign } from '@/app/(authenticated)/campaigns/actions'

type Campaign = { id: string; name: string; isGM: boolean }

// Replaces the old <form action={assignTrainerToCampaign}> -- now a plain function called directly,
// so re-assigning a trainer's campaign from the /trainers list updates this row's "Campaign: X" line
// in place instead of reloading the whole list.
export function TrainerCampaignControl({
  trainerId,
  initialCampaignId,
  initialCampaignName,
  initialIsNpc,
  assignableCampaigns,
}: {
  trainerId: string
  initialCampaignId: string | null
  initialCampaignName: string | null
  initialIsNpc: boolean
  assignableCampaigns: Campaign[]
}) {
  const router = useRouter()
  const [campaignName, setCampaignName] = useState(initialCampaignName)
  const [selected, setSelected] = useState(initialCampaignId ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  // [[Improvement - Adding a Trainer to a GM'd Campaign should default it to an NPC]]: seeded from
  // the Trainer's actual current state, NOT hardcoded true -- otherwise clicking Save without
  // touching the campaign select at all would silently convert an existing player Trainer (e.g. a
  // GM's own PC) into an NPC. Only reset to true (the real "default to NPC") when handleSelect
  // fires, i.e. the GM actually picks a different campaign.
  const [isNpc, setIsNpc] = useState(initialIsNpc)

  const selectedCampaign = assignableCampaigns.find((c) => c.id === selected)

  function handleSelect(value: string) {
    setSelected(value)
    setIsNpc(true)
    setSaved(false)
  }

  async function handleSave() {
    setError(null)
    setSaved(false)
    const result = await assignTrainerToCampaign(trainerId, selected, selectedCampaign?.isGM ? isNpc : undefined)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setCampaignName(result.campaignName)
    setSaved(true)
    // The Trainers page groups rows into "Your Trainers" / "Your NPCs" sections server-side -- a
    // change here that flips is_npc needs a real refetch to move this row into the right section,
    // not just the in-place campaignName update above.
    router.refresh()
  }

  return (
    <div className="mt-1 flex flex-col gap-1">
      <p className="text-sm text-muted">Campaign: {campaignName ?? 'None'}</p>
      {assignableCampaigns.length > 0 && (
        <div className="flex items-center gap-2">
          <select
            value={selected}
            onChange={(e) => handleSelect(e.target.value)}
            className="bg-surface-subtle rounded border p-1 text-sm"
          >
            <option value="">No campaign</option>
            {assignableCampaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={handleSave} className="rounded bg-accent px-3 py-1 text-sm text-accent-foreground">
            Save
          </button>
          {saved && <span className="text-sm text-success">Saved</span>}
        </div>
      )}
      {selectedCampaign?.isGM && (
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={isNpc} onChange={(e) => setIsNpc(e.target.checked)} />
          Make this an NPC
        </label>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  )
}
