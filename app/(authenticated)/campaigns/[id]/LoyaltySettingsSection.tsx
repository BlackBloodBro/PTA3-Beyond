'use client'

import { useState, useTransition } from 'react'
import { setLoyaltyTierOverride, resetLoyaltyTierOverride, setLoyaltyEventOverride, resetLoyaltyEventOverride } from './loyaltySettingsActions'

type TierRow = { id: number; name: string; minPoints: number; defaultMinPoints: number; isOverridden: boolean }
type EventRow = { id: number; name: string; points: number; defaultPoints: number; isOverridden: boolean }

// [[Feature - Allow a GM to change Loyalty settings]]: lets a GM retune, per Campaign, how much LP
// each Loyalty tier needs and how much LP each automated event grants -- an override on top of the
// global defaults, not an edit of them (see the migration/loyaltySettings.ts for why). One row = one
// independent Save/Reset, same "plain function per row" shape as the Pokedex exclusion toggle list.
export function LoyaltySettingsSection({ campaignId, tiers, events }: { campaignId: string; tiers: TierRow[]; events: EventRow[] }) {
  return (
    <div className="flex w-full max-w-2xl flex-col gap-3 rounded border-accent bg-accent/10 p-3">
      <details>
        <summary className="cursor-pointer text-lg font-semibold">Loyalty settings</summary>
        <p className="mb-3 text-sm text-muted">
          Retune how much LP each Loyalty tier needs, and how much LP each automated event grants, for this Campaign only. Set an
          event to 0 to stop it granting LP entirely.
        </p>

        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Tier thresholds (LP needed)</h3>
          {tiers.map((t) => (
            <LoyaltyRow
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

        <div className="mt-4 flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Automated event LP</h3>
          {events.map((e) => (
            <LoyaltyRow
              key={`event-${e.id}`}
              label={e.name}
              value={e.points}
              defaultValue={e.defaultPoints}
              isOverridden={e.isOverridden}
              onSave={(v) => setLoyaltyEventOverride(campaignId, e.id, v)}
              onReset={() => resetLoyaltyEventOverride(campaignId, e.id)}
            />
          ))}
        </div>
      </details>
    </div>
  )
}

function LoyaltyRow({
  label,
  value,
  defaultValue,
  isOverridden,
  onSave,
  onReset,
}: {
  label: string
  value: number
  defaultValue: number
  isOverridden: boolean
  onSave: (value: number) => Promise<{ error: string } | { success: true }>
  onReset: () => Promise<{ error: string } | { success: true }>
}) {
  const [draft, setDraft] = useState(value)
  const [overridden, setOverridden] = useState(isOverridden)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const result = await onSave(draft)
      if ('error' in result) {
        setError(result.error)
        return
      }
      setOverridden(true)
    })
  }

  function handleReset() {
    setError(null)
    startTransition(async () => {
      const result = await onReset()
      if ('error' in result) {
        setError(result.error)
        return
      }
      setDraft(defaultValue)
      setOverridden(false)
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <label htmlFor={`loyalty-${label}`} className="w-56">
        {label}
      </label>
      <input
        id={`loyalty-${label}`}
        type="number"
        value={draft}
        onChange={(e) => setDraft(Number(e.target.value))}
        className="bg-surface-subtle w-20 rounded border p-2 text-center"
      />
      <button type="button" onClick={handleSave} disabled={isPending} className="rounded border px-3 py-1 text-sm">
        Save
      </button>
      {overridden ? (
        <button type="button" onClick={handleReset} disabled={isPending} className="text-xs text-accent underline">
          Reset to default ({defaultValue})
        </button>
      ) : (
        <span className="text-xs text-muted">Default</span>
      )}
      {error && <p className="w-full text-danger">{error}</p>}
    </div>
  )
}
