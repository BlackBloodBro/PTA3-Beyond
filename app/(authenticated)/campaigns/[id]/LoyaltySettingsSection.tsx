'use client'

import { useState, useTransition } from 'react'
import { SettingRow } from './SettingRow'
import { setLoyaltyTierOverride, resetLoyaltyTierOverride } from './loyaltySettingsActions'
import { setGrantEventLoyaltyOverride, resetGrantEventLoyaltyOverride } from './grantEventSettingsActions'
import { updateCampaignLpDisabled } from '../actions'

type TierRow = { id: number; name: string; minPoints: number; defaultMinPoints: number; isOverridden: boolean }
type EventRow = { id: number; name: string; points: number; defaultPoints: number; isOverridden: boolean }

// [[Feature - Allow a GM to change Loyalty settings]]: lets a GM retune, per Campaign, how much LP
// each Loyalty tier needs and how much LP each automated event grants -- an override on top of the
// global defaults, not an edit of them (see the migration/loyaltySettings.ts for why). One row = one
// independent Save/Reset, same "plain function per row" shape as the Pokedex exclusion toggle list.
export function LoyaltySettingsSection({
  campaignId,
  tiers,
  events,
  initialLpDisabled,
}: {
  campaignId: string
  tiers: TierRow[]
  events: EventRow[]
  initialLpDisabled: boolean
}) {
  const [lpDisabled, setLpDisabled] = useState(initialLpDisabled)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleToggle(next: boolean) {
    setError(null)
    startTransition(async () => {
      const result = await updateCampaignLpDisabled(campaignId, next)
      if ('error' in result) {
        setError(result.error)
        return
      }
      setLpDisabled(result.lpDisabled)
    })
  }

  return (
    <div className="flex w-full max-w-2xl flex-col gap-3 rounded border-accent bg-accent/10 p-3">
      <details>
        <summary className="cursor-pointer text-lg font-semibold">Loyalty settings</summary>
        <p className="mb-3 text-sm text-muted">
          Retune how much LP each Loyalty tier needs, and how much LP each automated event grants, for this Campaign only. Set an
          event to 0 to stop it granting LP entirely.
        </p>

        {/* [[Feature - Fully turn off LP]]: turning LP off for a Campaign hides the point-based settings
            below (there's nothing left to retune -- LP itself no longer derives anything), and switches
            every Pokemon's Loyalty section over to a GM-manual tier picker instead of Add/Remove LP.
            [[Improvement - Switch EXP, LP and EV toggle]]: checkbox shows/sets the *enabled* sense (was
            the *disabled* sense) -- a new Campaign has LP off by default, so this checkbox should render
            unchecked for it, not checked. Still writes to the same `lp_disabled` column/action. */}
        <label className="mb-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!lpDisabled} disabled={isPending} onChange={(e) => handleToggle(!e.target.checked)} />
          Turn LP on for this Campaign (while off, the GM sets each Pokémon&apos;s Loyalty tier manually instead)
        </label>
        {error && <p className="mb-3 text-danger">{error}</p>}

        {!lpDisabled && (
          <>
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">Tier thresholds (LP needed)</h3>
              {tiers.map((t) => (
                <SettingRow
                  key={`tier-${t.id}`}
                  label={t.name}
                  value={t.minPoints}
                  defaultValue={t.defaultMinPoints}
                  isOverridden={t.isOverridden}
                  onSave={(v) => setLoyaltyTierOverride(campaignId, t.id, v)}
                  onReset={() => resetLoyaltyTierOverride(campaignId, t.id)}
                />
              ))}
            </div>

            <hr className="my-4 border-accent/30" />

            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">Automated event LP</h3>
              {events.map((e) => (
                <SettingRow
                  key={`event-${e.id}`}
                  label={e.name}
                  value={e.points}
                  defaultValue={e.defaultPoints}
                  isOverridden={e.isOverridden}
                  onSave={(v) => setGrantEventLoyaltyOverride(campaignId, e.id, v)}
                  onReset={() => resetGrantEventLoyaltyOverride(campaignId, e.id)}
                />
              ))}
            </div>
          </>
        )}
      </details>
    </div>
  )
}
