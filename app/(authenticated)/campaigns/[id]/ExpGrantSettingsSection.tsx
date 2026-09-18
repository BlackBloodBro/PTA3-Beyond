'use client'

import { SettingRow } from './SettingRow'
import { setExpGrantOverride, resetExpGrantOverride } from './expGrantSettingsActions'

type ExpGrantRow = { id: number; name: string; exp: number; defaultExp: number; isOverridden: boolean }

// [[Feature - Add triggers for a Pokemon to gain EXP automatically]]: lets a GM retune, per Campaign,
// how much EXP each automated trigger grants -- an override on top of the global defaults, same
// mechanism as LoyaltySettingsSection's own event rows (extracted into the shared SettingRow once this
// section needed the identical shape). One row today (Move used); more automated triggers will add
// more rows here without any UI change, per the underlying table's own extensible design.
export function ExpGrantSettingsSection({ campaignId, events }: { campaignId: string; events: ExpGrantRow[] }) {
  return (
    <div className="flex w-full max-w-2xl flex-col gap-3 rounded border-accent bg-accent/10 p-3">
      <details>
        <summary className="cursor-pointer text-lg font-semibold">EXP grant settings</summary>
        <p className="mb-3 text-sm text-muted">
          Retune how much EXP each automated trigger grants, for this Campaign only. Set a trigger to 0 to stop it granting EXP
          entirely.
        </p>

        <div className="flex flex-col gap-2">
          {events.map((e) => (
            <SettingRow
              key={e.id}
              label={e.name}
              value={e.exp}
              defaultValue={e.defaultExp}
              isOverridden={e.isOverridden}
              onSave={(v) => setExpGrantOverride(campaignId, e.id, v)}
              onReset={() => resetExpGrantOverride(campaignId, e.id)}
            />
          ))}
        </div>
      </details>
    </div>
  )
}
