'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { STAT_OPTIONS } from '@/lib/pta3/advancedClassOptions'
import { saveMilestone, type ClassBuilderSnapshot } from '@/app/(authenticated)/trainers/actions'
import type { ClassBuilderCard } from '@/lib/pta3/trainerFeatures'
import { AdvancedClassPicker } from './AdvancedClassPicker'

// Omit `kind` -- it's a discriminant tag on ClassBuilderCard, not a meaningful prop here (the caller
// already knows it's rendering a milestone card by the time it reaches for this component).
type MilestoneCardData = Omit<Extract<ClassBuilderCard, { kind: 'milestone' }>, 'kind'>

// One "Advanced class" trigger card -- renders identically whether it's still pending ("!" badge,
// empty selects) or already resolved (same selects, pre-filled with the current picks, still
// editable). Saves via saveMilestone directly (no <form action>, no full reload), matching the site's
// established no-reload convention -- there is no useActionState/useTransition anywhere in this app.
export function MilestoneCard({
  trainerId,
  name,
  description,
  triggerLevel,
  resolved,
  current,
  options,
  focused,
  onSaved,
}: MilestoneCardData & {
  trainerId: string
  // True when this card's level matches the page's ?level= query param -- forces it open and
  // scrolls it into view on mount, e.g. arriving from the trainer sheet's "Resolve now" banner or an
  // Advanced Class's "Edit" link.
  focused: boolean
  onSaved: (snapshot: ClassBuilderSnapshot) => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const detailsRef = useRef<HTMLDetailsElement>(null)

  // Only run once on mount -- focused is set from the initial ?level= param, not meant to
  // re-trigger a scroll on every re-render.
  useEffect(() => {
    if (focused) {
      detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [focused])

  const initialChoice = current ? (current.chosenStat ? 'stat_ace' : String(current.subclassId)) : ''

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const formData = new FormData(e.currentTarget)
    const result = await saveMilestone(trainerId, triggerLevel, formData)
    setSaving(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    onSaved(result)
  }

  return (
    <details ref={detailsRef} open={!resolved || focused} className="rounded border border-accent bg-accent/10 p-3">
      <summary className="cursor-pointer font-medium">
        {!resolved && (
          <span
            className="bg-danger mr-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs text-white"
            title="Choice required"
          >
            !
          </span>
        )}
        {name} <span className="text-sm font-normal text-muted">Level {triggerLevel}</span>
      </summary>
      <p className="mb-2 mt-1 text-sm text-muted">{description}</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <div className="flex gap-2">
          <select name="statA" className="bg-surface-subtle w-full rounded border p-2" required defaultValue={current?.statA ?? ''}>
            <option value="" disabled>
              Stat 1
            </option>
            {STAT_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <select name="statB" className="bg-surface-subtle w-full rounded border p-2" required defaultValue={current?.statB ?? ''}>
            <option value="" disabled>
              Stat 2
            </option>
            {STAT_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <AdvancedClassPicker
          subclassOptions={options.subclassOptions}
          statOptions={options.statOptions}
          typeAceId={options.typeAceId}
          typeOptions={options.typeOptions}
          skillTalentOptionsByChoice={options.skillTalentOptionsByChoice}
          heldSkillTalents={options.heldSkillTalents}
          initialChoice={initialChoice}
          initialChosenStat={current?.chosenStat ?? ''}
          initialChosenTypeId={current?.chosenTypeId ? String(current.chosenTypeId) : ''}
        />
        {error && <p className="text-danger text-sm">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="self-start rounded bg-accent px-3 py-1 text-sm text-accent-foreground disabled:opacity-50"
        >
          {saving ? 'Saving…' : resolved ? 'Save changes' : 'Confirm'}
        </button>
      </form>
    </details>
  )
}
