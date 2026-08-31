'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { statModifier } from '@/lib/pta3/pointBuy'
import { parseMoveFrequency } from '@/lib/pta3/moveFrequency'
import { EV_STAT_COLUMNS, MAX_EV_PER_STAT, type EvStatKey } from '@/lib/pta3/pokemonEv'
import type { EvolutionTarget, ChainMember, EvolutionStoneBagItem } from '@/lib/pta3/evolution'
import { ClickTooltip } from '@/components/ClickTooltip'
import { PokemonSprite } from '@/components/PokemonSprite'
import {
  adjustPokemonHp,
  grantPokemonTemporaryHp,
  clearPokemonTemporaryHp,
  addPokemonExp,
  addPokemonLoyaltyPoints,
  assignPokemonEv,
  setPokemonEvs,
  setMoveUsesRemaining,
  learnMove,
  forgetMove,
  grantMoveEligibility,
  addAffliction,
  removeAffliction,
  learnPassive,
  unlearnPassive,
  previewEvolution,
  evolvePokemon,
  giftPokemon,
} from '../actions'

export type GiftableTrainer = { id: string; name: string; is_npc: boolean }

const MAX_KNOWN_MOVES = 6
// Player's Handbook rule (README.md:93-94): max 3 active Stat Passives per Pokemon, one per
// category.
const MAX_STAT_PASSIVES = 3

function formatSigned(n: number) {
  return `${n >= 0 ? '+' : ''}${n}`
}

// Same rule as STAB elsewhere -- +4 damage when a move's type matches either of the Pokemon's own
// (effective, override-aware) types.
function stabBonus(moveTypeName: string | undefined, type1?: string, type2?: string) {
  return moveTypeName && (moveTypeName === type1 || moveTypeName === type2) ? 4 : 0
}

export type TypeMatchupInfo = {
  attacking_type: string
  defending_type: string
  modifier: number
}

// [[Bug - Double check immunities in type effectiveness]]: presence-only pairs, deliberately not
// folded into TypeMatchupInfo/type_matchups -- see effectivenessFor's comment for why immunity can't
// be represented as just another modifier value in that additive system.
export type TypeImmunityInfo = {
  attacking_type: string
  defending_type: string
}

export type SpeciesTypeInfo = {
  name: string
  sprite_code: string
  type_1: { name: string } | null
  type_2: { name: string } | null
}

// Player's Handbook rule (page 122): NOT a mainline-style HP multiplier -- effectiveness adds or
// subtracts DICE from the damage roll. Each of the move's type vs. each of the DEFENDING (target's)
// types contributes -1 (resisted) / 0 (neutral, unlisted in typeMatchups) / +1 (super-effective); a
// dual-type target sums both contributions, clamped to the -2..+2 die range the rule describes
// (extremely-effective/super-effective/neutral/resisted/shielded). `defType1`/`defType2` are the
// user-picked opponent types (see TargetPicker), deliberately NOT the attacking Pokemon's own
// effectiveType1/2 -- that's STAB's job, a different thing being calculated from different inputs.
// Skipped entirely for 'Special/Variable'-typed moves (their real type is chosen at time of use, not
// stored) or when no target type has been picked yet.
//
// [[Bug - Double check immunities in type effectiveness]]: true immunity (e.g. Normal vs. Ghost) is
// checked FIRST, before any of the above summing, and short-circuits straight to a 0-damage result --
// it can't be folded into the sum-then-clamp math above, because that system is additive (a dual-type
// defender's two scores add together) while real immunity is multiplicative (0x always wins regardless
// of the other type). A Normal move vs. a Ghost/Steel dual-type must stay 0 damage even though Steel is
// merely neutral to Normal, which summing the two could never express.
function effectivenessFor(
  moveTypeName: string | undefined,
  defType1: string | undefined,
  defType2: string | undefined,
  typeMatchups: TypeMatchupInfo[],
  typeImmunities: TypeImmunityInfo[],
) {
  if (!moveTypeName || moveTypeName === 'Special/Variable' || !defType1) return null
  const isImmune = (defType: string | undefined) =>
    !!defType && typeImmunities.some((i) => i.attacking_type === moveTypeName && i.defending_type === defType)
  if (isImmune(defType1) || isImmune(defType2)) {
    return { dice: 0, label: 'Immune', immune: true }
  }
  const scoreAgainst = (defType: string | undefined) => {
    if (!defType) return 0
    return typeMatchups.find((m) => m.attacking_type === moveTypeName && m.defending_type === defType)?.modifier ?? 0
  }
  const total = scoreAgainst(defType1) + scoreAgainst(defType2)
  const dice = Math.max(-2, Math.min(2, total))
  if (dice === 0) return null
  const label = dice === 2 ? 'Extremely effective' : dice === 1 ? 'Super effective' : dice === -1 ? 'Resisted' : 'Shielded'
  return { dice, label, immune: false }
}

// A move's damage_dice is always "<count>d<sides>" (e.g. "2d6"). Effectiveness changes the dice
// COUNT, not the modifier added to the roll -- floored at 1 die, since a move can't roll zero or
// negative dice.
function adjustDiceCount(diceNotation: string, delta: number) {
  const match = diceNotation.match(/^(\d+)d(\d+)$/)
  if (!match || delta === 0) return diceNotation
  const count = Math.max(1, parseInt(match[1], 10) + delta)
  return `${count}d${match[2]}`
}

// Ephemeral, per-page "what am I fighting" reference -- plain local state, never persisted (see
// [[Add an opponent type selector for move effectiveness]]). Two manually-set dropdowns, plus a
// species search that's purely a shortcut to fill them in; the dropdowns stay editable afterward for
// homebrew/override-typed opponents the Pokédex doesn't know about.
function TargetTypePicker({
  allTypeNames,
  speciesList,
  defType1,
  defType2,
  onChangeDefType1,
  onChangeDefType2,
}: {
  allTypeNames: string[]
  speciesList: SpeciesTypeInfo[]
  defType1: string
  defType2: string
  onChangeDefType1: (v: string) => void
  onChangeDefType2: (v: string) => void
}) {
  const [searchText, setSearchText] = useState('')
  const needle = searchText.trim().toLowerCase()
  const matches = needle ? speciesList.filter((s) => s.name.toLowerCase().includes(needle)).slice(0, 8) : []

  function pickSpecies(s: SpeciesTypeInfo) {
    onChangeDefType1(s.type_1?.name ?? '')
    onChangeDefType2(s.type_2?.name ?? '')
    setSearchText('')
  }

  return (
    <div className="mb-3 flex flex-col gap-2 rounded border border-accent bg-accent/10 p-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">Against:</span>
        <select value={defType1} onChange={(e) => onChangeDefType1(e.target.value)} className="rounded border px-2 py-1">
          <option value="">Type 1</option>
          {allTypeNames.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select value={defType2} onChange={(e) => onChangeDefType2(e.target.value)} className="rounded border px-2 py-1">
          <option value="">Type 2</option>
          {allTypeNames.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        {(defType1 || defType2) && (
          <button
            type="button"
            onClick={() => {
              onChangeDefType1('')
              onChangeDefType2('')
            }}
            className="text-xs text-muted underline"
          >
            Clear
          </button>
        )}
      </div>
      <div className="relative">
        <input
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Or search a species to fill in its types..."
          className="w-full rounded border px-2 py-1"
        />
        {matches.length > 0 && (
          <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded border bg-surface shadow">
            {matches.map((s) => (
              <li key={s.name}>
                <button
                  type="button"
                  onClick={() => pickSpecies(s)}
                  className="flex w-full items-center gap-2 px-2 py-1 text-left hover:bg-surface-muted"
                >
                  <PokemonSprite spriteCode={s.sprite_code} alt={s.name} size={24} />
                  <span>{s.name}</span>
                  <span className="text-xs text-muted">{[s.type_1?.name, s.type_2?.name].filter(Boolean).join(' / ')}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
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
  // [[Let a GM force-teach any Move]]: a grant entry (from pokemon_move_grants, always
  // level_learned: null) is tagged so the Learn picker can show "(GM-granted)" instead of
  // "(always known)" and so a grant merged onto an existing too-high-level natural entry still
  // reads as GM-granted rather than silently losing that context.
  granted?: boolean
}

export type AfflictionInfo = {
  id: number
  name: string
  description: string | null
  stats: { modifier: number; statName: string }[]
}

export type PassiveInfo = {
  id: number
  name: string
  description: string | null
  category: string | null
  passives_stats: { modifier: number; stats: { name: string } | null }[]
}

export type KnownPassiveEntry = {
  passive_id: number
  passives: PassiveInfo
}

export type PassiveLearnsetEntry = {
  level_learned: number | null
  passives: PassiveInfo
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
  afflictionBonusByStat: Record<string, number>,
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
    const afflictionBonus = afflictionBonusByStat[s.label] ?? 0
    const inBattle = 0 // No in-combat temporary-modifier tracking exists yet; always displayed as 0.
    const value = s.base + s.ev + natureAdjust + passiveBonus + afflictionBonus + inBattle
    return { ...s, natureAdjust, passiveBonus, afflictionBonus, inBattle, value, modifier: statModifier(value) }
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
  basePath: string
  isOwner: boolean
  isGM: boolean
  effectiveType1?: string
  effectiveType2?: string
  typeMatchups: TypeMatchupInfo[]
  typeImmunities: TypeImmunityInfo[]
  speciesList: SpeciesTypeInfo[]
  allTypeNames: string[]
  level: number
  effectiveExp: number
  currentExp: number
  currentHp: number
  temporaryHp: number
  evs: Record<EvStatKey, number>
  knownMoves: KnownMoveEntry[]
  fullLearnset: LearnsetEntry[]
  grantedLearnset: LearnsetEntry[]
  moveCatalog: MoveInfo[]
  isEditingMoves: boolean
  allAfflictions: AfflictionInfo[]
  activeAfflictionIds: number[]
  abilityPassives: PassiveInfo[]
  knownStatPassives: KnownPassiveEntry[]
  statPassiveLearnset: PassiveLearnsetEntry[]
  isEditingPassives: boolean
  species: SpeciesStats
  growthRateName: string | null
  growthRateModifier: number
  obtainMethodName: string | null
  obtainMethodModifier: number
  loyaltyPoints: number
  loyaltyName: string | null
  loyaltyModifier: number
  isShiny: boolean
  evolutionTargets: EvolutionTarget[]
  chainMembers: ChainMember[]
  isMaxLoyaltyPokemon: boolean
  bagStoneItems: EvolutionStoneBagItem[]
  giftableTrainers: GiftableTrainer[]
  originalTrainerId: string | null
  originalObtainMethodName: string | null
  statRows: StatRows
  evsAvailable: number
  evsSpent: number
  setCurrentHp: (v: number) => void
  setTemporaryHp: (v: number) => void
  setExp: (v: { currentExp: number; effectiveExp: number; level: number }) => void
  setLoyalty: (v: { loyaltyPoints: number; loyaltyName: string | null; loyaltyModifier: number; level: number; effectiveExp: number }) => void
  setEv: (stat: EvStatKey, value: number) => void
  setEvs: (evs: Record<EvStatKey, number>) => void
  addKnownMove: (entry: KnownMoveEntry) => void
  removeKnownMove: (moveId: number) => void
  updateMoveUses: (moveId: number, usesRemaining: number) => void
  addGrantedMove: (entry: LearnsetEntry) => void
  setAfflictionActive: (afflictionId: number, isActive: boolean) => void
  addKnownPassive: (entry: KnownPassiveEntry) => void
  removeKnownPassive: (passiveId: number) => void
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
  basePath: string
  isOwner: boolean
  isGM: boolean
  effectiveType1?: string
  effectiveType2?: string
  typeMatchups: TypeMatchupInfo[]
  typeImmunities: TypeImmunityInfo[]
  speciesList: SpeciesTypeInfo[]
  allTypeNames: string[]
  initialLevel: number
  initialEffectiveExp: number
  initialCurrentExp: number
  initialCurrentHp: number
  initialTemporaryHp: number
  initialEvs: Record<EvStatKey, number>
  species: SpeciesStats
  natureIncreasedName: string | null
  natureDecreasedName: string | null
  initialKnownMoves: KnownMoveEntry[]
  fullLearnset: LearnsetEntry[]
  initialGrantedLearnset: LearnsetEntry[]
  moveCatalog: MoveInfo[]
  isEditingMoves: boolean
  allAfflictions: AfflictionInfo[]
  initialActiveAfflictionIds: number[]
  abilityPassives: PassiveInfo[]
  initialKnownStatPassives: KnownPassiveEntry[]
  statPassiveLearnset: PassiveLearnsetEntry[]
  isEditingPassives: boolean
  growthRateName: string | null
  growthRateModifier: number
  obtainMethodName: string | null
  obtainMethodModifier: number
  initialLoyaltyPoints: number
  initialLoyaltyName: string | null
  initialLoyaltyModifier: number
  isShiny: boolean
  evolutionTargets: EvolutionTarget[]
  chainMembers: ChainMember[]
  isMaxLoyaltyPokemon: boolean
  bagStoneItems: EvolutionStoneBagItem[]
  giftableTrainers: GiftableTrainer[]
  originalTrainerId: string | null
  originalObtainMethodName: string | null
  children: ReactNode
}) {
  const [level, setLevel] = useState(props.initialLevel)
  const [effectiveExp, setEffectiveExp] = useState(props.initialEffectiveExp)
  const [currentExp, setCurrentExp] = useState(props.initialCurrentExp)
  const [currentHp, setCurrentHpState] = useState(props.initialCurrentHp)
  const [temporaryHp, setTemporaryHpState] = useState(props.initialTemporaryHp)
  const [loyaltyPoints, setLoyaltyPoints] = useState(props.initialLoyaltyPoints)
  const [loyaltyName, setLoyaltyName] = useState(props.initialLoyaltyName)
  const [loyaltyModifier, setLoyaltyModifier] = useState(props.initialLoyaltyModifier)
  const [evs, setEvsState] = useState(props.initialEvs)
  const [knownMoves, setKnownMoves] = useState(props.initialKnownMoves)
  const [grantedLearnset, setGrantedLearnset] = useState(props.initialGrantedLearnset)
  const [activeAfflictionIds, setActiveAfflictionIds] = useState(props.initialActiveAfflictionIds)
  const [knownStatPassives, setKnownStatPassives] = useState(props.initialKnownStatPassives)

  // Recomputed from the live activeAfflictionIds set (not a static server-computed map) so toggling
  // an affliction updates the Stats section immediately, same as an EV change already does -- no
  // reload, no re-fetch.
  const afflictionBonusByStat: Record<string, number> = {}
  for (const a of props.allAfflictions) {
    if (!activeAfflictionIds.includes(a.id)) continue
    for (const s of a.stats) {
      afflictionBonusByStat[s.statName] = (afflictionBonusByStat[s.statName] ?? 0) + s.modifier
    }
  }

  // Same reactive-not-static shape as afflictionBonusByStat, and for the same reason -- learning or
  // removing a Stat Passive now updates the Stats section immediately, rather than requiring a
  // reload (which was never even wired up before this fix, since nothing wrote to pokemon_passives).
  const passiveBonusByStat: Record<string, number> = {}
  for (const kp of knownStatPassives) {
    for (const ps of kp.passives.passives_stats) {
      const statName = ps.stats?.name
      if (!statName) continue
      passiveBonusByStat[statName] = (passiveBonusByStat[statName] ?? 0) + ps.modifier
    }
  }

  const statRows = computeStatRows(
    props.species,
    evs,
    props.natureIncreasedName,
    props.natureDecreasedName,
    passiveBonusByStat,
    afflictionBonusByStat,
  )
  const evsAvailable = Math.floor(level / 8)
  const evsSpent = Object.values(evs).reduce((a, b) => a + b, 0)

  const value: PokemonStateValue = {
    pokemonId: props.pokemonId,
    basePath: props.basePath,
    isOwner: props.isOwner,
    isGM: props.isGM,
    effectiveType1: props.effectiveType1,
    effectiveType2: props.effectiveType2,
    typeMatchups: props.typeMatchups,
    typeImmunities: props.typeImmunities,
    speciesList: props.speciesList,
    allTypeNames: props.allTypeNames,
    level,
    effectiveExp,
    currentExp,
    currentHp,
    temporaryHp,
    evs,
    knownMoves,
    fullLearnset: props.fullLearnset,
    grantedLearnset,
    moveCatalog: props.moveCatalog,
    isEditingMoves: props.isEditingMoves,
    allAfflictions: props.allAfflictions,
    activeAfflictionIds,
    abilityPassives: props.abilityPassives,
    knownStatPassives,
    statPassiveLearnset: props.statPassiveLearnset,
    isEditingPassives: props.isEditingPassives,
    species: props.species,
    growthRateName: props.growthRateName,
    growthRateModifier: props.growthRateModifier,
    obtainMethodName: props.obtainMethodName,
    obtainMethodModifier: props.obtainMethodModifier,
    loyaltyPoints,
    loyaltyName,
    loyaltyModifier,
    isShiny: props.isShiny,
    evolutionTargets: props.evolutionTargets,
    chainMembers: props.chainMembers,
    isMaxLoyaltyPokemon: props.isMaxLoyaltyPokemon,
    bagStoneItems: props.bagStoneItems,
    giftableTrainers: props.giftableTrainers,
    originalTrainerId: props.originalTrainerId,
    originalObtainMethodName: props.originalObtainMethodName,
    statRows,
    evsAvailable,
    evsSpent,
    setCurrentHp: setCurrentHpState,
    setTemporaryHp: setTemporaryHpState,
    setExp: ({ currentExp, effectiveExp, level }) => {
      setCurrentExp(currentExp)
      setEffectiveExp(effectiveExp)
      setLevel(level)
    },
    setLoyalty: ({ loyaltyPoints, loyaltyName, loyaltyModifier, level, effectiveExp }) => {
      setLoyaltyPoints(loyaltyPoints)
      setLoyaltyName(loyaltyName)
      setLoyaltyModifier(loyaltyModifier)
      setLevel(level)
      setEffectiveExp(effectiveExp)
    },
    setEv: (stat, val) => setEvsState((prev) => ({ ...prev, [stat]: val })),
    setEvs: (newEvs) => setEvsState(newEvs),
    addKnownMove: (entry) => setKnownMoves((prev) => [...prev, entry]),
    removeKnownMove: (moveId) => setKnownMoves((prev) => prev.filter((km) => km.move_id !== moveId)),
    updateMoveUses: (moveId, usesRemaining) =>
      setKnownMoves((prev) => prev.map((km) => (km.move_id === moveId ? { ...km, uses_remaining: usesRemaining } : km))),
    addGrantedMove: (entry) => setGrantedLearnset((prev) => [...prev, entry]),
    setAfflictionActive: (afflictionId, isActive) =>
      setActiveAfflictionIds((prev) => (isActive ? [...prev, afflictionId] : prev.filter((id) => id !== afflictionId))),
    addKnownPassive: (entry) => setKnownStatPassives((prev) => [...prev, entry]),
    removeKnownPassive: (passiveId) => setKnownStatPassives((prev) => prev.filter((kp) => kp.passive_id !== passiveId)),
  }

  return <PokemonStateContext.Provider value={value}>{props.children}</PokemonStateContext.Provider>
}

export function LevelLine() {
  const { level, effectiveType1, effectiveType2 } = usePokemonState()
  return (
    <p className="text-sm text-muted">
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
    <section className="rounded border border-accent bg-accent/10 p-4">
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
      </div>

      <div className="mt-3 flex items-center gap-2 border-t pt-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => handleAdjust(1)}
          className="rounded border border-success px-3 py-2 text-sm font-semibold text-success disabled:opacity-30"
        >
          Add Exp
        </button>
        <input
          type="number"
          min={0}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="bg-surface-subtle w-24 rounded border p-2 text-center"
        />
        <button
          type="button"
          disabled={pending}
          onClick={() => handleAdjust(-1)}
          className="rounded border border-danger px-3 py-2 text-sm font-semibold text-danger disabled:opacity-30"
        >
          Remove Exp
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </section>
  )
}

// Mirrors ExperienceSection's exact shape ((pokemonId, sign, amount) action, GM-only, Add/Remove
// buttons + a typed amount), per [[Add a Loyalty editor]] -- LP replaces the old force-a-tier
// Loyalty <select>. A change here can also shift Level (LP feeds the exp-to-level formula via
// loyaltyModifier), so setLoyalty updates both in one go.
export function LoyaltySection() {
  const { isGM, pokemonId, loyaltyPoints, loyaltyName, loyaltyModifier, setLoyalty } = usePokemonState()
  const [amount, setAmount] = useState(0)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isGM) return null

  async function handleAdjust(sign: 1 | -1) {
    setPending(true)
    setError(null)
    const result = await addPokemonLoyaltyPoints(pokemonId, sign, amount)
    setPending(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setLoyalty(result)
    setAmount(0)
  }

  return (
    <section className="rounded border border-accent bg-accent/10 p-4">
      <h2 className="mb-2 font-semibold">Loyalty</h2>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <p>Loyalty points: {loyaltyPoints}</p>
        <p>
          Tier: {loyaltyName ?? '—'} (×{loyaltyModifier})
        </p>
      </div>

      <div className="mt-3 flex items-center gap-2 border-t pt-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => handleAdjust(1)}
          className="rounded border border-success px-3 py-2 text-sm font-semibold text-success disabled:opacity-30"
        >
          Add LP
        </button>
        <input
          type="number"
          min={0}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="bg-surface-subtle w-24 rounded border p-2 text-center"
        />
        <button
          type="button"
          disabled={pending}
          onClick={() => handleAdjust(-1)}
          className="rounded border border-danger px-3 py-2 text-sm font-semibold text-danger disabled:opacity-30"
        >
          Remove LP
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </section>
  )
}

// [[Let Temporary HP actually be set]]: Grant adds to whatever Temp HP already exists (stacks from
// multiple sources) rather than replacing it. Damage now spends Temp HP first, down to a floor of
// 0, before touching current HP at all -- adjustPokemonHp's own return carries both resulting
// values so a single click updates both without a refetch. Clear is the manual "fight's over"
// button; Temp HP also clears automatically on the next Sleep/Pokemon Center rest as a backstop.
export function HpSection() {
  const { pokemonId, currentHp, temporaryHp, species, evs, setCurrentHp, setTemporaryHp } = usePokemonState()
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
    setTemporaryHp(result.temporaryHp)
    setAmount(0)
  }

  async function handleGrant() {
    setPending(true)
    setError(null)
    const result = await grantPokemonTemporaryHp(pokemonId, amount)
    setPending(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setTemporaryHp(result.temporaryHp)
    setAmount(0)
  }

  async function handleClear() {
    setPending(true)
    setError(null)
    const result = await clearPokemonTemporaryHp(pokemonId)
    setPending(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setTemporaryHp(result.temporaryHp)
  }

  return (
    <section className="rounded border border-accent bg-accent/10 p-4">
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
        <p className="text-xs uppercase tracking-wide text-muted">Hit Points</p>
        {temporaryHp > 0 && <p className="text-sm text-muted">+{temporaryHp} temp</p>}
      </div>
      <div className="flex flex-col gap-2">
        <input
          type="number"
          min={0}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="bg-surface-subtle w-full rounded border p-2 text-center"
        />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => handleAdjust(1)}
            className="flex-1 rounded border border-success px-3 py-2 text-sm font-semibold text-success disabled:opacity-30"
          >
            Heal
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => handleAdjust(-1)}
            className="flex-1 rounded border border-danger px-3 py-2 text-sm font-semibold text-danger disabled:opacity-30"
          >
            Damage
          </button>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={handleGrant}
            className="flex-1 rounded border border-accent px-3 py-2 text-sm font-semibold text-accent disabled:opacity-30"
          >
            Grant Temp HP
          </button>
          {temporaryHp > 0 && (
            <button
              type="button"
              disabled={pending}
              onClick={handleClear}
              className="flex-1 rounded border px-3 py-2 text-sm disabled:opacity-30"
            >
              Clear Temp HP
            </button>
          )}
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
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
  // [[Warn a GM before overwriting a Trainer's own build choices]]: a GM redistributing EVs on a
  // Pokemon they don't own is overwriting a choice the Trainer made themselves -- gated on
  // isGM && !isOwner (not on tracking who set the value), matching Evolve/Gift's confirm-panel shape.
  const [pendingEvsDiff, setPendingEvsDiff] = useState<{ key: EvStatKey; label: string; from: number; to: number }[] | null>(null)

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
    setPendingEvsDiff(null)
    setEditOpen(true)
  }

  function cancelEditPanel() {
    setDraftEvs(evs)
    setEditError(null)
    setEditOpen(false)
    setPendingEvsDiff(null)
  }

  async function commitEvs(nextEvs: Record<EvStatKey, number>) {
    setEditError(null)
    const result = await setPokemonEvs(pokemonId, nextEvs)
    if ('error' in result) {
      setEditError(result.error)
      return
    }
    setEvs(result.evs)
    setCurrentHp(result.currentHp)
    setPendingEvsDiff(null)
    setEditOpen(false)
  }

  function handleSaveEvs() {
    if (isGM && !isOwner) {
      const diff = EV_ROWS.filter((row) => draftEvs[row.key] !== evs[row.key]).map((row) => ({
        key: row.key,
        label: row.label,
        from: evs[row.key],
        to: draftEvs[row.key],
      }))
      if (diff.length > 0) {
        setPendingEvsDiff(diff)
        return
      }
    }
    commitEvs(draftEvs)
  }

  return (
    <section className="rounded border border-accent bg-accent/10 p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="font-semibold">Stats</h2>
        <p className="text-xs text-muted">
          EVs: {evsSpent} / {evsAvailable} available (1 per 8 levels, max {MAX_EV_PER_STAT}/stat)
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-muted">
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
                      ...(s.afflictionBonus !== 0 ? [`Affliction: ${formatSigned(s.afflictionBonus)}`] : []),
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
                <td className="text-xs text-muted">
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
          <p className="mb-2 text-xs text-muted">
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
                  className="rounded border border-accent px-2 py-1 text-xs font-semibold text-accent disabled:opacity-30"
                >
                  Assign
                </button>
              </li>
            ))}
          </ul>
          {assignError && <p className="mt-2 text-xs text-danger">{assignError}</p>}
        </div>
      )}

      {editOpen && (
        <div className="mt-3 flex flex-col gap-2 border-t pt-3 text-sm">
          {pendingEvsDiff ? (
            <>
              <p>This will change EVs the Trainer chose themselves:</p>
              <ul className="list-inside list-disc text-warning">
                {pendingEvsDiff.map((d) => (
                  <li key={d.key}>
                    {d.label}: {d.from} → {d.to}
                  </li>
                ))}
              </ul>
              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => commitEvs(draftEvs)}
                  className="rounded bg-accent px-4 py-2 text-accent-foreground"
                >
                  Confirm
                </button>
                <button type="button" onClick={() => setPendingEvsDiff(null)} className="rounded border px-4 py-2">
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-muted">
                Redistribute EVs (max {MAX_EV_PER_STAT}/stat, {evsAvailable} total at this level)
              </p>
              {EV_ROWS.map((row) => (
                <label key={row.key} className="flex items-center justify-between gap-2">
                  {row.label}
                  <select
                    value={draftEvs[row.key]}
                    onChange={(e) => setDraftEvs((prev) => ({ ...prev, [row.key]: Number(e.target.value) }))}
                    className="bg-surface-subtle rounded border p-1"
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
                <button type="button" onClick={handleSaveEvs} className="rounded bg-accent px-4 py-2 text-accent-foreground">
                  Save
                </button>
                <button type="button" onClick={cancelEditPanel} className="rounded border px-4 py-2">
                  Cancel
                </button>
              </div>
            </>
          )}
          {editError && <p className="text-xs text-danger">{editError}</p>}
        </div>
      )}
    </section>
  )
}

export function MovesSection() {
  const {
    pokemonId,
    basePath,
    isEditingMoves,
    isOwner,
    isGM,
    knownMoves,
    fullLearnset,
    grantedLearnset,
    statRows,
    effectiveType1,
    effectiveType2,
    typeMatchups,
    typeImmunities,
    speciesList,
    allTypeNames,
    level,
    addKnownMove,
    removeKnownMove,
    updateMoveUses,
  } = usePokemonState()

  const [error, setError] = useState<string | null>(null)
  const [relearnForMoveId, setRelearnForMoveId] = useState<number | null>(null)
  const [replaceMoveId, setReplaceMoveId] = useState('')
  const [defType1, setDefType1] = useState('')
  const [defType2, setDefType2] = useState('')
  // [[Warn a GM before overwriting a Trainer's own build choices]]: a GM forgetting a move on a
  // Pokemon they don't own is removing a move the Trainer chose to learn -- same isGM && !isOwner
  // gate as the EV warning above; the Trainer forgetting their own move is unaffected.
  const [confirmForgetMoveId, setConfirmForgetMoveId] = useState<number | null>(null)

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
  // a fresh request. grantedLearnset ([[Let a GM force-teach any Move]]) is merged in on top --
  // keyed by move id so a grant for a move that's ALSO a natural (but too-high-level) learnset
  // entry overrides that entry's gate rather than appearing twice, while a grant for a move outside
  // the species' learnset entirely just adds a new entry. Either way `granted: true` wins so the
  // picker always shows "(GM-granted)" for it, and eligibility below skips the level gate entirely.
  const learnsetById = new Map<number, LearnsetEntry>(fullLearnset.map((r) => [r.move.id, r]))
  for (const g of grantedLearnset) {
    learnsetById.set(g.move.id, { ...(learnsetById.get(g.move.id) ?? g), granted: true })
  }
  const mergedLearnset = [...learnsetById.values()]
  const learnableMoves = mergedLearnset.filter(
    (r) => (r.granted || r.level_learned === null || r.level_learned <= level) && !knownMoveIds.includes(r.move.id),
  )

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
    const entry = mergedLearnset.find((r) => r.move.id === moveId)
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
    setConfirmForgetMoveId(null)
    removeKnownMove(moveId)
  }

  function requestForget(moveId: number) {
    if (isGM && !isOwner) {
      setConfirmForgetMoveId(moveId)
      return
    }
    handleForget(moveId)
  }

  // At the 6-move cap, learning a new move means picking one of the 6 known moves to forget first --
  // forgetMove already leaves the old move in the species' learnset (still relearnable later), so this
  // just sequences the two existing actions rather than needing anything new.
  async function handleRelearn(newMoveId: number) {
    if (!replaceMoveId) return
    setError(null)
    const oldMoveId = Number(replaceMoveId)
    const forgetResult = await forgetMove(pokemonId, oldMoveId)
    if (forgetResult?.error) {
      setError(forgetResult.error)
      return
    }
    removeKnownMove(oldMoveId)
    const learnResult = await learnMove(pokemonId, newMoveId)
    if ('error' in learnResult) {
      setError(learnResult.error)
      return
    }
    const entry = mergedLearnset.find((r) => r.move.id === newMoveId)
    if (entry) {
      addKnownMove({ move_id: newMoveId, uses_remaining: learnResult.usesRemaining, resets_on: learnResult.resetsOn, moves: entry.move })
    }
    setRelearnForMoveId(null)
    setReplaceMoveId('')
  }

  return (
    <section className="rounded border border-accent bg-accent/10 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold">Moves</h2>
        {isEditingMoves ? (
          <Link href={basePath} className="rounded border px-3 py-1 text-sm">
            Done
          </Link>
        ) : (
          <Link href={`${basePath}?editMoves=1`} className="rounded border px-3 py-1 text-sm">
            Edit
          </Link>
        )}
      </div>
      {knownMoves.length > 0 && (
        <TargetTypePicker
          allTypeNames={allTypeNames}
          speciesList={speciesList}
          defType1={defType1}
          defType2={defType2}
          onChangeDefType1={setDefType1}
          onChangeDefType2={setDefType2}
        />
      )}
      {knownMoves.length === 0 ? (
        <p className="text-sm text-muted">No moves known yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sortedKnownMoves.map((km) => {
            const move = km.moves
            const toHit = modifierForDamageStat(move.damage_stat, statRows)
            const stab = stabBonus(move.types?.name, effectiveType1, effectiveType2)
            const damageModifier = toHit + stab
            const effectiveness = effectivenessFor(move.types?.name, defType1 || undefined, defType2 || undefined, typeMatchups, typeImmunities)
            const displayDice = move.damage_dice ? adjustDiceCount(move.damage_dice, effectiveness?.dice ?? 0) : move.damage_dice
            const { maxUses } = parseMoveFrequency(move.frequency)
            const slotCount = maxUses ?? km.uses_remaining ?? 0
            const usedCount = km.uses_remaining !== null ? slotCount - km.uses_remaining : 0
            const damageTitle = move.damage_dice
              ? [
                  `Base damage: ${move.damage_dice}`,
                  ...(toHit !== 0 ? [`Stat bonus: ${formatSigned(toHit)}`] : []),
                  ...(stab > 0 ? [`STAB: +${stab}`] : []),
                  ...(effectiveness?.immune
                    ? ['Effectiveness: Immune (0 damage)']
                    : effectiveness
                      ? [`Effectiveness: ${effectiveness.label} (${formatSigned(effectiveness.dice)} ${Math.abs(effectiveness.dice) === 1 ? 'die' : 'dice'})`]
                      : []),
                ].join('\n')
              : undefined
            return (
              <li key={km.move_id} className="rounded border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium">{move.name}</span>
                    {move.types?.name && <span className="rounded bg-surface-muted px-1.5 py-0.5 text-xs">{move.types.name}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    {km.uses_remaining !== null ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleUse(km.move_id, slotCount - (usedCount + 1))}
                          disabled={usedCount >= slotCount}
                          className="rounded border border-accent px-2 py-0.5 text-xs font-semibold text-accent disabled:opacity-30"
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
                                  isUsed ? 'border-accent bg-accent text-accent-foreground' : 'border text-transparent'
                                }`}
                              >
                                ✓
                              </button>
                            )
                          })}
                        </div>
                      </>
                    ) : (
                      <span className="text-xs text-muted">At will</span>
                    )}
                    {isEditingMoves &&
                      (confirmForgetMoveId === km.move_id ? (
                        <span className="flex items-center gap-1 text-xs">
                          <span className="text-warning" title="The Trainer chose to learn this.">
                            Forget {move.name}? The Trainer chose this.
                          </span>
                          <button
                            type="button"
                            onClick={() => handleForget(km.move_id)}
                            className="rounded border border-danger px-2 py-0.5 text-danger"
                          >
                            Confirm
                          </button>
                          <button type="button" onClick={() => setConfirmForgetMoveId(null)} className="rounded border px-2 py-0.5">
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => requestForget(km.move_id)}
                          className="rounded border border-danger px-2 py-0.5 text-xs text-danger"
                        >
                          Remove
                        </button>
                      ))}
                  </div>
                </div>
                <p className="mt-1 text-sm">
                  To hit: {toHit >= 0 ? '+' : ''}
                  {toHit}
                </p>
                {move.damage_dice && (
                  <p className="text-sm">
                    Damage:{' '}
                    <ClickTooltip
                      label={effectiveness?.immune ? 'Immune — 0 damage' : `${displayDice} ${damageModifier >= 0 ? '+' : ''}${damageModifier}`}
                      tooltip={damageTitle!}
                    />
                  </p>
                )}
                <details className="mt-1">
                  <summary className="cursor-pointer text-xs text-muted">
                    {move.range} · {move.damage_stat.replace('_', ' ')} · {move.frequency}
                  </summary>
                  {move.description && <p className="mt-1 text-sm text-muted">{move.description}</p>}
                </details>
              </li>
            )
          })}
        </ul>
      )}
      <p className="mt-2 text-xs text-muted">
        {knownMoveIds.length} / {MAX_KNOWN_MOVES} moves known.
      </p>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}

      {isEditingMoves && (
        <div className="mt-4 border-t pt-4">
          <h3 className="mb-2 text-sm font-semibold">Learn a Move</h3>
          {learnableMoves.length === 0 ? (
            <p className="text-sm text-muted">No new moves available to learn right now.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {learnableMoves.map(({ level_learned, move, granted }) => {
                const atCap = knownMoveIds.length >= MAX_KNOWN_MOVES
                const isRelearning = relearnForMoveId === move.id
                return (
                  <li key={move.id} className="flex flex-col gap-2 rounded border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">
                          {move.name}{' '}
                          <span className="text-xs font-normal text-muted">
                            ({granted ? 'GM-granted' : level_learned === null ? 'always known' : `level ${level_learned}`})
                          </span>
                        </p>
                        <p className="text-xs text-muted">
                          {move.range} · {move.types?.name} · {move.damage_stat.replace('_', ' ')} · {move.frequency}
                        </p>
                      </div>
                      {atCap ? (
                        <button
                          type="button"
                          onClick={() => {
                            setRelearnForMoveId(isRelearning ? null : move.id)
                            setReplaceMoveId('')
                          }}
                          className="rounded border px-3 py-1 text-sm"
                        >
                          {isRelearning ? 'Cancel' : 'Replace…'}
                        </button>
                      ) : (
                        <button type="button" onClick={() => handleLearn(move.id)} className="rounded border px-3 py-1 text-sm">
                          Learn
                        </button>
                      )}
                    </div>
                    {isRelearning && (
                      <div className="flex flex-wrap items-center gap-2 border-t pt-2 text-sm">
                        <select
                          value={replaceMoveId}
                          onChange={(e) => setReplaceMoveId(e.target.value)}
                          className="bg-surface-subtle rounded border px-2 py-1"
                        >
                          <option value="">Forget which move?</option>
                          {knownMoves.map((km) => (
                            <option key={km.move_id} value={km.move_id}>{km.moves.name}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={!replaceMoveId}
                          onClick={() => handleRelearn(move.id)}
                          className="rounded bg-accent px-3 py-1 text-accent-foreground disabled:opacity-50"
                        >
                          Confirm swap
                        </button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}

// [[Let a GM force-teach any Move]]: deliberately a separate GM-only control, not folded into the
// Trainer's own "Learn a Move" picker above -- the GM only grants *eligibility* here (a persistent
// pokemon_move_grants row), the Trainer still does the actual teaching through the normal picker,
// spending one of their own 6 slots whenever they choose. Same name-filtered-search shape as
// TargetTypePicker (full 651-row global catalog is too big for a plain list/select).
export function GrantMoveSection() {
  const { pokemonId, isGM, moveCatalog, grantedLearnset, knownMoves, addGrantedMove } = usePokemonState()
  const [searchText, setSearchText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<number | null>(null)

  if (!isGM) return null

  const knownMoveIds = knownMoves.map((km) => km.move_id)
  const grantedMoveIds = new Set(grantedLearnset.map((g) => g.move.id))
  const needle = searchText.trim().toLowerCase()
  const matches = needle ? moveCatalog.filter((m) => m.name.toLowerCase().includes(needle)).slice(0, 8) : []

  async function handleGrant(move: MoveInfo) {
    setError(null)
    setPending(move.id)
    const result = await grantMoveEligibility(pokemonId, move.id)
    setPending(null)
    if ('error' in result) {
      setError(result.error)
      return
    }
    addGrantedMove({ level_learned: null, move, granted: true })
    setSearchText('')
  }

  return (
    <section className="rounded border border-accent bg-accent/10 p-4">
      <details>
        <summary className="cursor-pointer font-semibold">
          GM: Grant a Move
          {grantedLearnset.length > 0 && <span className="ml-1 text-sm font-normal text-muted">({grantedLearnset.length} granted)</span>}
        </summary>
        <div className="mt-2 flex flex-col gap-2">
          <p className="text-xs text-muted">
            Grants this Pokémon eligibility to learn a Move it otherwise couldn't -- the Trainer still teaches it themselves through the
            usual picker above, spending one of their own move slots.
          </p>
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search the Move catalog…"
            className="bg-surface-subtle rounded border px-2 py-1 text-sm"
          />
          {needle && (
            <ul className="flex flex-col gap-1">
              {matches.length === 0 ? (
                <li className="text-sm text-muted">No moves match.</li>
              ) : (
                matches.map((move) => {
                  const alreadyGranted = grantedMoveIds.has(move.id)
                  const alreadyKnown = knownMoveIds.includes(move.id)
                  return (
                    <li key={move.id} className="flex items-center justify-between gap-2 rounded border p-2 text-sm">
                      <div>
                        <span className="font-medium">{move.name}</span>{' '}
                        <span className="text-xs text-muted">
                          {move.types?.name} · {move.range} · {move.damage_stat.replace('_', ' ')}
                        </span>
                      </div>
                      <button
                        type="button"
                        disabled={alreadyGranted || alreadyKnown || pending === move.id}
                        onClick={() => handleGrant(move)}
                        className="shrink-0 rounded border px-2 py-1 text-xs disabled:opacity-30"
                      >
                        {alreadyKnown ? 'Already known' : alreadyGranted ? 'Granted' : 'Grant'}
                      </button>
                    </li>
                  )
                })
              )}
            </ul>
          )}
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
      </details>
    </section>
  )
}

// Free, instant, owner-or-GM toggling -- no eligibility gating and no stacking cap, unlike Moves, so
// this is a plain checkbox list rather than a separate "known" vs. "available" split.
export function AfflictionsSection() {
  const { pokemonId, allAfflictions, activeAfflictionIds, setAfflictionActive } = usePokemonState()
  const [error, setError] = useState<string | null>(null)

  async function handleToggle(afflictionId: number, isActive: boolean) {
    setError(null)
    const result = isActive ? await removeAffliction(pokemonId, afflictionId) : await addAffliction(pokemonId, afflictionId)
    if (result?.error) {
      setError(result.error)
      return
    }
    setAfflictionActive(afflictionId, !isActive)
  }

  const activeCount = activeAfflictionIds.length

  return (
    <section className="rounded border border-accent bg-accent/10 p-4">
      <details>
        <summary className="cursor-pointer font-semibold">
          Afflictions
          {activeCount > 0 && <span className="ml-1 text-sm font-normal text-muted">({activeCount} active)</span>}
        </summary>
        <div className="mt-2">
          {allAfflictions.length === 0 ? (
            <p className="text-sm text-muted">None defined.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {allAfflictions.map((a) => {
                const isActive = activeAfflictionIds.includes(a.id)
                const statBonuses = a.stats.map((s) => `${formatSigned(s.modifier)} ${s.statName}`).join(', ')
                return (
                  <li key={a.id} className="rounded border p-2 text-sm">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={isActive} onChange={() => handleToggle(a.id, isActive)} />
                      <span className="font-medium">{a.name}</span>
                      {statBonuses && <span className="text-xs text-muted">— {statBonuses}</span>}
                    </label>
                    {a.description && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs text-muted">Details</summary>
                        <p className="mt-1 text-xs text-muted">{a.description}</p>
                      </details>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          {error && <p className="mt-1 text-xs text-danger">{error}</p>}
        </div>
      </details>
    </section>
  )
}

// Ability-type Passives (Rock head, Sturdy...) are read-only here -- auto-derived from species+level,
// no learn/unlearn action for those. Stat-type Passives are the interactive half this section adds:
// owner-or-GM, free and instant (same reasoning as Moves -- everyday Pokemon bookkeeping, not a
// GM-adjudicated fact), capped at MAX_STAT_PASSIVES total and one per category.
export function PassivesSection() {
  const {
    pokemonId,
    basePath,
    isEditingPassives,
    abilityPassives,
    knownStatPassives,
    statPassiveLearnset,
    level,
    addKnownPassive,
    removeKnownPassive,
  } = usePokemonState()

  const [error, setError] = useState<string | null>(null)

  const knownPassiveIds = knownStatPassives.map((kp) => kp.passive_id)
  const knownCategories = new Set(knownStatPassives.map((kp) => kp.passives.category).filter((c): c is string => c !== null))
  const atCap = knownStatPassives.length >= MAX_STAT_PASSIVES

  // Unfiltered by level in statPassiveLearnset (same reasoning as fullLearnset for Moves) so a
  // level-up from Add Exp can reveal newly-eligible Stat Passives here without a fresh request.
  const learnableStatPassives = statPassiveLearnset.filter(
    (r) => (r.level_learned === null || r.level_learned <= level) && !knownPassiveIds.includes(r.passives.id),
  )

  async function handleLearn(passiveId: number) {
    setError(null)
    const result = await learnPassive(pokemonId, passiveId)
    if ('error' in result) {
      setError(result.error)
      return
    }
    const entry = statPassiveLearnset.find((r) => r.passives.id === passiveId)
    if (!entry) return
    addKnownPassive({ passive_id: passiveId, passives: entry.passives })
  }

  async function handleUnlearn(passiveId: number) {
    setError(null)
    const result = await unlearnPassive(pokemonId, passiveId)
    if (result?.error) {
      setError(result.error)
      return
    }
    removeKnownPassive(passiveId)
  }

  return (
    <section className="rounded border border-accent bg-accent/10 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold">Passives / Skills</h2>
        {isEditingPassives ? (
          <Link href={basePath} className="rounded border px-3 py-1 text-sm">
            Done
          </Link>
        ) : (
          <Link href={`${basePath}?editPassives=1`} className="rounded border px-3 py-1 text-sm">
            Edit
          </Link>
        )}
      </div>
      {abilityPassives.length === 0 && knownStatPassives.length === 0 ? (
        <p className="text-sm text-muted">None yet.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {abilityPassives.map((p) => (
            <li key={`ability-${p.id}`} className="text-sm">
              <span className="font-medium">{p.name}</span>
              {p.description ? ` — ${p.description}` : ''}
            </li>
          ))}
          {knownStatPassives.map((kp) => {
            const p = kp.passives
            const statBonuses = p.passives_stats.map((ps) => `${formatSigned(ps.modifier)} ${ps.stats?.name ?? ''}`.trim()).join(', ')
            return (
              <li key={kp.passive_id} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  <span className="font-medium">{p.name}</span>
                  {statBonuses ? ` — ${statBonuses}` : p.description ? ` — ${p.description}` : ''}
                </span>
                {isEditingPassives && (
                  <button
                    type="button"
                    onClick={() => handleUnlearn(kp.passive_id)}
                    className="rounded border border-danger px-2 py-0.5 text-xs text-danger"
                  >
                    Remove
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <p className="mt-2 text-xs text-muted">
        {knownStatPassives.length} / {MAX_STAT_PASSIVES} Stat Passives known.
      </p>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}

      {isEditingPassives && (
        <div className="mt-4 border-t pt-4">
          <h3 className="mb-2 text-sm font-semibold">Learn a Stat Passive</h3>
          {learnableStatPassives.length === 0 ? (
            <p className="text-sm text-muted">No new Stat Passives available to learn right now.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {learnableStatPassives.map(({ level_learned, passives: p }) => {
                const categoryTaken = p.category !== null && knownCategories.has(p.category)
                const disabled = atCap || categoryTaken
                return (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-3">
                    <div>
                      <p className="font-medium">
                        {p.name}{' '}
                        <span className="text-xs font-normal text-muted">
                          ({level_learned === null ? 'always known' : `level ${level_learned}`})
                        </span>
                      </p>
                      {p.description && <p className="text-xs text-muted">{p.description}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleLearn(p.id)}
                      disabled={disabled}
                      title={categoryTaken ? `Already has a ${p.category} Passive` : atCap ? `Already knows ${MAX_STAT_PASSIVES} Stat Passives` : undefined}
                      className="rounded border px-3 py-1 text-sm disabled:opacity-30"
                    >
                      Learn
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}

// [[Add Evolution functionality]]: no standalone section anymore -- a species with nothing
// currently actionable (the common case: most Pokemon most of the time) shouldn't occupy a whole
// card. This renders nothing until at least one automatic trigger (level/loyalty/item) is actually
// satisfied right now, at which point it's a single highlighted button in the page header. Evolving
// stays a deliberate, explicitly-confirmed action (matches Learn/Add Exp's opt-in convention, not
// auto-applied): clicking fetches the Passive-loss preview first and shows a confirm step naming
// exactly what will be lost before anything actually changes. A successful evolve calls
// router.refresh() rather than patching client state in place -- unlike HP/Exp/Moves, evolving changes
// nearly everything derived from the species (stats, sprite, learnset, type, available evolutions
// itself), so a fresh server render is simpler and less error-prone than reconstructing all of that
// client-side. The GM-only "jump to any chain member" override lives separately, inside the Info Edit
// form (see GmOverrideEvolutionPicker below) -- it has no eligibility gate of its own, so it doesn't
// belong on this always-conditional button.
export function EvolveButton() {
  const router = useRouter()
  const { pokemonId, isOwner, isGM, level, isMaxLoyaltyPokemon, evolutionTargets, bagStoneItems } = usePokemonState()

  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState<{ toPokedexId: number; toName: string; trainersItemId: string | null; removedPassiveNames: string[] } | null>(
    null,
  )
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleOutsideClick(e: MouseEvent) {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [open])

  const canAct = isOwner || isGM
  const readyTargets = evolutionTargets
    .filter((t) => t.triggerType !== 'other')
    .map((t) => {
      if (t.triggerType === 'level') {
        return { toPokedexId: t.toPokedexId, label: t.toName, trainersItemId: null as string | null, ready: t.levelRequirement !== null && level >= t.levelRequirement }
      }
      if (t.triggerType === 'loyalty') {
        return { toPokedexId: t.toPokedexId, label: t.toName, trainersItemId: null as string | null, ready: isMaxLoyaltyPokemon }
      }
      const bagItem = bagStoneItems.find((b) => b.itemId === t.itemId)
      return { toPokedexId: t.toPokedexId, label: `${t.toName} (${t.itemName})`, trainersItemId: bagItem?.trainersItemId ?? null, ready: !!bagItem }
    })
    .filter((t) => t.ready)

  if (!canAct || readyTargets.length === 0) return null

  async function startEvolve(target: { toPokedexId: number; label: string; trainersItemId: string | null }) {
    setError(null)
    setBusy(true)
    const preview = await previewEvolution(pokemonId, target.toPokedexId)
    setBusy(false)
    if ('error' in preview) {
      setError(preview.error)
      return
    }
    setPending({ toPokedexId: target.toPokedexId, toName: target.label, trainersItemId: target.trainersItemId, removedPassiveNames: preview.removedPassiveNames })
  }

  async function confirmEvolve() {
    if (!pending) return
    setBusy(true)
    setError(null)
    const result = await evolvePokemon(pokemonId, pending.toPokedexId, pending.trainersItemId)
    setBusy(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setPending(null)
    router.refresh()
  }

  return (
    <div ref={panelRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => (readyTargets.length === 1 ? startEvolve(readyTargets[0]) : setOpen((o) => !o))}
        disabled={busy}
        className="rounded border border-success px-4 py-2 text-sm font-semibold text-success disabled:opacity-50"
      >
        Evolve
      </button>

      {(open || pending || error) && (
        <div className="bg-page absolute right-0 top-full z-20 mt-1 w-72 rounded border p-3 text-sm shadow-lg">
          {error && <p className="mb-2 text-xs text-danger">{error}</p>}
          {pending ? (
            <div className="flex flex-col gap-2">
              <p>
                Evolve into <span className="font-medium">{pending.toName}</span>?
              </p>
              {pending.removedPassiveNames.length > 0 && (
                <p className="text-warning">
                  This will remove {pending.removedPassiveNames.length > 1 ? 'these Passives' : 'this Passive'} ({pending.toName} doesn&apos;t offer{' '}
                  {pending.removedPassiveNames.length > 1 ? 'them' : 'it'}): {pending.removedPassiveNames.join(', ')}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={confirmEvolve}
                  disabled={busy}
                  className="rounded bg-accent px-3 py-1 text-sm text-accent-foreground disabled:opacity-50"
                >
                  Confirm
                </button>
                <button type="button" onClick={() => setPending(null)} disabled={busy} className="rounded border px-3 py-1 text-sm">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <ul className="flex flex-col gap-1">
              {readyTargets.map((t) => (
                <li key={t.toPokedexId}>
                  <button
                    type="button"
                    onClick={() => startEvolve(t)}
                    disabled={busy}
                    className="w-full rounded border px-3 py-1 text-left text-sm disabled:opacity-50"
                  >
                    {t.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

// [[Add Pokemon gifting]]: gives this Pokemon directly to another same-campaign Trainer/NPC in one
// step -- authorized by this Pokemon's current owner or that campaign's GM, no destination-side
// approval needed (gifting only ever moves the giver's own belongings). Renders nothing when there's
// no campaign/current-trainer context to gift from, or no other same-campaign Trainer to gift to.
// The confirm step names the resulting obtain method before committing (Gifted, or a revert to the
// Pokemon's original obtain method if gifting back to its original trainer), matching this app's
// established "explicitly confirm and name what changes" convention (Evolve, level-up milestones).
// A successful gift calls router.refresh() rather than patching client state -- the current Trainer
// changes, which cascades into isOwner/isGM/canEditInfo and most of the Info card, so a fresh server
// render is simpler than reconstructing all of that client-side.
export function GiftPokemonButton() {
  const router = useRouter()
  const { pokemonId, isOwner, isGM, giftableTrainers, originalTrainerId, originalObtainMethodName } = usePokemonState()

  const [open, setOpen] = useState(false)
  const [selectedTrainerId, setSelectedTrainerId] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleOutsideClick(e: MouseEvent) {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [open])

  if (!(isOwner || isGM) || giftableTrainers.length === 0) return null

  const selectedTrainer = giftableTrainers.find((t) => t.id === selectedTrainerId) ?? null
  const resultText =
    selectedTrainerId && selectedTrainerId === originalTrainerId
      ? `revert to ${originalObtainMethodName ?? 'its original obtain method'}`
      : 'become Gifted'

  async function confirmGift() {
    if (!selectedTrainerId) return
    setBusy(true)
    setError(null)
    const result = await giftPokemon(pokemonId, selectedTrainerId)
    setBusy(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setOpen(false)
    setConfirming(false)
    setSelectedTrainerId('')
    router.refresh()
  }

  return (
    <div ref={panelRef} className="relative shrink-0">
      <button type="button" onClick={() => setOpen((o) => !o)} className="rounded border px-4 py-2 text-sm font-semibold">
        Gift to...
      </button>

      {(open || confirming || error) && (
        <div className="bg-page absolute right-0 top-full z-20 mt-1 w-72 rounded border p-3 text-sm shadow-lg">
          {error && <p className="mb-2 text-xs text-danger">{error}</p>}
          {confirming && selectedTrainer ? (
            <div className="flex flex-col gap-2">
              <p>
                Gift to <span className="font-medium">{selectedTrainer.name}</span>? Obtain method will {resultText}.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={confirmGift}
                  disabled={busy}
                  className="rounded bg-accent px-3 py-1 text-sm text-accent-foreground disabled:opacity-50"
                >
                  Confirm
                </button>
                <button type="button" onClick={() => setConfirming(false)} disabled={busy} className="rounded border px-3 py-1 text-sm">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <select
                value={selectedTrainerId}
                onChange={(e) => setSelectedTrainerId(e.target.value)}
                className="bg-surface-subtle rounded border px-2 py-1 text-sm"
              >
                <option value="">Choose a Trainer…</option>
                {giftableTrainers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.is_npc ? ' (NPC)' : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => selectedTrainerId && setConfirming(true)}
                disabled={!selectedTrainerId}
                className="rounded border px-3 py-1 text-sm disabled:opacity-50"
              >
                Gift
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// [[Add Evolution functionality]]: the unconditional GM-only override (jump directly to any other
// species in the chain, including devolving) -- separate from EvolveButton above since it has no
// eligibility gate, and lives inside the Info Edit form alongside this Pokemon's other GM-only
// overrides (Nature/Type/Size/Gender/...) rather than its own section. Its Change/Confirm buttons are
// `type="button"`, not `type="submit"` -- evolving is a distinct server action (evolvePokemon) from
// the surrounding form's own submit (updatePokemonDetails), so nesting it inside that <form> is safe.
export function GmOverrideEvolutionPicker() {
  const router = useRouter()
  const { pokemonId, isGM, chainMembers } = usePokemonState()

  const [pending, setPending] = useState<{ toPokedexId: number; toName: string; removedPassiveNames: string[] } | null>(null)
  const [selectedChainId, setSelectedChainId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!isGM || chainMembers.length === 0) return null

  async function startEvolve(toPokedexId: number, toName: string) {
    setError(null)
    setBusy(true)
    const preview = await previewEvolution(pokemonId, toPokedexId)
    setBusy(false)
    if ('error' in preview) {
      setError(preview.error)
      return
    }
    setPending({ toPokedexId, toName, removedPassiveNames: preview.removedPassiveNames })
  }

  async function confirmEvolve() {
    if (!pending) return
    setBusy(true)
    setError(null)
    const result = await evolvePokemon(pokemonId, pending.toPokedexId, null)
    setBusy(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setPending(null)
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-1">
      <p>Species (GM override)</p>
      {pending ? (
        <div className="flex flex-col gap-2 rounded border p-2">
          <p>
            Evolve into <span className="font-medium">{pending.toName}</span>?
          </p>
          {pending.removedPassiveNames.length > 0 && (
            <p className="text-warning">
              This will remove {pending.removedPassiveNames.length > 1 ? 'these Passives' : 'this Passive'} ({pending.toName} doesn&apos;t offer{' '}
              {pending.removedPassiveNames.length > 1 ? 'them' : 'it'}): {pending.removedPassiveNames.join(', ')}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={confirmEvolve}
              disabled={busy}
              className="rounded bg-accent px-3 py-1 text-sm text-accent-foreground disabled:opacity-50"
            >
              Confirm
            </button>
            <button type="button" onClick={() => setPending(null)} disabled={busy} className="rounded border px-3 py-1 text-sm">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedChainId}
            onChange={(e) => setSelectedChainId(e.target.value)}
            className="bg-surface-subtle rounded border p-2"
          >
            <option value="">Choose a species...</option>
            {chainMembers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!selectedChainId || busy}
            onClick={() => {
              const m = chainMembers.find((cm) => cm.id === Number(selectedChainId))
              if (m) startEvolve(m.id, m.name)
            }}
            className="rounded border px-3 py-1 text-sm disabled:opacity-30"
          >
            Change
          </button>
        </div>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}
