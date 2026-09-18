'use server'

import { createClient } from '@/lib/supabase/server'
import { loadPokemonEffectiveStats, loadPokemonEffectiveType } from '@/lib/pta3/pokemonStats'
import { computePokemonLevel } from '@/lib/pta3/pokemonLevel'
import { loadQualifyingMilestones, computeEffectiveStats, loadTrainerDerived, STAT_COLUMNS, type StatColumn } from '@/lib/pta3/trainerFeatures'
import { loadBagSnapshot } from '@/lib/pta3/bag'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

const STAT_LABELS: Record<StatColumn, string> = {
  attack: 'Attack',
  defense: 'Defense',
  special_attack: 'Special Attack',
  special_defense: 'Special Defense',
  speed: 'Speed',
}

export type CombatantDetail =
  | { error: string }
  // [[Feature - Reveal opponent Pokemon without scanning on Walking encyclopedia (Researcher)]]: an
  // unidentified enemy gets exactly this shape back -- name/sprite/type already stay hidden elsewhere
  // on this page via the same gating, so the modal shouldn't be a backdoor around it. The gate is
  // re-checked here server-side, not just by hiding the trigger client-side -- a rogue request calling
  // this action directly for an unidentified enemy must not get real data back either.
  | { kind: 'pokemon'; identified: false }
  | {
      kind: 'pokemon'
      identified: true
      name: string
      types: string[]
      ability: string | null
      heldItem: string | null
      stats: { label: string; value: number }[]
      moves: string[]
      afflictions: { name: string; description: string }[]
    }
  | {
      kind: 'trainer'
      name: string
      className: string | null
      stats: { label: string; value: number }[]
      features: { id: number; name: string; description: string }[]
      moves: string[]
      items: { id: string; name: string; quantity: number }[]
    }

// [[Feature - Show more Pokemon and trainer information in Encounters]]: re-derives the exact same
// identification check page.tsx's own combatantIsIdentified() already does (GM always sees everything;
// a member sees an enemy Pokemon's real info once its species is in campaign_scanned_species, or if any
// of their own Trainers has resolved "Walking encyclopedia") -- duplicated here rather than extracted,
// since this is the only other place that needs it and an extraction would mean reworking page.tsx's
// own already-working logic for no functional gain.
async function isPokemonIdentifiedForViewer(
  supabase: SupabaseClient,
  userId: string,
  campaignId: string,
  isGM: boolean,
  pokedexId: number,
): Promise<boolean> {
  if (isGM) return true

  const { data: scanned } = await supabase
    .from('campaign_scanned_species')
    .select('pokedex_id')
    .eq('campaign_id', campaignId)
    .eq('pokedex_id', pokedexId)
    .maybeSingle()
  if (scanned) return true

  const { data: myTrainers } = await supabase
    .from('trainers')
    .select('id, class_id, level')
    .eq('campaign_id', campaignId)
    .eq('user_id', userId)
    .eq('is_npc', false)
  for (const t of myTrainers ?? []) {
    if (t.class_id === null) continue
    const { activeFeatures, passiveFeatures } = await loadTrainerDerived(supabase, t.id, { classId: t.class_id, level: t.level })
    if ([...activeFeatures, ...passiveFeatures].some((f) => f.name === 'Walking encyclopedia')) return true
  }
  return false
}

async function loadPokemonDetail(supabase: SupabaseClient, pokemonId: string, campaignId?: string | null): Promise<CombatantDetail> {
  const { data: pokemonRaw } = await supabase
    .from('pokemon')
    .select(
      `
      nickname, pokedex_id, current_exp, is_shiny, loyalty_points, original_obtain_method_id,
      held_item:items!held_item_id(name),
      pokedex:pokedex_id(name, growth_rate_id)
    `,
    )
    .eq('id', pokemonId)
    .maybeSingle()

  // Same reverse/forward-embed quirk documented throughout this codebase.
  const pokemon = pokemonRaw as unknown as {
    nickname: string | null
    pokedex_id: number
    current_exp: number
    is_shiny: boolean
    loyalty_points: number
    original_obtain_method_id: number | null
    held_item: { name: string } | null
    pokedex: { name: string; growth_rate_id: number | null } | null
  } | null
  if (!pokemon || !pokemon.pokedex) return { error: 'Pokemon not found.' }

  const { level } = await computePokemonLevel(supabase, {
    currentExp: pokemon.current_exp,
    isShiny: pokemon.is_shiny,
    loyaltyPoints: pokemon.loyalty_points,
    obtainMethodId: pokemon.original_obtain_method_id,
    growthRateId: pokemon.pokedex.growth_rate_id,
    campaignId,
  })

  const [statRows, effectiveType, abilityRowsRaw, moveRowsRaw, afflictionIdsRaw] = await Promise.all([
    loadPokemonEffectiveStats(supabase, pokemonId),
    loadPokemonEffectiveType(supabase, pokemonId),
    supabase.from('pokedex_passives').select('level_learned, passives(name, passive_type)').eq('pokedex_id', pokemon.pokedex_id),
    supabase.from('pokemon_moves').select('moves(name)').eq('pokemon_id', pokemonId),
    supabase.from('pokemon_afflictions').select('affliction_id').eq('pokemon_id', pokemonId),
  ])

  const abilityRows = (abilityRowsRaw.data ?? []) as unknown as { level_learned: number | null; passives: { name: string; passive_type: string } | null }[]
  const ability =
    abilityRows.find((r) => r.passives?.passive_type === 'ability' && (r.level_learned === null || r.level_learned <= level))?.passives?.name ?? null

  const moveRows = (moveRowsRaw.data ?? []) as unknown as { moves: { name: string } | null }[]
  const moves = moveRows.filter((r) => r.moves).map((r) => r.moves!.name)

  let afflictions: { name: string; description: string }[] = []
  const afflictionIds = (afflictionIdsRaw.data ?? []).map((r) => r.affliction_id)
  if (afflictionIds.length > 0) {
    const { data: afflictionRows } = await supabase.from('afflictions').select('id, name, description').in('id', afflictionIds)
    afflictions = (afflictionRows ?? []).map((a) => ({ name: a.name, description: a.description }))
  }

  return {
    kind: 'pokemon',
    identified: true,
    name: pokemon.nickname ? `${pokemon.nickname} (${pokemon.pokedex.name})` : pokemon.pokedex.name,
    types: [effectiveType?.type1, effectiveType?.type2].filter((t): t is string => !!t),
    ability,
    heldItem: pokemon.held_item?.name ?? null,
    stats: (statRows ?? []).map((s) => ({ label: STAT_LABELS[s.key as StatColumn], value: s.value })),
    moves,
    afflictions,
  }
}

async function loadTrainerDetail(supabase: SupabaseClient, trainerId: string): Promise<CombatantDetail> {
  const { data: trainer } = await supabase
    .from('trainers')
    .select(
      'name, level, class_id, classes(name), base_attack, base_defense, base_special_attack, base_special_defense, base_speed',
    )
    .eq('id', trainerId)
    .maybeSingle()
  const t = trainer as unknown as {
    name: string
    level: number
    class_id: number | null
    classes: { name: string } | null
    base_attack: number
    base_defense: number
    base_special_attack: number
    base_special_defense: number
    base_speed: number
  } | null
  if (!t) return { error: 'Trainer not found.' }

  const [milestones, { data: moveRowsRaw }, bag] = await Promise.all([
    loadQualifyingMilestones(supabase, trainerId, t.level),
    supabase.from('trainer_moves').select('moves(name)').eq('trainer_id', trainerId),
    loadBagSnapshot(supabase, trainerId),
  ])

  const effectiveStats = computeEffectiveStats(
    {
      attack: t.base_attack,
      defense: t.base_defense,
      special_attack: t.base_special_attack,
      special_defense: t.base_special_defense,
      speed: t.base_speed,
    },
    milestones,
  )

  const moveRows = (moveRowsRaw ?? []) as unknown as { moves: { name: string } | null }[]
  const moves = moveRows.filter((r) => r.moves).map((r) => r.moves!.name)

  let features: { id: number; name: string; description: string }[] = []
  if (t.class_id !== null) {
    const { activeFeatures, passiveFeatures } = await loadTrainerDerived(supabase, trainerId, { classId: t.class_id, level: t.level })
    features = [...activeFeatures, ...passiveFeatures].map((f) => ({ id: f.id, name: f.name, description: f.description }))
  }

  return {
    kind: 'trainer',
    name: t.name,
    className: t.classes?.name ?? null,
    stats: STAT_COLUMNS.map((key) => ({ label: STAT_LABELS[key], value: effectiveStats[key] })),
    features,
    moves,
    items: bag.items.filter((i) => i.quantity > 0).map((i) => ({ id: i.id, name: i.name, quantity: i.quantity })),
  }
}

// [[Feature - Show more Pokemon and trainer information in Encounters]]: the one new server action
// this FR needs -- called directly from CombatantDetailModal.tsx (a client component) when its dialog
// opens, the same "plain 'use server' function, called on demand, not tied to a <form>" pattern
// combatActions.ts's resolveAccuracy already established. Takes the encounter_combatants row's own id
// (already known to the client from the sidebar it's rendered in) rather than a trainer/pokemon id
// directly, since that's what's needed anyway to know the combatant's side for identification gating.
export async function getCombatantDetail(combatantId: string): Promise<CombatantDetail> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in.' }

  const { data: combatant } = await supabase
    .from('encounter_combatants')
    .select('side, encounter_id, trainer_id, pokemon_id')
    .eq('id', combatantId)
    .maybeSingle()
  if (!combatant) return { error: "Couldn't load this combatant." }

  if (combatant.trainer_id) {
    return loadTrainerDetail(supabase, combatant.trainer_id)
  }

  if (!combatant.pokemon_id) return { error: 'Combatant has neither a Trainer nor a Pokemon.' }

  // [[Feature - Allow a GM to change Loyalty settings]]: fetched unconditionally now (previously only
  // for the enemy-identification branch below) so Level/Loyalty math also respects this Campaign's
  // own overrides for an ally combatant.
  const { data: encounter } = await supabase.from('encounters').select('campaign_id').eq('id', combatant.encounter_id).maybeSingle()
  if (!encounter) return { error: "Couldn't load this encounter." }

  if (combatant.side === 'enemy') {
    const { data: campaign } = await supabase.from('campaigns').select('gm_user_id').eq('id', encounter.campaign_id).maybeSingle()
    const isGM = campaign?.gm_user_id === user.id

    const { data: pokedexIdRow } = await supabase.from('pokemon').select('pokedex_id').eq('id', combatant.pokemon_id).maybeSingle()
    if (!pokedexIdRow) return { error: 'Pokemon not found.' }

    const identified = await isPokemonIdentifiedForViewer(supabase, user.id, encounter.campaign_id, isGM, pokedexIdRow.pokedex_id)
    if (!identified) return { kind: 'pokemon', identified: false }
  }

  return loadPokemonDetail(supabase, combatant.pokemon_id, encounter.campaign_id)
}
