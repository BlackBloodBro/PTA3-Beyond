'use client'

import Link from 'next/link'
import { useState } from 'react'
import { assignPokemon, assignPokemonToCampaign, unassignPokemon } from './actions'

export type Trainer = { id: string; name: string; is_npc: boolean; campaignName: string | null }
type Campaign = { id: string; name: string }

// Groups the trainer <select> with native <optgroup>s (campaign-less trainers first, then one group
// per campaign, alphabetically) -- the assignable list spans every trainer you own plus every trainer
// in a campaign you GM, which can get long, and a flat list stopped being readable at that scale.
// No custom combobox/search exists anywhere in this codebase yet, so this is the low-effort browser-
// native option rather than introducing one just for this.
function groupTrainers(trainers: Trainer[]): [string, Trainer[]][] {
  const groups = new Map<string, Trainer[]>()
  for (const t of trainers) {
    const key = t.campaignName ?? 'My Trainers'
    const group = groups.get(key)
    if (group) {
      group.push(t)
    } else {
      groups.set(key, [t])
    }
  }
  return Array.from(groups.entries()).sort(([a], [b]) => {
    if (a === 'My Trainers') return -1
    if (b === 'My Trainers') return 1
    return a.localeCompare(b)
  })
}

// Replaces the old <form action={assignPokemon/assignPokemonToCampaign}> pair -- both actions are
// now plain functions called directly, so assigning a Pokemon updates this row in place (swapping
// to "Trainer: X") instead of redirecting to the Pokemon's own page or reloading the /pokemon list.
export function PokemonAssignmentPanel({
  pokemonId,
  initialTrainerId,
  initialTrainerName,
  initialCampaignId,
  assignableTrainers,
  assignableCampaigns,
}: {
  pokemonId: string
  initialTrainerId: string | null
  initialTrainerName: string | null
  initialCampaignId: string | null
  assignableTrainers: Trainer[]
  assignableCampaigns: Campaign[]
}) {
  const [trainerId, setTrainerId] = useState(initialTrainerId)
  const [trainerName, setTrainerName] = useState(initialTrainerName)
  const [campaignId, setCampaignId] = useState(initialCampaignId)
  const [selectedTrainer, setSelectedTrainer] = useState('')
  const [selectedCampaign, setSelectedCampaign] = useState(initialCampaignId ?? '')
  const [error, setError] = useState<string | null>(null)
  const [savedPool, setSavedPool] = useState(false)

  async function handleAssign() {
    setError(null)
    if (!selectedTrainer) return
    const result = await assignPokemon(pokemonId, selectedTrainer)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setTrainerId(result.trainerId)
    setTrainerName(result.trainerName)
  }

  async function handleUnassign() {
    setError(null)
    const result = await unassignPokemon(pokemonId)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setTrainerId(null)
    setTrainerName(null)
  }

  async function handleSavePool() {
    setError(null)
    setSavedPool(false)
    const result = await assignPokemonToCampaign(pokemonId, selectedCampaign)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setCampaignId(result.campaignId)
    setSavedPool(true)
  }

  if (trainerId) {
    return (
      <div className="flex flex-col gap-1">
        <p className="text-xs text-muted">
          Trainer:{' '}
          <Link href={`/trainers/${trainerId}`} className="underline">
            {trainerName}
          </Link>{' '}
          <button type="button" onClick={handleUnassign} className="ml-1 rounded border px-2 py-0.5 text-xs">
            Unassign
          </button>
        </p>
        {error && <p className="text-danger">{error}</p>}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {assignableTrainers.length > 0 && (
          <span className="flex items-center gap-2">
            <select value={selectedTrainer} onChange={(e) => setSelectedTrainer(e.target.value)} className="bg-surface-subtle rounded border p-1">
              <option value="" disabled>
                Assign to trainer...
              </option>
              {groupTrainers(assignableTrainers).map(([groupName, trainers]) => (
                <optgroup key={groupName} label={groupName}>
                  {trainers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {t.is_npc ? ' (NPC)' : ''}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <button type="button" onClick={handleAssign} className="rounded border px-2 py-1">
              Assign
            </button>
          </span>
        )}
        {assignableCampaigns.length > 0 && (
          <span className="flex items-center gap-2">
            <select
              value={selectedCampaign}
              onChange={(e) => {
                setSelectedCampaign(e.target.value)
                setSavedPool(false)
              }}
              className="bg-surface-subtle rounded border p-1"
            >
              <option value="">No campaign pool</option>
              {assignableCampaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button type="button" onClick={handleSavePool} className="rounded border px-2 py-1">
              Save pool
            </button>
            {savedPool && <span className="text-success">Saved</span>}
          </span>
        )}
      </div>
      {error && <p className="text-danger">{error}</p>}
    </div>
  )
}
