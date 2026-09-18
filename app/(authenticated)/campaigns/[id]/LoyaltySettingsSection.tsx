'use client'

import { SettingRow } from './SettingRow'
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

        <div className="mt-4 flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Automated event LP</h3>
          {events.map((e) => (
            <SettingRow
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
