'use client'

import { useState } from 'react'
import { advanceTurn } from '../actions'
import { useEncounterLive } from './EncounterLiveProvider'

// [[Improvement - Make Advance turn update in place]]: the GM's "Advance turn". Used to be a plain <form> whose
// action redirected back to the page, re-rendering all of it on the server; now the action just returns the
// new turn position and the live store shows it straight away.
export function AdvanceTurnButton({ encounterId, campaignId }: { encounterId: string; campaignId: string }) {
  const { applyTurnPosition } = useEncounterLive()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setPending(true)
    setError(null)
    const res = await advanceTurn(encounterId, campaignId)
    setPending(false)
    if ('error' in res) {
      setError(res.error)
      return
    }
    applyTurnPosition(res.currentTurnPosition)
  }

  return (
    <div className="flex flex-col gap-1">
      <button type="button" onClick={handleClick} disabled={pending} className="rounded border px-4 py-2 text-sm disabled:opacity-60">
        {pending ? 'Advancing…' : 'Advance turn'}
      </button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}
