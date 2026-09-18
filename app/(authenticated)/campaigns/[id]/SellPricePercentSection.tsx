'use client'

import { useState } from 'react'
import { updateCampaignSellPricePercent } from '../actions'

// GM-only, inline-edit like CampaignInfoSection -- moved here from a per-Trainer Bag-page control
// (see [[Move selling percentage to Campaign settings]]) since the setting was always Campaign-wide,
// just misleadingly placed on an individual Trainer's page.
export function SellPricePercentSection({ campaignId, initialPercent }: { campaignId: string; initialPercent: number }) {
  const [percent, setPercent] = useState(initialPercent)
  const [draft, setDraft] = useState(initialPercent)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setError(null)
    const result = await updateCampaignSellPricePercent(campaignId, draft)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setPercent(result.sellPricePercent)
    setDraft(result.sellPricePercent)
  }

  return (
    <div className="flex w-full max-w-2xl flex-col gap-3 rounded border-accent bg-accent/10 p-3">
      <details>
        <summary className="cursor-pointer text-lg font-semibold">Sell price settings</summary>
        <p className="mb-3 text-sm text-muted">How much selling an item back gives a Trainer, for this Campaign only.</p>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label htmlFor="sellPercent" className="w-56">
            Sell price
          </label>
          <input
            id="sellPercent"
            type="number"
            min={0}
            max={100}
            value={draft}
            onChange={(e) => setDraft(Math.max(0, Math.min(100, Number(e.target.value))))}
            className="bg-surface-subtle w-20 rounded border p-2 text-center"
          />
          <button type="button" onClick={handleSave} className="rounded border px-3 py-1 text-sm">
            Save
          </button>
          <span className="text-xs text-muted">% of buy price (currently {percent}%)</span>
          {error && <p className="w-full text-danger">{error}</p>}
        </div>
      </details>
    </div>
  )
}
