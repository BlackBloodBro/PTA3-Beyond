'use client'

import { useState, useTransition } from 'react'
import { SettingRow } from './SettingRow'
import { setLevelBandOverride, resetLevelBandOverride } from './levelBandSettingsActions'
import { setGrantEventExpOverride, resetGrantEventExpOverride } from './grantEventSettingsActions'
import { updateCampaignExpDisabled } from '../actions'

type LevelBandRow = { band: number; expPerLevel: number; defaultExpPerLevel: number; isOverridden: boolean }
type ExpGrantRow = { id: number; name: string; exp: number; defaultExp: number; isOverridden: boolean }

// [[Feature - Let a GM customize EXP needed per level band]] + [[Feature - Add triggers for a Pokemon
// to gain EXP automatically]]: one combined "EXP settings" section, same shape as
// LoyaltySettingsSection (thresholds first, then automated grants) -- these were two separate sections
// until the user asked for them to be merged and laid out to match Loyalty settings exactly.
export function ExpSettingsSection({
  campaignId,
  bands,
  events,
  initialExpDisabled,
}: {
  campaignId: string
  bands: LevelBandRow[]
  events: ExpGrantRow[]
  initialExpDisabled: boolean
}) {
  const [expDisabled, setExpDisabled] = useState(initialExpDisabled)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleToggle(next: boolean) {
    setError(null)
    startTransition(async () => {
      const result = await updateCampaignExpDisabled(campaignId, next)
      if ('error' in result) {
        setError(result.error)
        return
      }
      setExpDisabled(result.expDisabled)
    })
  }

  return (
    <div className="flex w-full max-w-2xl flex-col gap-3 rounded border-accent bg-accent/10 p-3">
      <details>
        <summary className="cursor-pointer text-lg font-semibold">EXP settings</summary>
        <p className="mb-3 text-sm text-muted">
          Retune how much EXP each 10-level band needs per level-up, and how much EXP each automated trigger grants, for this
          Campaign only. Set a trigger to 0 to stop it granting EXP entirely.
        </p>

        {/* [[Feature - Fully turn off EXP]]: turning EXP off also turns off Level as a concept -- there's
            nothing left to retune below, and Pokemon instead learn from a per-species list of Moves
            curated as learnable without a Level (set on each species' own Homebrew/GM Custom page, or
            the global catalog's own curated list). */}
        <label className="mb-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={expDisabled} disabled={isPending} onChange={(e) => handleToggle(e.target.checked)} />
          Turn EXP off for this Campaign (Pokémon learn from a curated Move list instead of by Level)
        </label>
        {error && <p className="mb-3 text-danger">{error}</p>}

        {!expDisabled && (
          <>
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">Level thresholds (EXP needed)</h3>
              {bands.map((b) => (
                <SettingRow
                  key={`band-${b.band}`}
                  label={`Band ${b.band} (Lv. ${(b.band - 1) * 10 + 1}-${b.band * 10})`}
                  value={b.expPerLevel}
                  defaultValue={b.defaultExpPerLevel}
                  isOverridden={b.isOverridden}
                  onSave={(v) => setLevelBandOverride(campaignId, b.band, v)}
                  onReset={() => resetLevelBandOverride(campaignId, b.band)}
                />
              ))}
            </div>

            <hr className="my-4 border-accent/30" />

            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">Automated event EXP</h3>
              {events.map((e) => (
                <SettingRow
                  key={`event-${e.id}`}
                  label={e.name}
                  value={e.exp}
                  defaultValue={e.defaultExp}
                  isOverridden={e.isOverridden}
                  onSave={(v) => setGrantEventExpOverride(campaignId, e.id, v)}
                  onReset={() => resetGrantEventExpOverride(campaignId, e.id)}
                />
              ))}
            </div>
          </>
        )}
      </details>
    </div>
  )
}
