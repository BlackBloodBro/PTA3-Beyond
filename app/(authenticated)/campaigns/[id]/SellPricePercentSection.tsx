'use client'

import { useState, useTransition } from 'react'
import { updateCampaignSellPricePercent, updateCampaignEvDisabled } from '../actions'
import { SettingRow } from './SettingRow'
import { setShinyRateOverride, resetShinyRateOverride } from './shinyRateSettingsActions'

type ShinyRate = { denominator: number; defaultDenominator: number; isOverridden: boolean }

// GM-only, inline-edit like CampaignInfoSection -- moved here from a per-Trainer Bag-page control
// (see [[Move selling percentage to Campaign settings]]) since the setting was always Campaign-wide,
// just misleadingly placed on an individual Trainer's page. Renamed from "Sell price settings" to
// "Other settings" once Shiny rate ([[Feature - Let a GM customize their Campaign's shiny rate]]) joined
// it -- both are single, unrelated-to-EXP/Loyalty GM knobs, so one small card covers both rather than
// each getting its own section. [[Feature - Fully turn off EV's]] added a third, divider-separated row --
// EVs had no existing "settings" section at all (they were never previously customizable), so a whole new
// section for one checkbox wasn't worth it.
export function SellPricePercentSection({
  campaignId,
  initialPercent,
  shinyRate,
  initialEvDisabled,
}: {
  campaignId: string
  initialPercent: number
  shinyRate: ShinyRate
  initialEvDisabled: boolean
}) {
  const [percent, setPercent] = useState(initialPercent)
  const [draft, setDraft] = useState(initialPercent)
  const [error, setError] = useState<string | null>(null)
  const [evDisabled, setEvDisabled] = useState(initialEvDisabled)
  const [isPending, startTransition] = useTransition()
  const [evError, setEvError] = useState<string | null>(null)

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

  function handleEvToggle(next: boolean) {
    setEvError(null)
    startTransition(async () => {
      const result = await updateCampaignEvDisabled(campaignId, next)
      if ('error' in result) {
        setEvError(result.error)
        return
      }
      setEvDisabled(result.evDisabled)
    })
  }

  return (
    <div className="flex w-full max-w-2xl flex-col gap-3 rounded border-accent bg-accent/10 p-3">
      <details>
        <summary className="cursor-pointer text-lg font-semibold">Other settings</summary>

        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted">How much selling an item back gives a Trainer, for this Campaign only.</p>
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
        </div>

        <hr className="my-4 border-accent/30" />

        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted">
            How often a newly created Pokémon is Shiny when its Shininess is set to "Random", for this Campaign only. A
            denominator of 250 means a 1-in-250 chance.
          </p>
          <SettingRow
            label="Shiny rate (1 in N)"
            value={shinyRate.denominator}
            defaultValue={shinyRate.defaultDenominator}
            isOverridden={shinyRate.isOverridden}
            onSave={(v) => setShinyRateOverride(campaignId, v)}
            onReset={() => resetShinyRateOverride(campaignId)}
          />
        </div>

        <hr className="my-4 border-accent/30" />

        {/* [[Feature - Fully turn off EV's]]: EVs already assigned stay stored (nothing lost), but stop
            contributing to stat totals while off, and the Assign/Edit EV controls hide on the Pokemon page.
            [[Improvement - Switch EXP, LP and EV toggle]]: checkbox shows/sets the *enabled* sense (was
            the *disabled* sense) -- a new Campaign has EVs off by default, so this checkbox should render
            unchecked for it, not checked. Still writes to the same `ev_disabled` column/action. */}
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!evDisabled} disabled={isPending} onChange={(e) => handleEvToggle(!e.target.checked)} />
            Turn EVs on for this Campaign
          </label>
          {evError && <p className="text-danger">{evError}</p>}
        </div>
      </details>
    </div>
  )
}
