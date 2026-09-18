'use client'

import { useState, useTransition } from 'react'

// Shared by every "one numeric Campaign setting, GM-overridable with a default fallback" section on
// the Customization page (Loyalty settings' tiers/events, EXP grant settings) -- extracted out of
// LoyaltySettingsSection.tsx once a second section needed the identical row shape, rather than
// duplicating it. One row = one independent Save/Reset, same "plain function per row" shape as the
// Pokedex exclusion toggle list.
export function SettingRow({
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
      <label htmlFor={`setting-${label}`} className="w-56">
        {label}
      </label>
      <input
        id={`setting-${label}`}
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
