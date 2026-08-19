'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { SpeciesPicker } from '@/components/SpeciesPicker'
import { deriveLevelFromModifiers, computeLoyaltyTier, type LoyaltyTierInfo } from '@/lib/pta3/pokemonLevel'
import { EV_STAT_COLUMNS, MAX_EV_PER_STAT, type EvStatKey } from '@/lib/pta3/pokemonEv'
import { createPokemon, loadSpeciesCreationData, type MoveOption, type PassiveOption } from '../actions'

const MAX_KNOWN_MOVES = 6
const MAX_STAT_PASSIVES = 3

type NatureOption = { id: number; name: string; increased: { name: string } | null; decreased: { name: string } | null }
type NamedIdOption = { id: number; name: string }
type ModifierOption = { id: number; name: string; modifier: number }
type SpeciesOption = { id: number; name: string; sprite_code: string; growth_rate_id: number | null }
type TrainerOption = { id: string; name: string; campaigns: { name: string } | null }
type LevelRow = { level_number: number; cumulative_exp: number }

// Big form covering every creation-time field ([[Bug - Improve Wild Pokemon creation and editing]]):
// Species/Nickname/Nature/Gender were already here; everything else (Loyalty, Obtain method, Held
// item, Shininess, Type/Weight/Size overrides, EXP with a live level preview, EVs, Moves, Passives,
// bulk quantity) is new. Owns all field state itself and calls createPokemon directly (a plain
// function, not a <form action>) since the live level preview and species-driven Moves/Passives
// panels need client-side derived state that a FormData round trip can't express.
export function CreatePokemonForm({
  species,
  natures,
  loyaltyTiers,
  obtainMethods,
  items,
  types,
  sizes,
  weights,
  levels,
  shinyModifiers,
  campaigns,
  trainers,
  defaultCampaignId,
}: {
  species: SpeciesOption[]
  natures: NatureOption[]
  loyaltyTiers: (LoyaltyTierInfo & { modifier: number })[]
  obtainMethods: ModifierOption[]
  items: NamedIdOption[]
  types: NamedIdOption[]
  sizes: NamedIdOption[]
  weights: NamedIdOption[]
  levels: LevelRow[]
  shinyModifiers: { name: string; modifier: number }[]
  campaigns: NamedIdOption[]
  trainers: TrainerOption[]
  defaultCampaignId: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])

  const [speciesName, setSpeciesName] = useState(species[0]?.name ?? '')
  const selectedSpecies = species.find((s) => s.name === speciesName) ?? null

  const [nickname, setNickname] = useState('')
  const [natureChoice, setNatureChoice] = useState<'random' | string>('random')
  const [genderChoice, setGenderChoice] = useState<'random' | 'male' | 'female' | 'genderless'>('random')
  const [campaignId, setCampaignId] = useState(defaultCampaignId)
  const [trainerId, setTrainerId] = useState('')
  const [startingLoyaltyPoints, setStartingLoyaltyPoints] = useState(0)
  const [obtainMethodId, setObtainMethodId] = useState('')
  const [heldItemId, setHeldItemId] = useState('')
  const [shininessChoice, setShininessChoice] = useState<'no' | 'yes' | 'random'>('no')
  const [type1Id, setType1Id] = useState('')
  const [type2Id, setType2Id] = useState('')
  const [sizeId, setSizeId] = useState('')
  const [weightId, setWeightId] = useState('')
  const [currentExp, setCurrentExp] = useState(0)
  const [evs, setEvs] = useState<Record<EvStatKey, number>>({
    hp: 0,
    attack: 0,
    defense: 0,
    special_attack: 0,
    special_defense: 0,
    speed: 0,
  })
  const [selectedMoveIds, setSelectedMoveIds] = useState<number[]>([])
  const [selectedPassiveIds, setSelectedPassiveIds] = useState<number[]>([])
  const [quantity, setQuantity] = useState(1)

  const [speciesData, setSpeciesData] = useState<{
    growthRateModifier: number
    learnset: { level_learned: number; move: MoveOption }[]
    passiveLearnset: { level_learned: number | null; passive: PassiveOption }[]
  } | null>(null)

  // Reloaded any time the picked species changes -- learnsets/growth rate are species-specific and
  // too large (986 species) to preload for all of them up front.
  useEffect(() => {
    if (!selectedSpecies) {
      setSpeciesData(null)
      return
    }
    let cancelled = false
    loadSpeciesCreationData(selectedSpecies.id).then((data) => {
      if (!cancelled) setSpeciesData(data)
    })
    return () => {
      cancelled = true
    }
  }, [selectedSpecies?.id])

  const selectedNature = natures.find((n) => String(n.id) === natureChoice) ?? null

  const loyaltyModifier = computeLoyaltyTier(startingLoyaltyPoints, loyaltyTiers)?.modifier ?? 1
  // Obtain method only matters once a Trainer is assigned -- unset otherwise, same as it works for
  // every other Pokemon (a Wild/pool Pokemon has no trainers_pokemon row to hold one).
  const obtainModifier = trainerId ? obtainMethods.find((o) => String(o.id) === obtainMethodId)?.modifier ?? 1 : 1
  // "Random" shininess previews as not-shiny -- the real roll happens per-copy at creation, so an
  // exact preview isn't possible when it's left to chance; approximating with the "No" modifier
  // keeps the preview from jumping around while typing EXP.
  const shinyModifier = shininessChoice === 'yes' ? shinyModifiers.find((s) => s.name === 'Yes')?.modifier ?? 1 : shinyModifiers.find((s) => s.name === 'No')?.modifier ?? 1

  const levelPreview = useMemo(() => {
    if (!speciesData || levels.length === 0) return { level: 1, effectiveExp: 0 }
    return deriveLevelFromModifiers(
      { currentExp, loyaltyModifier, obtainModifier, growthModifier: speciesData.growthRateModifier, shinyModifier },
      levels,
    )
  }, [speciesData, levels, currentExp, loyaltyModifier, obtainModifier, shinyModifier])

  const evsAvailable = Math.floor(levelPreview.level / 8)
  const evsSpent = Object.values(evs).reduce((a, b) => a + b, 0)

  const eligibleMoves = (speciesData?.learnset ?? []).filter((r) => r.level_learned <= levelPreview.level)
  const eligiblePassives = (speciesData?.passiveLearnset ?? []).filter((r) => r.level_learned === null || r.level_learned <= levelPreview.level)

  function toggleMove(id: number) {
    setSelectedMoveIds((prev) => {
      if (prev.includes(id)) return prev.filter((m) => m !== id)
      if (prev.length >= MAX_KNOWN_MOVES) return prev
      return [...prev, id]
    })
  }

  function togglePassive(id: number) {
    setSelectedPassiveIds((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id)
      if (prev.length >= MAX_STAT_PASSIVES) return prev
      return [...prev, id]
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedSpecies) {
      setError('Choose a species')
      return
    }
    setError(null)
    setWarnings([])

    startTransition(async () => {
      const result = await createPokemon({
        speciesId: selectedSpecies.id,
        nickname: nickname.trim() || null,
        campaignId: campaignId || null,
        trainerId: trainerId || null,
        natureChoice: natureChoice === 'random' ? 'random' : Number(natureChoice),
        genderChoice,
        loyaltyPoints: startingLoyaltyPoints,
        obtainMethodId: obtainMethodId ? Number(obtainMethodId) : null,
        heldItemId: heldItemId ? Number(heldItemId) : null,
        shininessChoice,
        type1Id: type1Id ? Number(type1Id) : null,
        type2Id: type2Id ? Number(type2Id) : null,
        sizeId: sizeId ? Number(sizeId) : null,
        weightId: weightId ? Number(weightId) : null,
        currentExp,
        evs,
        moveIds: selectedMoveIds,
        passiveIds: selectedPassiveIds,
        quantity,
      })

      if ('error' in result) {
        setError(result.error)
        return
      }
      if (result.warnings.length > 0) {
        setWarnings(result.warnings)
      }
      router.push(result.redirectTo)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-3">
      {error && <p className="text-danger">{error}</p>}
      {warnings.length > 0 && (
        <div className="rounded border border-warning bg-warning/10 p-2 text-xs text-warning">
          {warnings.map((w, i) => (
            <p key={i}>{w}</p>
          ))}
        </div>
      )}

      <section className="flex flex-col gap-3 rounded border border-accent bg-accent/10 p-4">
        <h2 className="font-semibold">Basics</h2>
        <SpeciesPicker species={species} value={speciesName} onChange={setSpeciesName} />

        <label htmlFor="nickname">Nickname (optional)</label>
        <input
          id="nickname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          type="text"
          className="bg-surface-subtle rounded border px-3 py-2"
        />

        <label htmlFor="natureId">Nature (roll a d20 — numbers match the options below)</label>
        <select id="natureId" value={natureChoice} onChange={(e) => setNatureChoice(e.target.value)} className="bg-surface-subtle rounded border px-3 py-2">
          <option value="random">Random</option>
          {natures.map((n, i) => (
            <option key={n.id} value={n.id}>
              {i + 1}. {n.name}
            </option>
          ))}
        </select>
        <p className="rounded border bg-surface-muted px-3 py-2 text-xs">
          {selectedNature ? (
            <>
              Stat increase: <span className="font-medium">{selectedNature.increased?.name ?? '—'}</span> · Stat decrease:{' '}
              <span className="font-medium">{selectedNature.decreased?.name ?? '—'}</span>
            </>
          ) : (
            <span className="text-muted">Pick a specific nature above to see its stat effect.</span>
          )}
        </p>

        <label htmlFor="gender">Gender</label>
        <select id="gender" value={genderChoice} onChange={(e) => setGenderChoice(e.target.value as typeof genderChoice)} className="bg-surface-subtle rounded border px-3 py-2">
          <option value="random">Random</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="genderless">Genderless</option>
        </select>

        <label htmlFor="campaignId">Pool (optional)</label>
        <select id="campaignId" value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className="bg-surface-subtle rounded border px-3 py-2">
          <option value="">None (personal pool)</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <label htmlFor="trainerId">Assign to trainer now (optional)</label>
        <select id="trainerId" value={trainerId} onChange={(e) => setTrainerId(e.target.value)} className="bg-surface-subtle rounded border px-3 py-2">
          <option value="">Leave unassigned</option>
          {trainers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.campaigns?.name})
            </option>
          ))}
        </select>

        {trainerId && (
          <>
            <label htmlFor="obtainMethodId">Obtain method</label>
            <select id="obtainMethodId" value={obtainMethodId} onChange={(e) => setObtainMethodId(e.target.value)} className="bg-surface-subtle rounded border px-3 py-2">
              <option value="">—</option>
              {obtainMethods.map((om) => (
                <option key={om.id} value={om.id}>
                  {om.name}
                </option>
              ))}
            </select>
          </>
        )}

        {!trainerId && (
          <>
            <label htmlFor="quantity">Quantity (pool/wild only)</label>
            <input
              id="quantity"
              type="number"
              min={1}
              max={50}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
              className="bg-surface-subtle rounded border px-3 py-2"
            />
            {quantity > 1 && <p className="text-xs text-muted">Each copy independently rolls its own Random Nature/Gender/Shininess.</p>}
          </>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded border border-accent bg-accent/10 p-4">
        <h2 className="font-semibold">Appearance & Details</h2>
        <label htmlFor="heldItemId">Held item</label>
        <select id="heldItemId" value={heldItemId} onChange={(e) => setHeldItemId(e.target.value)} className="bg-surface-subtle rounded border px-3 py-2">
          <option value="">None</option>
          {items.map((it) => (
            <option key={it.id} value={it.id}>
              {it.name}
            </option>
          ))}
        </select>

        <label htmlFor="shininess">Shininess</label>
        <select id="shininess" value={shininessChoice} onChange={(e) => setShininessChoice(e.target.value as typeof shininessChoice)} className="bg-surface-subtle rounded border px-3 py-2">
          <option value="no">Not shiny</option>
          <option value="yes">Shiny</option>
          <option value="random">Random</option>
        </select>

        <label htmlFor="type1Id">Type 1 override</label>
        <select id="type1Id" value={type1Id} onChange={(e) => setType1Id(e.target.value)} className="bg-surface-subtle rounded border px-3 py-2">
          <option value="">Species default</option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        <label htmlFor="type2Id">Type 2 override</label>
        <select id="type2Id" value={type2Id} onChange={(e) => setType2Id(e.target.value)} className="bg-surface-subtle rounded border px-3 py-2">
          <option value="">Species default</option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        <label htmlFor="sizeId">Size override</label>
        <select id="sizeId" value={sizeId} onChange={(e) => setSizeId(e.target.value)} className="bg-surface-subtle rounded border px-3 py-2">
          <option value="">Species default</option>
          {sizes.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <label htmlFor="weightId">Weight override</label>
        <select id="weightId" value={weightId} onChange={(e) => setWeightId(e.target.value)} className="bg-surface-subtle rounded border px-3 py-2">
          <option value="">Species default</option>
          {weights.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </section>

      <section className="flex flex-col gap-3 rounded border border-accent bg-accent/10 p-4">
        <h2 className="font-semibold">Experience & Stats</h2>
        <label htmlFor="currentExp">Starting EXP</label>
        <input
          id="currentExp"
          type="number"
          min={0}
          value={currentExp}
          onChange={(e) => setCurrentExp(Math.max(0, Number(e.target.value) || 0))}
          className="bg-surface-subtle rounded border px-3 py-2"
        />
        <p className="text-xs text-muted">Computes to Level {levelPreview.level}</p>

        <label htmlFor="startingLoyaltyPoints">Starting LP</label>
        <input
          id="startingLoyaltyPoints"
          type="number"
          min={0}
          value={startingLoyaltyPoints}
          onChange={(e) => setStartingLoyaltyPoints(Math.max(0, Number(e.target.value) || 0))}
          className="bg-surface-subtle rounded border px-3 py-2"
        />

        <div className="rounded border p-3 text-sm">
          <p className="mb-2 font-medium">EVs ({evsSpent}/{evsAvailable} available)</p>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(EV_STAT_COLUMNS) as EvStatKey[]).map((stat) => (
              <label key={stat} className="flex items-center justify-between gap-2 text-xs">
                {stat.replace('_', ' ')}
                <input
                  type="number"
                  min={0}
                  max={MAX_EV_PER_STAT}
                  value={evs[stat]}
                  onChange={(e) => setEvs((prev) => ({ ...prev, [stat]: Math.max(0, Math.min(MAX_EV_PER_STAT, Number(e.target.value) || 0)) }))}
                  className="bg-surface-subtle w-14 rounded border px-2 py-1"
                />
              </label>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded border border-accent bg-accent/10 p-4 text-sm">
        <p className="mb-2 font-semibold">
          Moves ({selectedMoveIds.length}/{MAX_KNOWN_MOVES})
        </p>
        {eligibleMoves.length === 0 ? (
          <p className="text-sm text-muted">No natural moves eligible at this level yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {eligibleMoves.map((r) => {
              const move = r.move
              const selected = selectedMoveIds.includes(move.id)
              const disabled = !selected && selectedMoveIds.length >= MAX_KNOWN_MOVES
              return (
                <li key={move.id} className="flex flex-col gap-2 rounded border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium">{move.name}</span>
                      {move.types?.name && <span className="rounded bg-surface-muted px-1.5 py-0.5 text-xs">{move.types.name}</span>}
                      <span className="text-xs font-normal text-muted">(level {r.level_learned})</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleMove(move.id)}
                      disabled={disabled}
                      className={`rounded border px-3 py-1 text-xs disabled:opacity-30 ${
                        selected ? 'border-accent bg-accent text-accent-foreground' : ''
                      }`}
                    >
                      {selected ? '✓ Selected' : 'Select'}
                    </button>
                  </div>
                  <details>
                    <summary className="cursor-pointer text-xs text-muted">
                      {move.range} · {move.damage_stat.replace('_', ' ')} · {move.frequency}
                      {move.damage_dice ? ` · ${move.damage_dice}` : ''}
                    </summary>
                    {move.description && <p className="mt-1 text-xs text-muted">{move.description}</p>}
                  </details>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="rounded border border-accent bg-accent/10 p-4 text-sm">
        <p className="mb-2 font-semibold">
          Stat Passives ({selectedPassiveIds.length}/{MAX_STAT_PASSIVES})
        </p>
        {eligiblePassives.length === 0 ? (
          <p className="text-sm text-muted">No Stat Passives eligible at this level yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {eligiblePassives.map((r) => {
              const passive = r.passive
              const selected = selectedPassiveIds.includes(passive.id)
              const disabled = !selected && selectedPassiveIds.length >= MAX_STAT_PASSIVES
              return (
                <li key={passive.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-3">
                  <div>
                    <p className="font-medium">
                      {passive.name}{' '}
                      <span className="text-xs font-normal text-muted">
                        ({r.level_learned === null ? 'always known' : `level ${r.level_learned}`}
                        {passive.category ? ` · ${passive.category.replace('_', ' ')}` : ''})
                      </span>
                    </p>
                    {passive.description && <p className="text-xs text-muted">{passive.description}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => togglePassive(passive.id)}
                    disabled={disabled}
                    className={`rounded border px-3 py-1 text-xs disabled:opacity-30 ${
                      selected ? 'border-accent bg-accent text-accent-foreground' : ''
                    }`}
                  >
                    {selected ? '✓ Selected' : 'Select'}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <button type="submit" disabled={isPending} className="mt-2 rounded bg-accent px-4 py-2 text-accent-foreground disabled:opacity-50">
        {isPending ? 'Creating…' : 'Create Pokémon'}
      </button>
    </form>
  )
}
