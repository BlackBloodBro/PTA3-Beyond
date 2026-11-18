'use client'

import { useState } from 'react'
import { setTemporaryPartyMember } from '@/app/(authenticated)/campaigns/[id]/actions'

// [[Improvement - Let a GM temporarily add an NPC to the party]]: GM-only switch on an NPC's sheet. While on, the
// NPC travels with the party: players can see it and its Pokemon, and its Pokemon can be picked in Breeding.
// Same compact section shape as NpcLabelsSection right above it; updates in place, no page reload.
export function TemporaryPartySection({
  campaignId,
  trainerId,
  initialValue,
}: {
  campaignId: string
  trainerId: string
  initialValue: boolean
}) {
  const [value, setValue] = useState(initialValue)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleToggle() {
    setPending(true)
    setError(null)
    const result = await setTemporaryPartyMember(campaignId, trainerId, !value)
    setPending(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setValue(result.isTemporaryPartyMember)
  }

  return (
    <section className="w-full max-w-4xl rounded border-accent bg-accent/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">Travelling with the party</h2>
          <p className="text-sm text-muted">
            {value
              ? 'Yes -- players can see this NPC and its Pokémon, and pick its Pokémon for Breeding.'
              : 'No -- hidden from players, and its Pokémon are not offered for Breeding.'}
          </p>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          disabled={pending}
          aria-pressed={value}
          className="rounded border px-3 py-1 text-sm disabled:opacity-40"
        >
          {pending ? 'Saving…' : value ? 'Remove from party' : 'Add to party'}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </section>
  )
}
