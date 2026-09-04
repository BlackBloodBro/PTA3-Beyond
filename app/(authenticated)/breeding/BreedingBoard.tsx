'use client'

import { useMemo, useState } from 'react'
import { attemptBreedingCheck, type BreedingCheckResult } from './actions'
import { breedingTargetNumber, type BreedingCandidate } from '@/lib/pta3/breeding'

export type { BreedingCandidate }

// [[Improvement - Only show eligible Pokemon in the Breeding picker]]: Affliction is an unconditional
// exclusion (no partner makes an afflicted Pokemon eligible), checked once, not per-pair. Gender/Egg
// Group are pairwise -- only meaningful once a specific other Pokemon is in the picture.
function isOppositeGender(a: string | null, b: string | null): boolean {
  return (a === 'male' && b === 'female') || (a === 'female' && b === 'male')
}

function canPairWith(candidate: BreedingCandidate, other: BreedingCandidate, hasUnlikelyPairings: boolean): boolean {
  if (!isOppositeGender(candidate.gender, other.gender)) return false
  if (hasUnlikelyPairings) return true
  return candidate.eggGroupIds.some((id) => other.eggGroupIds.includes(id))
}

// [[Feature - Add a Pokemon Breeding Check mechanic]]: picks two Pokemon (either from the whole
// Campaign's player Trainers, or -- when `campaignId` is null -- just the one campaign-less Trainer's
// own Pokemon), previews the computed target number live (reusing the same pure formula the server
// re-validates against -- see lib/pta3/breeding.ts), then submits a physically-rolled d100 result.
// `candidates` never includes NPC-owned Pokemon at all -- per the user (2026-09-03), a player Trainer
// can't select one for now; that's excluded at the query level (loadCampaignBreedingCandidates), not
// filtered here, since a real flow for picking an NPC's Pokemon is being designed separately.
//
// [[Improvement - Only show eligible Pokemon in the Breeding picker]] (2026-09-05): the two `<select>`s
// now pre-filter to only-eligible pairs after all -- afflicted Pokemon are dropped from both lists
// entirely, and once one side is picked, the other list narrows to opposite-gender/shared-Egg-Group
// candidates (or just opposite-gender if the initiating Trainer has Unlikely Pairings). Server-side
// validation in `attemptBreedingCheck` is untouched -- this only narrows what the UI *offers*.
export function BreedingBoard({
  campaignId,
  initiatingTrainerId,
  initiatingTrainerName,
  candidates,
  hasUnexpectedHatch,
  hasEggFinder,
  hasUnlikelyPairings,
}: {
  campaignId: string | null
  initiatingTrainerId: string
  initiatingTrainerName: string
  candidates: BreedingCandidate[]
  hasUnexpectedHatch: boolean
  hasEggFinder: boolean
  hasUnlikelyPairings: boolean
}) {
  const [pokemonAId, setPokemonAId] = useState('')
  const [pokemonBId, setPokemonBId] = useState('')
  const [hours, setHours] = useState(4)
  const [coinFlipHeads, setCoinFlipHeads] = useState(false)
  const [result, setResult] = useState<BreedingCheckResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const eligibleCandidates = useMemo(() => candidates.filter((c) => !c.hasActiveAffliction), [candidates])

  const pokemonA = eligibleCandidates.find((c) => c.id === pokemonAId) ?? null
  const pokemonB = eligibleCandidates.find((c) => c.id === pokemonBId) ?? null

  const optionsForA = useMemo(
    () => eligibleCandidates.filter((c) => c.id !== pokemonBId && (!pokemonB || canPairWith(c, pokemonB, hasUnlikelyPairings))),
    [eligibleCandidates, pokemonBId, pokemonB, hasUnlikelyPairings],
  )
  const optionsForB = useMemo(
    () => eligibleCandidates.filter((c) => c.id !== pokemonAId && (!pokemonA || canPairWith(c, pokemonA, hasUnlikelyPairings))),
    [eligibleCandidates, pokemonAId, pokemonA, hasUnlikelyPairings],
  )

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

  // Picking a new A can invalidate an already-picked B (and vice versa) -- cleared rather than left
  // showing an impossible pairing silently selected.
  function handlePickA(id: string) {
    setPokemonAId(id)
    const newA = eligibleCandidates.find((c) => c.id === id) ?? null
    if (newA && pokemonB && !canPairWith(pokemonB, newA, hasUnlikelyPairings)) {
      setPokemonBId('')
    }
    reset()
  }

  function handlePickB(id: string) {
    setPokemonBId(id)
    const newB = eligibleCandidates.find((c) => c.id === id) ?? null
    if (newB && pokemonA && !canPairWith(pokemonA, newB, hasUnlikelyPairings)) {
      setPokemonAId('')
    }
    reset()
  }

  async function handleRoll() {
    if (!pokemonA || !pokemonB) return
    let entry = window.prompt(
      hasEggFinder ? 'Egg Finder: roll a d100 three times and enter your best result:' : 'Enter your d100 roll result:',
    )
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
        <select id="pokemonA" value={pokemonAId} onChange={(e) => handlePickA(e.target.value)} className="bg-surface-subtle rounded border p-2">
          <option value="">Select...</option>
          {optionsForA.map((c) => (
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
        <select id="pokemonB" value={pokemonBId} onChange={(e) => handlePickB(e.target.value)} className="bg-surface-subtle rounded border p-2">
          <option value="">Select...</option>
          {optionsForB.map((c) => (
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
          Target number: <span className="font-semibold">{targetNumber}</span> — roll a d100
          {hasEggFinder ? ' three times, take your best,' : ''} and report the result. Equal or under succeeds.
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
