'use client'

import { useState } from 'react'

export function AdvancedClassPicker({
  subclassOptions,
  statOptions,
  typeAceId,
  typeOptions,
  skillTalentOptionsByChoice,
  heldSkillTalents,
  initialChoice = '',
  initialChosenStat = '',
  initialChosenTypeId = '',
  initialTalentSkillId = '',
}: {
  subclassOptions: { value: string; label: string }[]
  statOptions: { value: string; label: string }[]
  typeAceId: number | null
  typeOptions: { id: number; name: string }[]
  // Keyed by the same `subclassChoice` value as subclassOptions -- see loadAdvancedClassOptions.
  skillTalentOptionsByChoice: Record<string, { id: number; name: string }[]>
  // This Trainer's current picked_count per skill (1 = Talented, 2 = Expert/already at cap) across
  // every source so far (Class, Origin, any earlier Advanced Class) -- a skill already at 2 gets
  // excluded from the Skill Talent sub-picker's options rather than offered again.
  heldSkillTalents: Record<number, number>
  initialChoice?: string
  initialChosenStat?: string
  initialChosenTypeId?: string
  initialTalentSkillId?: string
}) {
  const [choice, setChoice] = useState(initialChoice)
  const talentOptions = (skillTalentOptionsByChoice[choice] ?? []).filter((s) => (heldSkillTalents[s.id] ?? 0) < 2)

  return (
    <div className="flex flex-col gap-2">
      <select
        name="subclassChoice"
        className="bg-surface-subtle w-full rounded border p-2"
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
        <select name="chosenStat" className="bg-surface-subtle w-full rounded border p-2" required defaultValue={initialChosenStat}>
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
        <select name="chosenTypeId" className="bg-surface-subtle w-full rounded border p-2" required defaultValue={initialChosenTypeId}>
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

      {choice && talentOptions.length > 0 && (
        <div className="flex flex-col gap-1">
          <label htmlFor="talentSkillId" className="text-sm font-medium">
            Skill Talent (choose 1)
          </label>
          <select
            id="talentSkillId"
            name="talentSkillId"
            className="bg-surface-subtle w-full rounded border p-2"
            required
            defaultValue={initialTalentSkillId}
          >
            <option value="" disabled>
              Select a skill
            </option>
            {talentOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {heldSkillTalents[s.id] === 1 ? ' (upgrades to Expert)' : ''}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}
