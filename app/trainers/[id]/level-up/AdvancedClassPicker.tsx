'use client'

import { useState } from 'react'

export function AdvancedClassPicker({
  subclassOptions,
  statOptions,
  typeAceId,
  typeOptions,
  initialChoice = '',
  initialChosenStat = '',
  initialChosenTypeId = '',
}: {
  subclassOptions: { value: string; label: string }[]
  statOptions: { value: string; label: string }[]
  typeAceId: number | null
  typeOptions: { id: number; name: string }[]
  initialChoice?: string
  initialChosenStat?: string
  initialChosenTypeId?: string
}) {
  const [choice, setChoice] = useState(initialChoice)

  return (
    <div className="flex flex-col gap-2">
      <select
        name="subclassChoice"
        className="w-full rounded border p-2"
        required
        value={choice}
        onChange={(e) => setChoice(e.target.value)}
      >
        <option value="" disabled>
          Select an advanced class
        </option>
        {subclassOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {choice === 'stat_ace' && (
        <select name="chosenStat" className="w-full rounded border p-2" required defaultValue={initialChosenStat}>
          <option value="" disabled>
            Select a stat
          </option>
          {statOptions.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      )}

      {typeAceId !== null && choice === String(typeAceId) && (
        <select name="chosenTypeId" className="w-full rounded border p-2" required defaultValue={initialChosenTypeId}>
          <option value="" disabled>
            Select a type
          </option>
          {typeOptions.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}
