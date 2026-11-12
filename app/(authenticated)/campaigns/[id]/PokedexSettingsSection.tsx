'use client'

import { useState, useTransition } from 'react'
import { updateCampaignPokedexDiscoveryOnly } from '../actions'

// [[Feature - Only show Pokemon a Trainer has encountered in the Pokedex]]: the GM's switch for a "discovery" Pokedex,
// same shape as the EXP / LP / EV switches on this page. Off by default so existing Campaigns keep their full Pokedex
// until the GM opts in.
export function PokedexSettingsSection({ campaignId, initialDiscoveryOnly }: { campaignId: string; initialDiscoveryOnly: boolean }) {
  const [discoveryOnly, setDiscoveryOnly] = useState(initialDiscoveryOnly)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleToggle(next: boolean) {
    setError(null)
    startTransition(async () => {
      const result = await updateCampaignPokedexDiscoveryOnly(campaignId, next)
      if ('error' in result) {
        setError(result.error)
        return
      }
      setDiscoveryOnly(result.discoveryOnly)
    })
  }

  return (
    <div className="flex w-full max-w-2xl flex-col gap-3 rounded border-accent bg-accent/10 p-3">
      <details>
        <summary className="cursor-pointer text-lg font-semibold">Pokédex settings</summary>
        <p className="mb-3 text-sm text-muted">
          By default the Pokédex lists every species. Turn this on to make it a &quot;discovery&quot; Pokédex: a player only sees species
          the party has scanned in an Encounter, or that one of their own Trainers owns. You always see everything, and so does anyone
          with a Researcher&apos;s Walking encyclopedia.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={discoveryOnly} disabled={isPending} onChange={(e) => handleToggle(e.target.checked)} />
          Only show discovered species in the Pokédex
        </label>
        {error && <p className="mt-2 text-danger">{error}</p>}
      </details>
    </div>
  )
}
