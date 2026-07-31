'use client'

import Link from 'next/link'
import { createContext, useContext, useState, type ReactNode } from 'react'
import { statModifier } from '@/lib/pta3/pointBuy'
import { parseMoveFrequency } from '@/lib/pta3/moveFrequency'
import { EV_STAT_COLUMNS, MAX_EV_PER_STAT, type EvStatKey } from '@/lib/pta3/pokemonEv'
import { ClickTooltip } from '@/components/ClickTooltip'
import { adjustPokemonHp, addPokemonExp, assignPokemonEv, setPokemonEvs, setMoveUsesRemaining, learnMove, forgetMove } from '../actions'

const MAX_KNOWN_MOVES = 6

function formatSigned(n: number) {
  return `${n >= 0 ? '+' : ''}${n}`
}

// Same rule as STAB elsewhere -- +4 damage when a move's type matches either of the Pokemon's own
// (effective, override-aware) types.
function stabBonus(moveTypeName: string | undefined, type1?: string, type2?: string) {
  return moveTypeName && (moveTypeName === type1 || moveTypeName === type2) ? 4 : 0
}

export type MoveInfo = {
  id: number
  name: string
  range: string
  damage_stat: string
  frequency: string
  damage_dice: string | null
  description: string | null
  types: { name: string } | null
}

export type KnownMoveEntry = {
  move_id: number
  uses_remaining: number | null
  resets_on: string | null
  moves: MoveInfo
}

export type LearnsetEntry = {
  level_learned: number | null
  move: MoveInfo
}

type SpeciesStats = {
  base_hp: number
  base_atk: number
  base_def: number
  base_sp_atk: number
  base_sp_def: number
  base_speed: number
}

function computeStatRows(
  species: SpeciesStats,
  evs: Record<EvStatKey, number>,
  natureIncreasedName: string | null,
  natureDecreasedName: string | null,
  passiveBonusByStat: Record<string, number>,
) {
  return (
    [
      { key: 'attack', label: 'Attack', base: species.base_atk, ev: evs.attack },
      { key: 'defense', label: 'Defense', base: species.base_def, ev: evs.defense },
      { key: 'special_attack', label: 'Special Attack', base: species.base_sp_atk, ev: evs.special_attack },
      { key: 'special_defense', label: 'Special Defense', base: species.base_sp_def, ev: evs.special_defense },
      { key: 'speed', label: 'Speed', base: species.base_speed, ev: evs.speed },
    ] as const
  ).map((s) => {
    const natureAdjust = natureIncreasedName === s.label ? 1 : natureDecreasedName === s.label ? -1 : 0
    const passiveBonus = passiveBonusByStat[s.label] ?? 0
    const inBattle = 0 // No in-combat temporary-modifier tracking exists yet; always displayed as 0.
    const value = s.base + s.ev + natureAdjust + passiveBonus + inBattle
    return { ...s, natureAdjust, passiveBonus, inBattle, value, modifier: statModifier(value) }
  })
}

type StatRows = ReturnType<typeof computeStatRows>

// physical -> Attack, special -> Special Attack, "either" -> whichever of Attack/Special Attack is
// higher, "effect" -> Speed (all confirmed with the user).
function modifierForDamageStat(damageStat: string, statRows: StatRows) {
  const attackMod = statRows.find((s) => s.key === 'attack')!.modifier
  const spAtkMod = statRows.find((s) => s.key === 'special_attack')!.modifier
  const speedMod = statRows.find((s) => s.key === 'speed')!.modifier
  if (damageStat === 'physical') return attackMod
  if (damageStat === 'special') return spAtkMod
  if (damageStat === 'either') return Math.max(attackMod, spAtkMod)
  return speedMod
}

type PokemonStateValue = {
  pokemonId: string
  isOwner: boolean
  isGM: boolean
  effectiveType1?: string
  effectiveType2?: string
  level: number
  effectiveExp: number
  currentExp: number
  currentHp: number
  temporaryHp: number
  evs: Record<EvStatKey, number>
  knownMoves: KnownMoveEntry[]
  fullLearnset: LearnsetEntry[]
  isEditingMoves: boolean
  species: SpeciesStats
  growthRateName: string | null
  growthRateModifier: number
  obtainMethodName: string | null
  obtainMethodModifier: number
  loyaltyName: string | null
  loyaltyModifier: number
  isShiny: boolean
  statRows: StatRows
  evsAvailable: number
  evsSpent: number
  setCurrentHp: (v: number) => void
  setExp: (v: { currentExp: number; effectiveExp: number; level: number }) => void
  setEv: (stat: EvStatKey, value: number) => void
  setEvs: (evs: Record<EvStatKey, number>) => void
  addKnownMove: (entry: KnownMoveEntry) => void
  removeKnownMove: (moveId: number) => void
  updateMoveUses: (moveId: number, usesRemaining: number) => void
}

const PokemonStateContext = createContext<PokemonStateValue | null>(null)

function usePokemonState() {
  const ctx = useContext(PokemonStateContext)
  if (!ctx) throw new Error('usePokemonState must be used within PokemonStateProvider')
  return ctx
}

// Owns every piece of state that these six actions (HP, Exp, move uses, move learn/forget, EV
// assign, EV edit) can change, so a click only ever updates this local state from the action's
// return value instead of forcing Next.js to re-fetch and re-render the whole page. Wraps the
// Info aside (for the Level line) and the Experience/Stats/Moves/HP sections together because
// they're genuinely coupled -- e.g. an EV change to Speed affects both the Stats table AND every
// move's "To hit" in the Moves section, and an Exp change affects both the header's Level line and
// which moves are learnable.
export function PokemonStateProvider(props: {
  pokemonId: string
  isOwner: boolean
  isGM: boolean
  effectiveType1?: string
  effectiveType2?: string
  initialLevel: number
  initialEffectiveExp: number
  initialCurrentExp: number
  initialCurrentHp: number
  temporaryHp: number
  initialEvs: Record<EvStatKey, number>
  species: SpeciesStats
  natureIncreasedName: string | null
  natureDecreasedName: string | null
  passiveBonusByStat: Record<string, number>
  initialKnownMoves: KnownMoveEntry[]
  fullLearnset: LearnsetEntry[]
  isEditingMoves: boolean
  growthRateName: string | null
  growthRateModifier: number
  obtainMethodName: string | null
  obtainMethodModifier: number
  loyaltyName: string | null
  loyaltyModifier: number
  isShiny: boolean
  children: ReactNode
}) {
  const [level, setLevel] = useState(props.initialLevel)
  const [effectiveExp, setEffectiveExp] = useState(props.initialEffectiveExp)
  const [currentExp, setCurrentExp] = useState(props.initialCurrentExp)
  const [currentHp, setCurrentHpState] = useState(props.initialCurrentHp)
  const [evs, setEvsState] = useState(props.initialEvs)
  const [knownMoves, setKnownMoves] = useState(props.initialKnownMoves)

  const statRows = computeStatRows(props.species, evs, props.natureIncreasedName, props.natureDecreasedName, props.passiveBonusByStat)
  const evsAvailable = Math.floor(level / 8)
  const evsSpent = Object.values(evs).reduce((a, b) => a + b, 0)

  const value: PokemonStateValue = {
    pokemonId: props.pokemonId,
    isOwner: props.isOwner,
    isGM: props.isGM,
    effectiveType1: props.effectiveType1,
    effectiveType2: props.effectiveType2,
    level,
    effectiveExp,
    currentExp,
    currentHp,
    temporaryHp: props.temporaryHp,
    evs,
    knownMoves,
    fullLearnset: props.fullLearnset,
    isEditingMoves: props.isEditingMoves,
    species: props.species,
    growthRateName: props.growthRateName,
    growthRateModifier: props.growthRateModifier,
    obtainMethodName: props.obtainMethodName,
    obtainMethodModifier: props.obtainMethodModifier,
    loyaltyName: props.loyaltyName,
    loyaltyModifier: props.loyaltyModifier,
    isShiny: props.isShiny,
    statRows,
    evsAvailable,
    evsSpent,
    setCurrentHp: setCurrentHpState,
    setExp: ({ currentExp, effectiveExp, level }) => {
      setCurrentExp(currentExp)
      setEffectiveExp(effectiveExp)
      setLevel(level)
    },
    setEv: (stat, val) => setEvsState((prev) => ({ ...prev, [stat]: val })),
    setEvs: (newEvs) => setEvsState(newEvs),
    addKnownMove: (entry) => setKnownMoves((prev) => [...prev, entry]),
    removeKnownMove: (moveId) => setKnownMoves((prev) => prev.filter((km) => km.move_id !== moveId)),
    updateMoveUses: (moveId, usesRemaining) =>
      setKnownMoves((prev) => prev.map((km) => (km.move_id === moveId ? { ...km, uses_remaining: usesRemaining } : km))),
  }

  return <PokemonStateContext.Provider value={value}>{props.children}</PokemonStateContext.Provider>
}

export function LevelLine() {
  const { level, effectiveType1, effectiveType2 } = usePokemonState()
  return (
    <p className="text-sm text-neutral-500">
      Level {level} {effectiveType1}
      {effectiveType2 ? ` / ${effectiveType2}` : ''}
    </p>
  )
}

export function ExperienceSection() {
  const {
    isGM,
    pokemonId,
    currentExp,
    effectiveExp,
    growthRateName,
    growthRateModifier,
    obtainMethodName,
    obtainMethodModifier,
    isShiny,
    loyaltyName,
    loyaltyModifier,
    setExp,
  } = usePokemonState()
  const [amount, setAmount] = useState(0)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isGM) return null

  async function handleAdjust(sign: 1 | -1) {
    setPending(true)
    setError(null)
    const result = await addPokemonExp(pokemonId, sign, amount)
    setPending(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setExp(result)
    setAmount(0)
  }

  return (
    <section className="rounded border p-4">
      <h2 className="mb-2 font-semibold">Experience</h2>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <p>Current exp: {currentExp}</p>
        <p>Effective exp: {Math.round(effectiveExp)}</p>
        <p>
          Growth rate: {growthRateName ?? '—'} (×{growthRateModifier})
        </p>
        <p>
          Obtain method: {obtainMethodName ?? '—'} (×{obtainMethodModifier})
        </p>
        <p>Shiny: {isShiny ? 'Yes' : 'No'}</p>
        <p>
          Loyalty: {loyaltyName ?? '—'} (×{loyaltyModifier})
        </p>
      </div>

      <div className="mt-3 flex items-center gap-2 border-t pt-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => handleAdjust(1)}
          className="rounded border border-green-600 px-3 py-2 text-sm font-semibold text-green-600 disabled:opacity-30"
        >
          Add Exp
        </button>
        <input
          type="number"
          min={0}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="w-24 rounded border p-2 text-center"
        />
        <button
          type="button"
          disabled={pending}
          onClick={() => handleAdjust(-1)}
          className="rounded border border-red-600 px-3 py-2 text-sm font-semibold text-red-600 disabled:opacity-30"
        >
          Remove Exp
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </section>
  )
}

export function HpSection() {
  const { pokemonId, currentHp, temporaryHp, species, evs, setCurrentHp } = usePokemonState()
  const [amount, setAmount] = useState(0)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const maxHp = species.base_hp + evs.hp * 6

  async function handleAdjust(sign: 1 | -1) {
    setPending(true)
    setError(null)
    const result = await adjustPokemonHp(pokemonId, sign, amount)
    setPending(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setCurrentHp(result.currentHp)
    setAmount(0)
  }

  return (
    <section className="rounded border p-4">
      <h2 className="mb-2 font-semibold">Hit Points</h2>
      <div className="mb-3 text-center">
        <p className="text-2xl font-bold leading-none">
          {currentHp} /{' '}
          <ClickTooltip
            label={String(maxHp)}
            tooltip={[
              `Base: ${species.base_hp}`,
              ...(evs.hp > 0 ? [`EV: +${evs.hp * 6} (${evs.hp} EV × 6)`] : []),
              `Total: ${maxHp}`,
            ].join('\n')}
          />
        </p>
        <p className="text-xs uppercase tracking-wide text-neutral-500">Hit Points</p>
        {temporaryHp > 0 && <p className="text-sm text-neutral-500">+{temporaryHp} temp</p>}
      </div>
      <div className="flex flex-col gap-2">
        <input
          type="number"
          min={0}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="w-full rounded border p-2 text-center"
        />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => handleAdjust(1)}
            className="flex-1 rounded border border-green-600 px-3 py-2 text-sm font-semibold text-green-600 disabled:opacity-30"
          >
            Heal
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => handleAdjust(-1)}
            className="flex-1 rounded border border-red-600 px-3 py-2 text-sm font-semibold text-red-600 disabled:opacity-30"
          >
            Damage
          </button>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </section>
  )
}

export function StatsSection() {
  const { pokemonId, isOwner, isGM, statRows, evs, evsAvailable, evsSpent, setEv, setEvs, setCurrentHp } = usePokemonState()

  const [assignOpen, setAssignOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [assignError, setAssignError] = useState<string | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [draftEvs, setDraftEvs] = useState(evs)

  const speedRow = statRows.find((s) => s.key === 'speed')!
  const movementFeet = Math.max(5, speedRow.value * 5)

  const EV_ROWS: { key: EvStatKey; label: string; ev: number }[] = [
    { key: 'hp', label: 'HP', ev: evs.hp },
    ...statRows.map((s) => ({ key: s.key as EvStatKey, label: s.label, ev: s.ev })),
  ]

  async function handleAssign(stat: EvStatKey) {
    setAssignError(null)
    const result = await assignPokemonEv(pokemonId, stat)
    if ('error' in result) {
      setAssignError(result.error)
      return
    }
    setEv(stat, result.ev)
    setCurrentHp(result.currentHp)
    const newEvsSpent = evsSpent - evs[stat] + result.ev
    if (newEvsSpent >= evsAvailable) {
      setAssignOpen(false)
    }
  }

  function openEditPanel() {
    setDraftEvs(evs)
    setEditError(null)
    setEditOpen(true)
  }

  function cancelEditPanel() {
    setDraftEvs(evs)
    setEditError(null)
    setEditOpen(false)
  }

  async function handleSaveEvs() {
    setEditError(null)
    const result = await setPokemonEvs(pokemonId, draftEvs)
    if ('error' in result) {
      setEditError(result.error)
      return
    }
    setEvs(result.evs)
    setCurrentHp(result.currentHp)
    setEditOpen(false)
  }

  return (
    <section className="rounded border p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="font-semibold">Stats</h2>
        <p className="text-xs text-neutral-500">
          EVs: {evsSpent} / {evsAvailable} available (1 per 8 levels, max {MAX_EV_PER_STAT}/stat)
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-neutral-500">
              <th className="pr-2">Stat</th>
              <th className="pr-2">Value</th>
              <th className="pr-2">Modifier</th>
              <th>EV</th>
            </tr>
          </thead>
          <tbody>
            {statRows.map((s) => (
              <tr key={s.key}>
                <td className="pr-2">{s.label}</td>
                <td className="pr-2">
                  <ClickTooltip
                    label={String(s.value)}
                    tooltip={[
                      `Base: ${s.base}`,
                      ...(s.ev !== 0 ? [`EV: ${formatSigned(s.ev)}`] : []),
                      ...(s.natureAdjust !== 0 ? [`Nature: ${formatSigned(s.natureAdjust)}`] : []),
                      ...(s.passiveBonus !== 0 ? [`Passive: ${formatSigned(s.passiveBonus)}`] : []),
                      ...(s.inBattle !== 0 ? [`In battle: ${formatSigned(s.inBattle)}`] : []),
                      `Total: ${s.value}`,
                    ].join('\n')}
                  />
                </td>
                <td className="pr-2">
                  {s.modifier >= 0 ? '+' : ''}
                  {s.modifier}
                  {s.key === 'speed' && ` (${movementFeet} ft.)`}
                </td>
                <td className="text-xs text-neutral-500">
                  {s.ev}/{MAX_EV_PER_STAT}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(isOwner && (evsSpent < evsAvailable || assignOpen)) || (isGM && !editOpen) ? (
        <div className="mt-3 flex gap-2 border-t pt-3">
          {isOwner &&
            (evsSpent < evsAvailable || assignOpen) &&
            (assignOpen ? (
              <button type="button" onClick={() => setAssignOpen(false)} className="rounded border px-3 py-1 text-sm">
                Done
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setAssignError(null)
                  setAssignOpen(true)
                }}
                className="rounded border px-3 py-1 text-sm"
              >
                Assign EV&apos;s
              </button>
            ))}
          {isGM && !editOpen && (
            <button type="button" onClick={openEditPanel} className="rounded border px-3 py-1 text-sm">
              Edit EV&apos;s
            </button>
          )}
        </div>
      ) : null}

      {assignOpen && (
        <div className="mt-3 border-t pt-3">
          <p className="mb-2 text-xs text-neutral-500">
            {Math.max(0, evsAvailable - evsSpent)} of {evsAvailable} EVs available to assign
          </p>
          <ul className="flex flex-col gap-2">
            {EV_ROWS.map((row) => (
              <li key={row.key} className="flex items-center justify-between text-sm">
                <span>
                  {row.label} ({row.ev}/{MAX_EV_PER_STAT})
                </span>
                <button
                  type="button"
                  onClick={() => handleAssign(row.key)}
                  disabled={row.ev >= MAX_EV_PER_STAT || evsSpent >= evsAvailable}
                  className="rounded border border-blue-600 px-2 py-1 text-xs font-semibold text-blue-600 disabled:opacity-30"
                >
                  Assign
                </button>
              </li>
            ))}
          </ul>
          {assignError && <p className="mt-2 text-xs text-red-600">{assignError}</p>}
        </div>
      )}

      {editOpen && (
        <div className="mt-3 flex flex-col gap-2 border-t pt-3 text-sm">
          <p className="text-xs text-neutral-500">
            Redistribute EVs (max {MAX_EV_PER_STAT}/stat, {evsAvailable} total at this level)
          </p>
          {EV_ROWS.map((row) => (
            <label key={row.key} className="flex items-center justify-between gap-2">
              {row.label}
              <select
                value={draftEvs[row.key]}
                onChange={(e) => setDraftEvs((prev) => ({ ...prev, [row.key]: Number(e.target.value) }))}
                className="rounded border p-1"
              >
                {Array.from({ length: MAX_EV_PER_STAT + 1 }, (_, n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <div className="mt-1 flex gap-2">
            <button type="button" onClick={handleSaveEvs} className="rounded bg-black px-4 py-2 text-white">
              Save
            </button>
            <button type="button" onClick={cancelEditPanel} className="rounded border px-4 py-2">
              Cancel
            </button>
          </div>
          {editError && <p className="text-xs text-red-600">{editError}</p>}
        </div>
      )}
    </section>
  )
}

export function MovesSection() {
  const {
    pokemonId,
    isEditingMoves,
    knownMoves,
    fullLearnset,
    statRows,
    effectiveType1,
    effectiveType2,
    level,
    addKnownMove,
    removeKnownMove,
    updateMoveUses,
  } = usePokemonState()

  const [error, setError] = useState<string | null>(null)

  const knownMoveIds = knownMoves.map((km) => km.move_id)

  // Same uses-tier-then-STAB sort as before, just recomputed from local state instead of once at
  // request time.
  const sortedKnownMoves = [...knownMoves].sort((a, b) => {
    const usesA = parseMoveFrequency(a.moves.frequency).maxUses ?? Infinity
    const usesB = parseMoveFrequency(b.moves.frequency).maxUses ?? Infinity
    if (usesA !== usesB) return usesB - usesA
    return (
      stabBonus(b.moves.types?.name, effectiveType1, effectiveType2) - stabBonus(a.moves.types?.name, effectiveType1, effectiveType2)
    )
  })

  // fullLearnset carries the species' entire learnset regardless of level (unlike the old
  // level-filtered query) so a level-up from Add Exp can reveal newly-eligible moves here without
  // a fresh request.
  const learnableMoves = fullLearnset.filter((r) => (r.level_learned === null || r.level_learned <= level) && !knownMoveIds.includes(r.move.id))

  async function handleUse(moveId: number, target: number) {
    setError(null)
    const result = await setMoveUsesRemaining(pokemonId, moveId, target)
    if ('error' in result) {
      setError(result.error)
      return
    }
    updateMoveUses(moveId, result.usesRemaining)
  }

  async function handleLearn(moveId: number) {
    setError(null)
    const result = await learnMove(pokemonId, moveId)
    if ('error' in result) {
      setError(result.error)
      return
    }
    const entry = fullLearnset.find((r) => r.move.id === moveId)
    if (!entry) return
    addKnownMove({ move_id: moveId, uses_remaining: result.usesRemaining, resets_on: result.resetsOn, moves: entry.move })
  }

  async function handleForget(moveId: number) {
    setError(null)
    const result = await forgetMove(pokemonId, moveId)
    if (result?.error) {
      setError(result.error)
      return
    }
    removeKnownMove(moveId)
  }

  return (
    <section className="rounded border p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold">Moves</h2>
        {isEditingMoves ? (
          <Link href={`/pokemon/${pokemonId}`} className="rounded border px-3 py-1 text-sm">
            Done
          </Link>
        ) : (
          <Link href={`/pokemon/${pokemonId}?editMoves=1`} className="rounded border px-3 py-1 text-sm">
            Edit
          </Link>
        )}
      </div>
      {knownMoves.length === 0 ? (
        <p className="text-sm text-neutral-500">No moves known yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sortedKnownMoves.map((km) => {
            const move = km.moves
            const toHit = modifierForDamageStat(move.damage_stat, statRows)
            const stab = stabBonus(move.types?.name, effectiveType1, effectiveType2)
            const damageModifier = toHit + stab
            const { maxUses } = parseMoveFrequency(move.frequency)
            const slotCount = maxUses ?? km.uses_remaining ?? 0
            const usedCount = km.uses_remaining !== null ? slotCount - km.uses_remaining : 0
            const damageTitle = move.damage_dice
              ? [
                  `Base damage: ${move.damage_dice}`,
                  ...(toHit !== 0 ? [`Stat bonus: ${formatSigned(toHit)}`] : []),
                  ...(stab > 0 ? [`STAB: +${stab}`] : []),
                ].join('\n')
              : undefined
            return (
              <li key={km.move_id} className="rounded border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium">{move.name}</span>
                    {move.types?.name && <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs">{move.types.name}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    {km.uses_remaining !== null ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleUse(km.move_id, slotCount - (usedCount + 1))}
                          disabled={usedCount >= slotCount}
                          className="rounded border border-blue-600 px-2 py-0.5 text-xs font-semibold text-blue-600 disabled:opacity-30"
                        >
                          Use
                        </button>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: slotCount }, (_, slot) => {
                            const isUsed = slot < usedCount
                            // Each box only ever toggles its OWN state by ±1 -- checking any one
                            // unchecked box consumes exactly 1 use, unchecking any one checked box
                            // restores exactly 1, regardless of which position was clicked.
                            const target = isUsed ? slotCount - (usedCount - 1) : slotCount - (usedCount + 1)
                            return (
                              <button
                                key={slot}
                                type="button"
                                onClick={() => handleUse(km.move_id, target)}
                                aria-label={isUsed ? 'Mark use available' : 'Mark use consumed'}
                                className={`flex h-5 w-5 items-center justify-center rounded border text-xs leading-none ${
                                  isUsed ? 'border-blue-600 bg-blue-600 text-white' : 'border-neutral-400 text-transparent'
                                }`}
                              >
                                ✓
                              </button>
                            )
                          })}
                        </div>
                      </>
                    ) : (
                      <span className="text-xs text-neutral-500">At will</span>
                    )}
                    {isEditingMoves && (
                      <button
                        type="button"
                        onClick={() => handleForget(km.move_id)}
                        className="rounded border border-red-600 px-2 py-0.5 text-xs text-red-600"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-1 text-sm">
                  To hit: {toHit >= 0 ? '+' : ''}
                  {toHit}
                </p>
                {move.damage_dice && (
                  <p className="text-sm">
                    Damage:{' '}
                    <ClickTooltip label={`${move.damage_dice} ${damageModifier >= 0 ? '+' : ''}${damageModifier}`} tooltip={damageTitle!} />
                  </p>
                )}
                <details className="mt-1">
                  <summary className="cursor-pointer text-xs text-neutral-500">
                    {move.range} · {move.damage_stat.replace('_', ' ')} · {move.frequency}
                  </summary>
                  {move.description && <p className="mt-1 text-sm text-neutral-500">{move.description}</p>}
                </details>
              </li>
            )
          })}
        </ul>
      )}
      <p className="mt-2 text-xs text-neutral-500">
        {knownMoveIds.length} / {MAX_KNOWN_MOVES} moves known.
      </p>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      {isEditingMoves && (
        <div className="mt-4 border-t pt-4">
          <h3 className="mb-2 text-sm font-semibold">Learn a Move</h3>
          {learnableMoves.length === 0 ? (
            <p className="text-sm text-neutral-500">No new moves available to learn right now.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {learnableMoves.map(({ level_learned, move }) => (
                <li key={move.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-3">
                  <div>
                    <p className="font-medium">
                      {move.name}{' '}
                      <span className="text-xs font-normal text-neutral-500">
                        ({level_learned === null ? 'always known' : `level ${level_learned}`})
                      </span>
                    </p>
                    <p className="text-xs text-neutral-500">
                      {move.range} · {move.types?.name} · {move.damage_stat.replace('_', ' ')} · {move.frequency}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleLearn(move.id)}
                    disabled={knownMoveIds.length >= MAX_KNOWN_MOVES}
                    className="rounded border px-3 py-1 text-sm disabled:opacity-30"
                  >
                    Learn
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
