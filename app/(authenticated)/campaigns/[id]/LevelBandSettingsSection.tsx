'use client'

import { SettingRow } from './SettingRow'
import { setLevelBandOverride, resetLevelBandOverride } from './levelBandSettingsActions'

type LevelBandRow = { band: number; expPerLevel: number; defaultExpPerLevel: number; isOverridden: boolean }

// [[Feature - Let a GM customize EXP needed per level band]]: lets a GM retune, per Campaign, how much
// EXP each 10-level band costs per level-up -- an override on top of the global defaults, same
// mechanism as Loyalty/EXP grant settings. 10 rows (band 1 = levels 1-10, ..., band 10 = levels
// 91-100) instead of the raw 100-row `levels` table -- the full curve is derived from these by formula
// (see lib/pta3/levelBandSettings.ts), so every existing level-lookup consumer needs zero changes.
export function LevelBandSettingsSection({ campaignId, bands }: { campaignId: string; bands: LevelBandRow[] }) {
  return (
    <div className="flex w-full max-w-2xl flex-col gap-3 rounded border-accent bg-accent/10 p-3">
      <details>
        <summary className="cursor-pointer text-lg font-semibold">Level settings</summary>
        <p className="mb-3 text-sm text-muted">
          Retune how much EXP each 10-level band costs per level-up, for this Campaign only. Levels 1-10 use Band 1&apos;s cost,
          11-20 use Band 2&apos;s, and so on.
        </p>

        <div className="flex flex-col gap-2">
          {bands.map((b) => (
            <SettingRow
              key={b.band}
              label={`Band ${b.band} (Lv. ${(b.band - 1) * 10 + 1}-${b.band * 10})`}
              value={b.expPerLevel}
              defaultValue={b.defaultExpPerLevel}
              isOverridden={b.isOverridden}
              onSave={(v) => setLevelBandOverride(campaignId, b.band, v)}
              onReset={() => resetLevelBandOverride(campaignId, b.band)}
            />
          ))}
        </div>
      </details>
    </div>
  )
}
