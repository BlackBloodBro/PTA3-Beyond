'use client'

import { useMemo, useState } from 'react'
import { attemptBreedingCheck, type BreedingCheckResult } from './actions'
import { breedingTargetNumber, type BreedingCandidate } from '@/lib/pta3/breeding'

export type { BreedingCandidate }

// [[Feature - Add a Pokemon Breeding Check mechanic]]: picks two Pokemon (either from the whole
// Campaign's player Trainers, or -- when `campaignId` is null -- just the one campaign-less Trainer's
// own Pokemon), previews the computed target number live (reusing the same pure formula the server
// re-validates against -- see lib/pta3/breeding.ts), then submits a physically-rolled d100 result.
// `candidates` never includes NPC-owned Pokemon at all -- per the user (2026-09-03), a player Trainer
// can't select one for now; that's excluded at the query level (loadCampaignBreedingCandidates), not
// filtered here, since a real flow for picking an NPC's Pokemon is being designed separately. Also
// deliberately doesn't pre-filter the two <select>s to only-eligible pairs -- the server is the real
// authority on every other gate (gender/egg group/afflictions/ownership/campaign), and surfaces a clear
// error for an ineligible pair rather than this component silently guessing at the same rules twice.
export function BreedingBoard({
  campaignId,
  initiatingTrainerId,
  initiatingTrainerName,
  candidates,
  hasUnexpectedHatch,
}: {
  campaignId: string | null
  initiatingTrainerId: string
  initiatingTrainerName: string
  candidates: BreedingCandidate[]
  hasUnexpectedHatch: boolean
}) {
  const [pokemonAId, setPokemonAId] = useState('')
  const [pokemonBId, setPokemonBId] = useState('')
  const [hours, setHours] = useState(4)
  const [coinFlipHeads, setCoinFlipHeads] = useState(false)
  const [result, setResult] = useState<BreedingCheckResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const pokemonA = candidates.find((c) => c.id === pokemonAId) ?? null
  const pokemonB = candidates.find((c) => c.id === pokemonBId) ?? null

  const targetNumber = useMemo(() => {
    if (!pokemonA || !pokemonB) return null
    return breedingTargetNumber({
      hoursOfPrivacy: hours,
      loyaltyTierA: pokemonA.loyaltyTier,
      loyaltyTierB: pokemonB.loyaltyTier,
      friendship: {
        aTrainerIsNpc: pokemonA.trainerIsNpc,
        bTrainerIsNpc: pokemonB.trainerIsNpc,
        sameTrainer: pokemonA.trainerId === pokemonB.trainerId,
        samePokedexId: pokemonA.pokedexId === pokemonB.pokedexId,
      },
    })
  }, [pokemonA, pokemonB, hours])

  function reset() {
    setResult(null)
    setError(null)
  }

  async function handleRoll() {
    if (!pokemonA || !pokemonB) return
    let entry = window.prompt('Enter your d100 roll result (best of three if you have Egg Finder):')
    let roll: number | null = null
    while (entry !== null) {
      const n = Number(entry)
      if (Number.isInteger(n) && n >= 1 && n <= 100) {
        roll = n
        break
      }
      entry = window.prompt('Enter a whole number from 1 to 100:')
    }
    if (roll === null) return

    setSubmitting(true)
    setError(null)
    setResult(null)
    const res = await attemptBreedingCheck(campaignId, initiatingTrainerId, pokemonA.id, pokemonB.id, hours, roll, coinFlipHeads)
    setSubmitting(false)
    if ('error' in res) {
      setError(res.error)
      return
    }
    setResult(res)
  }

  return (
    <div className="flex w-full max-w-2xl flex-col gap-4 text-sm">
      <p className="text-muted">Attempting as {initiatingTrainerName}.</p>

      <div className="flex flex-col gap-1">
        <label htmlFor="pokemonA" className="font-semibold">
          Pokémon A
        </label>
        <select
          id="pokemonA"
          value={pokemonAId}
          onChange={(e) => {
            setPokemonAId(e.target.value)
            reset()
          }}
          className="bg-surface-subtle rounded border p-2"
        >
          <option value="">Select...</option>
          {candidates
            .filter((c) => c.id !== pokemonBId)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.speciesName}, {c.gender ?? 'unknown'}) — {c.trainerName}
              </option>
            ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="pokemonB" className="font-semibold">
          Pokémon B
        </label>
        <select
          id="pokemonB"
          value={pokemonBId}
          onChange={(e) => {
            setPokemonBId(e.target.value)
            reset()
          }}
          className="bg-surface-subtle rounded border p-2"
        >
          <option value="">Select...</option>
          {candidates
            .filter((c) => c.id !== pokemonAId)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.speciesName}, {c.gender ?? 'unknown'}) — {c.trainerName}
              </option>
            ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="hours" className="font-semibold">
          Hours of privacy
        </label>
        {/* 4 is the minimum to attempt at all; the bonus itself caps out at 9 (+10, per
            privacyBonus's own formula) -- values outside 4-9 either can't attempt or do nothing
            more, so the input doesn't offer them. */}
        <input
          id="hours"
          type="number"
          min={4}
          max={9}
          value={hours}
          onChange={(e) => {
            setHours(Math.max(4, Math.min(9, Number(e.target.value))))
            reset()
          }}
          className="bg-surface-subtle w-24 rounded border p-2"
        />
      </div>

      {hasUnexpectedHatch && (
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={coinFlipHeads} onChange={(e) => setCoinFlipHeads(e.target.checked)} />
          Unexpected Hatch: coin flip landed Heads (father&apos;s species instead, only used if the check succeeds)
        </label>
      )}

      {targetNumber !== null && (
        <p>
          Target number: <span className="font-semibold">{targetNumber}</span> — roll a d100 (three times if you have Egg
          Finder, use your best) and report the result. Equal or under succeeds.
        </p>
      )}

      {pokemonA && pokemonB && (
        <button
          type="button"
          onClick={handleRoll}
          disabled={submitting}
          className="w-fit rounded bg-accent px-4 py-2 text-accent-foreground disabled:opacity-50"
        >
          Report roll
        </button>
      )}

      {error && <p className="text-danger">{error}</p>}

      {result && 'success' in result && (
        <div className={result.success ? 'rounded border border-accent bg-accent/10 p-3' : 'rounded border p-3 text-muted'}>
          {result.success ? (
            <p>
              Success! Rolled {result.roll} vs target {result.targetNumber} — an Egg was added to {initiatingTrainerName}
              &apos;s Inventory.
            </p>
          ) : (
            <p>
              No luck this time — rolled {result.roll}, needed {result.targetNumber} or under.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
