import type { createClient } from '@/lib/supabase/server'
import { statModifier } from '@/lib/pta3/pointBuy'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

export type SpeciesStats = {
  base_hp: number
  base_atk: number
  base_def: number
  base_sp_atk: number
  base_sp_def: number
  base_speed: number
}

// [[Let a GM override a Pokemon's individual base stats]] / [[Feature - Breeder class - permanent stat
// increase on Egg hatch]]: `pokemon.bonus_base_x` is a permanent add-on to a stat's base, written by
// either a GM's direct override or Natural Edge's hatch-time bonus -- the schema itself can't tell
// which wrote it.
export type StatBonusMap = Record<'attack' | 'defense' | 'special_attack' | 'special_defense' | 'speed', number>

export type PokemonStatEvMap = Record<'attack' | 'defense' | 'special_attack' | 'special_defense' | 'speed', number>

// [[Improvement - Add a combat encounter tracker]]: extracted from PokemonInteractive.tsx's own
// page-local `computeStatRows` (unchanged) so a Pokemon's true effective stat (Speed, for turn-order
// initiative) can be computed server-side too, not just displayed client-side on the Pokemon's own
// page -- same math, one source of truth.
export function computeStatRows(
  species: SpeciesStats,
  evs: PokemonStatEvMap,
  natureIncreasedName: string | null,
  natureDecreasedName: string | null,
  passiveBonusByStat: Record<string, number>,
  afflictionBonusByStat: Record<string, number>,
  statBonuses: StatBonusMap,
) {
  return (
    [
      { key: 'attack', label: 'Attack', base: species.base_atk, ev: evs.attack, statBonus: statBonuses.attack },
      { key: 'defense', label: 'Defense', base: species.base_def, ev: evs.defense, statBonus: statBonuses.defense },
      {
        key: 'special_attack',
        label: 'Special Attack',
        base: species.base_sp_atk,
        ev: evs.special_attack,
        statBonus: statBonuses.special_attack,
      },
      {
        key: 'special_defense',
        label: 'Special Defense',
        base: species.base_sp_def,
        ev: evs.special_defense,
        statBonus: statBonuses.special_defense,
      },
      { key: 'speed', label: 'Speed', base: species.base_speed, ev: evs.speed, statBonus: statBonuses.speed },
    ] as const
  ).map((s) => {
    const natureAdjust = natureIncreasedName === s.label ? 1 : natureDecreasedName === s.label ? -1 : 0
    const passiveBonus = passiveBonusByStat[s.label] ?? 0
    const afflictionBonus = afflictionBonusByStat[s.label] ?? 0
    const inBattle = 0 // No in-combat temporary-modifier tracking exists yet; always displayed as 0.
    const value = s.base + s.statBonus + s.ev + natureAdjust + passiveBonus + afflictionBonus + inBattle
    return { ...s, natureAdjust, passiveBonus, afflictionBonus, inBattle, value, modifier: statModifier(value) }
  })
}

export type PokemonStatRows = ReturnType<typeof computeStatRows>

// [[Improvement - Add a combat encounter tracker]]: a server-side loader for a Pokemon's fully
// effective stats (base + EVs + bonus_base_x + Nature + active stat-Passives + active Afflictions) --
// the same inputs PokemonInteractive.tsx already assembles client-side from props, refetched here since
// the tracker needs this at combatant-add time (a server action), not as page props. Used to seed a
// Pokemon combatant's turn-order value from its effective Speed (not just the raw pokedex base_speed
// column) -- reusable for any other stat, not just Speed.
export async function loadPokemonEffectiveStats(supabase: SupabaseClient, pokemonId: string): Promise<PokemonStatRows | null> {
  const { data: pokemonRaw } = await supabase
    .from('pokemon')
    .select(
      `
      ev_attack, ev_defense, ev_special_attack, ev_special_defense, ev_speed,
      bonus_base_atk, bonus_base_def, bonus_base_sp_atk, bonus_base_sp_def, bonus_base_speed,
      pokedex:pokedex_id (base_atk, base_def, base_sp_atk, base_sp_def, base_speed),
      nature:natures!nature_id (
        increased:stats!increased_stat_id(name),
        decreased:stats!decreased_stat_id(name)
      )
    `,
    )
    .eq('id', pokemonId)
    .maybeSingle()

  // Same reverse/forward-embed quirk documented throughout this codebase -- pokedex/nature come back
  // as single objects at runtime, not the arrays TS infers.
  const pokemon = pokemonRaw as unknown as {
    ev_attack: number
    ev_defense: number
    ev_special_attack: number
    ev_special_defense: number
    ev_speed: number
    bonus_base_atk: number
    bonus_base_def: number
    bonus_base_sp_atk: number
    bonus_base_sp_def: number
    bonus_base_speed: number
    pokedex: { base_atk: number; base_def: number; base_sp_atk: number; base_sp_def: number; base_speed: number } | null
    nature: { increased: { name: string } | null; decreased: { name: string } | null } | null
  } | null

  if (!pokemon || !pokemon.pokedex) return null

  const [{ data: activeAfflictionRows }, { data: statPassiveRows }] = await Promise.all([
    supabase
      .from('pokemon_afflictions')
      .select('afflictions(afflictions_stats(modifier, stats(name)))')
      .eq('pokemon_id', pokemonId),
    supabase
      .from('pokemon_passives')
      .select('passives(passive_type, passives_stats(modifier, stats(name)))')
      .eq('pokemon_id', pokemonId),
  ])

  const afflictionBonusByStat: Record<string, number> = {}
  for (const row of (activeAfflictionRows ?? []) as unknown as { afflictions: { afflictions_stats: { modifier: number; stats: { name: string } | null }[] } | null }[]) {
    for (const s of row.afflictions?.afflictions_stats ?? []) {
      if (!s.stats) continue
      afflictionBonusByStat[s.stats.name] = (afflictionBonusByStat[s.stats.name] ?? 0) + s.modifier
    }
  }

  const passiveBonusByStat: Record<string, number> = {}
  for (const row of (statPassiveRows ?? []) as unknown as {
    passives: { passive_type: string; passives_stats: { modifier: number; stats: { name: string } | null }[] } | null
  }[]) {
    if (row.passives?.passive_type !== 'stat') continue
    for (const s of row.passives.passives_stats ?? []) {
      if (!s.stats) continue
      passiveBonusByStat[s.stats.name] = (passiveBonusByStat[s.stats.name] ?? 0) + s.modifier
    }
  }

  return computeStatRows(
    {
      base_hp: 0, // Not needed for these 5 stat rows -- HP has its own separate max-HP formula elsewhere.
      base_atk: pokemon.pokedex.base_atk,
      base_def: pokemon.pokedex.base_def,
      base_sp_atk: pokemon.pokedex.base_sp_atk,
      base_sp_def: pokemon.pokedex.base_sp_def,
      base_speed: pokemon.pokedex.base_speed,
    },
    {
      attack: pokemon.ev_attack,
      defense: pokemon.ev_defense,
      special_attack: pokemon.ev_special_attack,
      special_defense: pokemon.ev_special_defense,
      speed: pokemon.ev_speed,
    },
    pokemon.nature?.increased?.name ?? null,
    pokemon.nature?.decreased?.name ?? null,
    passiveBonusByStat,
    afflictionBonusByStat,
    {
      attack: pokemon.bonus_base_atk,
      defense: pokemon.bonus_base_def,
      special_attack: pokemon.bonus_base_sp_atk,
      special_defense: pokemon.bonus_base_sp_def,
      speed: pokemon.bonus_base_speed,
    },
  )
}

// Convenience wrapper for the one stat the combat encounter tracker actually needs -- returns null the
// same way loadPokemonEffectiveStats does if the Pokemon (or its species) can't be found.
export async function loadPokemonEffectiveSpeed(supabase: SupabaseClient, pokemonId: string): Promise<number | null> {
  const rows = await loadPokemonEffectiveStats(supabase, pokemonId)
  return rows?.find((r) => r.key === 'speed')?.value ?? null
}

// [[Feature - Add attack resolution to combat encounters]]: a Pokemon's *effective* type (a GM's
// direct override, when set, otherwise its species default) -- same formula the Pokemon page's own
// `page.tsx` already computes client-side (`effectiveType1`/`effectiveType2`), replicated here so
// attack resolution's server-side STAB/effectiveness lookup uses the exact same override-aware type,
// not just the species default.
export async function loadPokemonEffectiveType(supabase: SupabaseClient, pokemonId: string): Promise<{ type1: string | null; type2: string | null } | null> {
  const { data } = await supabase
    .from('pokemon')
    .select(
      `
      type_1_id, type_2_id,
      pokedex:pokedex_id (type_1:types!type_1_id(name), type_2:types!type_2_id(name)),
      override_type_1:types!type_1_id(name),
      override_type_2:types!type_2_id(name)
    `,
    )
    .eq('id', pokemonId)
    .maybeSingle()

  // Same reverse/forward-embed quirk documented throughout this codebase.
  const pokemon = data as unknown as {
    type_1_id: number | null
    type_2_id: number | null
    pokedex: { type_1: { name: string } | null; type_2: { name: string } | null } | null
    override_type_1: { name: string } | null
    override_type_2: { name: string } | null
  } | null

  if (!pokemon) return null

  return {
    type1: pokemon.override_type_1?.name ?? pokemon.pokedex?.type_1?.name ?? null,
    type2: pokemon.type_2_id ? (pokemon.override_type_2?.name ?? null) : (pokemon.pokedex?.type_2?.name ?? null),
  }
}
