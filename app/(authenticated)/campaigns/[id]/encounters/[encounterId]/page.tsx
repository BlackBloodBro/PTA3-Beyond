import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { singleWithRetry } from '@/lib/supabase/retrySingle'
import { trainerHref } from '@/lib/pta3/trainerPaths'
import { pokemonHref } from '@/lib/pta3/pokemonPaths'
import { PokemonSprite } from '@/components/PokemonSprite'
import { ConfirmButton } from '@/components/ConfirmButton'
import { RollInputButton } from '@/components/RollInputButton'
import { loadQualifyingMilestones, computeMaxHp, loadTrainerDerived } from '@/lib/pta3/trainerFeatures'
import { loadCampaignEvDisabled, computePokemonMaxHp } from '@/lib/pta3/pokemonEv'
import { loadPokemonEffectiveType } from '@/lib/pta3/pokemonStats'
import { loadBagSnapshot } from '@/lib/pta3/bag'
import {
  startEncounter,
  resetEncounterToDraft,
  deleteEncounter,
  addTrainerCombatant,
  addPokemonCombatant,
  removeCombatant,
  setCombatantInitiative,
  advanceTurn,
  skipMyTurn,
  scanSpecies,
} from '../actions'
import { AttackResolver, type AttackerOption, type TargetOption } from './AttackResolver'
import { EncounterLivePoll } from './EncounterLivePoll'
import { TrainerActionsPanel, type TrainerActionsData } from './TrainerActionsPanel'
import { CombatantDetailModal } from './CombatantDetailModal'

type CombatantRow = {
  id: string
  side: 'ally' | 'enemy'
  trainer_id: string | null
  pokemon_id: string | null
  turn_order: number | null
  trainers: {
    id: string; name: string; level: number; current_hp: number; is_npc: boolean; campaign_id: string | null; class_id: number | null; classes: { name: string } | null
  } | null
  pokemon: {
    id: string; nickname: string | null; current_hp: number; is_shiny: boolean; bonus_base_hp: number; ev_hp: number; pokedex_id: number
    pokedex: { name: string; sprite_code: string; base_hp: number } | null
  } | null
}

export default async function EncounterDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; encounterId: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id: campaignId, encounterId } = await params
  const { error } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Bug fix (2026-09-14): this used to skip capturing `error` entirely, treating any falsy `campaign`
  // as "not found" -- the exact same swallow-as-not-found shape already fixed on the encounters query
  // below, just never applied here. Fixed identically, plus the new singleWithRetry wrapper (see its
  // own comment) -- confirmed live via the dev server's own request log that a pooled connection can
  // land in a genuinely broken state ("current transaction is aborted...") that fails every query on it
  // until the pool cycles it out; one retry on a fresh request reliably clears it.
  const { data: campaign, error: campaignError } = await singleWithRetry(() =>
    supabase.from('campaigns').select('id, name, gm_user_id').eq('id', campaignId).single(),
  )
  if (campaignError && campaignError.code !== 'PGRST116') {
    throw new Error(`Failed to load campaign: ${campaignError.message}`)
  }
  if (!campaign) {
    redirect('/dashboard')
  }

  // [[Feature - Fully turn off EV's]]: combatantMaxHp below needs this for the Pokemon branch.
  const evsDisabled = await loadCampaignEvDisabled(supabase, campaignId)
  const isGM = campaign.gm_user_id === user.id

  const { data: encounterRaw, error: encounterError } = await singleWithRetry(() =>
    supabase
      .from('encounters')
      .select('id, campaign_id, name, status, current_turn_position, started_at, ended_at')
      .eq('id', encounterId)
      .single(),
  )

  // RLS already scopes what a non-GM can even see (only their own campaign's *active* encounter) --
  // this resolves the right redirect for every other case (wrong campaign in the URL, or the
  // encounter genuinely doesn't exist/isn't visible to this user).
  //
  // Bug fix (2026-09-13): only PGRST116 (Postgrest's "no matching row") is a genuine "not found/not
  // yours" -- any other error (a transient Supabase/network blip, far more likely to actually surface
  // under real concurrent multi-viewer play than a real access change) must not be silently read the
  // same way and boot the player back to the Campaign page. This is the confirmed root cause of
  // "we keep getting removed from the Encounter" -- reproduced live by triggering a burst of concurrent
  // requests (a second viewer's action landing at the same moment) and observing this exact redirect
  // fire with no underlying access change. Let a real error throw instead, so the existing
  // (authenticated)/error.tsx boundary's "Try again" shows up rather than silently losing the page.
  //
  // Bug fix (2026-09-14): the query above now goes through singleWithRetry -- see that file's comment.
  // Confirmed live via the dev server's own request log that this exact query hit a pooled connection
  // stuck with "current transaction is aborted, commands ignored until end of transaction block" across
  // dozens of consecutive requests before self-clearing -- the actual cause of two fresh reports from
  // the user (thrown out both when joining with a Trainer and when a poll picked up a GM's turn
  // advance), since both are just another load of this same page.
  if (encounterError && encounterError.code !== 'PGRST116') {
    throw new Error(`Failed to load encounter: ${encounterError.message}`)
  }
  if (!encounterRaw || encounterRaw.campaign_id !== campaignId) {
    redirect(isGM ? `/campaigns/${campaignId}/encounters` : `/campaigns/${campaignId}`)
  }
  const encounter = encounterRaw!
  const isDraft = encounter.status === 'draft'
  const isActive = encounter.status === 'active'

  // Bug fix (2026-09-14): the single most consequential query on this page to lose to a poisoned
  // pooled connection (see singleWithRetry's own comment) -- every combatant on the page, GM and
  // player controls included, comes from this one call. Retried the same way as the other queries on
  // this page for the same reason.
  const { data: combatantsRaw } = await singleWithRetry(() =>
    supabase
      .from('encounter_combatants')
      .select(
        `
      id, side, trainer_id, pokemon_id, turn_order,
      trainers(id, name, level, current_hp, is_npc, campaign_id, class_id, classes(name)),
      pokemon(id, nickname, current_hp, is_shiny, bonus_base_hp, ev_hp, pokedex_id, pokedex(name, sprite_code, base_hp))
    `,
      )
      .eq('encounter_id', encounterId),
  )

  // Same reverse/forward-embed quirk documented throughout this codebase -- trainers/pokemon/classes/
  // pokedex come back as single objects at runtime, not the arrays TS infers.
  const combatants = (combatantsRaw ?? []) as unknown as CombatantRow[]

  // [[Feature - Reveal opponent Pokemon without scanning on Walking encyclopedia (Researcher)]]: a real
  // restriction invented from scratch (see the FR's own audit -- every species field is unconditional
  // public-read reference data otherwise). Scanned per-Campaign/per-species/permanent, so one query for
  // the whole page rather than per-combatant. The GM always sees everything identified (they built the
  // encounter); a member sees everything identified too if *any* of their own Trainers in this Campaign
  // has resolved "Walking encyclopedia" -- same "check resolved Features by name" pattern used
  // throughout Combat v1 -- otherwise only species already in `campaign_scanned_species`.
  const hasEnemyPokemon = combatants.some((c) => c.side === 'enemy' && c.pokemon !== null)
  let scannedPokedexIds = new Set<number>()
  let viewerHasWalkingEncyclopedia = false
  if (hasEnemyPokemon) {
    const { data: scannedRows } = await supabase.from('campaign_scanned_species').select('pokedex_id').eq('campaign_id', campaignId)
    scannedPokedexIds = new Set((scannedRows ?? []).map((r) => r.pokedex_id))

    if (!isGM) {
      const { data: myTrainers } = await supabase
        .from('trainers')
        .select('id, class_id, level')
        .eq('campaign_id', campaignId)
        .eq('user_id', user.id)
        .eq('is_npc', false)
      for (const t of myTrainers ?? []) {
        if (t.class_id === null) continue
        const { activeFeatures, passiveFeatures } = await loadTrainerDerived(supabase, t.id, { classId: t.class_id, level: t.level })
        if ([...activeFeatures, ...passiveFeatures].some((f) => f.name === 'Walking encyclopedia')) {
          viewerHasWalkingEncyclopedia = true
          break
        }
      }
    }
  }

  function combatantIsIdentified(c: CombatantRow): boolean {
    if (!c.pokemon || c.side !== 'enemy') return true
    return isGM || viewerHasWalkingEncyclopedia || scannedPokedexIds.has(c.pokemon.pokedex_id)
  }

  // [[Feature - Add types to initiative tracker]]: type is identity information, same bucket
  // name/sprite already fall into -- only ever shown once combatantIsIdentified(c) is true. Reuses
  // loadPokemonEffectiveType (the same override-aware type attack resolution's own STAB/effectiveness
  // computation already relies on), not a new lookup.
  const effectiveTypeByPokemonId = new Map<string, { type1: string | null; type2: string | null }>(
    await Promise.all(
      combatants
        .filter((c): c is CombatantRow & { pokemon: NonNullable<CombatantRow['pokemon']> } => c.pokemon !== null)
        .map(async (c) => [c.pokemon.id, (await loadPokemonEffectiveType(supabase, c.pokemon.id)) ?? { type1: null, type2: null }] as const),
    ),
  )

  function combatantTypeLabel(c: CombatantRow): string | null {
    if (!c.pokemon || !combatantIsIdentified(c)) return null
    const t = effectiveTypeByPokemonId.get(c.pokemon.id)
    if (!t?.type1) return null
    return t.type2 ? `${t.type1} / ${t.type2}` : t.type1
  }

  const trainerMaxHpById = new Map<string, number>(
    await Promise.all(
      combatants
        .filter((c): c is CombatantRow & { trainers: NonNullable<CombatantRow['trainers']> } => c.trainers !== null)
        .map(async (c) => [c.trainers.id, computeMaxHp(await loadQualifyingMilestones(supabase, c.trainers.id, c.trainers.level))] as const),
    ),
  )

  // [[Feature - Add a combat encounter tracker]]: "down" isn't a separate GM-toggled flag (per the
  // user, 2026-09-08) -- it's just whether the combatant's own current HP has hit 0, read live from
  // trainers/pokemon, the same source of truth every other HP display already uses. Can never drift
  // out of sync the way a manually-set flag could.
  function combatantIsDown(c: CombatantRow): boolean {
    const hp = c.trainers ? c.trainers.current_hp : (c.pokemon?.current_hp ?? 0)
    return hp <= 0
  }

  // Highest turn_order acts first (d20+Speed-modifier for a Trainer, raw effective Speed for a
  // Pokemon -- see actions.ts). A Draft-added combatant has no turn_order at all yet (null) until
  // startEncounter fills it in -- sorts last, and is excluded from the "whose turn" computation.
  // current_turn_position is a plain incrementing counter indexed modulo this active-only sorted
  // list, so a combatant at 0 HP is skipped automatically without needing its own "skip" logic.
  //
  // Bug fix (2026-09-14): a tied turn_order (a real, common occurrence -- e.g. two Pokemon with the
  // same effective Speed) used to break arbitrarily, since neither this sort nor the
  // `encounter_combatants` query it reads from (fetched with no explicit `.order(...)`) had any
  // secondary key -- Postgres gives no ordering guarantee for an unordered SELECT. That was harmless
  // while "whose turn" only ever needed to be self-consistent within one page render, but the new
  // skip_my_turn() Postgres function ([[Feature - Only active player on initiative tracker can do an
  // action]]) re-derives the same ranking independently in SQL, and Postgres's own `row_number() over
  // (order by turn_order desc)` breaks ties arbitrarily too -- with no guarantee of agreeing with
  // whatever this sort happened to produce. Root-caused as the actual cause of the user's live report
  // ("It is not your turn" firing repeatedly for a real player on their own turn) -- confirmed via the
  // real campaign's own combatant data, which has three separate tied turn_order groups. Fixed by
  // giving both a deterministic secondary key (`id`) -- same tiebreak convention now used in
  // skip_my_turn()'s own `order by`.
  const activeSorted = [...combatants]
    .filter((c) => !combatantIsDown(c) && c.turn_order !== null)
    .sort((a, b) => b.turn_order! - a.turn_order! || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const currentCombatantId = isActive && activeSorted.length > 0 ? activeSorted[encounter.current_turn_position % activeSorted.length].id : null
  const sortedForDisplay = [...combatants].sort(
    (a, b) => (b.turn_order ?? -Infinity) - (a.turn_order ?? -Infinity) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  )

  // [[Feature - Add a combat encounter tracker]]: per the user (2026-09-08) -- the same Trainer/
  // Pokemon can't be added twice (also enforced in the DB), so every "add" dropdown below excludes
  // whoever's already a combatant here. This is also what makes "recall one Pokemon, send out
  // another from the Team" a clean flow -- the recalled one reappears in the list the moment its
  // combatant row is gone, and the currently-out one simply isn't offered again while it's still in.
  const combatantTrainerIds = new Set(combatants.map((c) => c.trainer_id).filter((id): id is string => id !== null))
  const combatantPokemonIds = new Set(combatants.map((c) => c.pokemon_id).filter((id): id is string => id !== null))

  // GM-only data: candidates for the manual "add combatant" forms below. npcTeamPokemon backs
  // "select 1 Team member per NPC" -- every NPC's own Team Pokemon, labeled by owner so the GM can
  // tell them apart, offered alongside whichever NPC they're adding (not filtered live to just that
  // NPC's own roster -- a plain GM tool, not worth a client component just for that).
  let campaignTrainers: { id: string; name: string; is_npc: boolean }[] = []
  let npcTeamPokemon: { id: string; label: string }[] = []
  let campaignPool: { id: string; nickname: string | null; pokedex: { name: string } | null }[] = []
  if (isGM) {
    const [{ data: trainersRaw }, { data: poolRaw }] = await Promise.all([
      supabase
        .from('trainers')
        .select('id, name, is_npc, trainers_pokemon(party_slot, pokemon(id, nickname, pokedex(name)))')
        .eq('campaign_id', campaignId)
        .order('name'),
      supabase
        .from('pokemon')
        .select('id, nickname, pokedex(name), trainers_pokemon(pokemon_id)')
        .eq('campaign_id', campaignId)
        .eq('created_by_user_id', user.id),
    ])
    const trainersWithTeam = (trainersRaw ?? []) as unknown as {
      id: string
      name: string
      is_npc: boolean
      trainers_pokemon: { party_slot: number | null; pokemon: { id: string; nickname: string | null; pokedex: { name: string } | null } | null }[]
    }[]
    campaignTrainers = trainersWithTeam.filter((t) => !combatantTrainerIds.has(t.id)).map((t) => ({ id: t.id, name: t.name, is_npc: t.is_npc }))
    npcTeamPokemon = trainersWithTeam
      .filter((t) => t.is_npc)
      .flatMap((t) =>
        t.trainers_pokemon
          .filter((tp) => tp.party_slot !== null && tp.pokemon && !combatantPokemonIds.has(tp.pokemon.id))
          .map((tp) => ({ id: tp.pokemon!.id, label: `${tp.pokemon!.nickname ? `${tp.pokemon!.nickname} (${tp.pokemon!.pokedex?.name})` : tp.pokemon!.pokedex?.name} — ${t.name}` })),
      )
    campaignPool = ((poolRaw ?? []) as unknown as { id: string; nickname: string | null; pokedex: { name: string } | null; trainers_pokemon: unknown }[])
      .filter((p) => !p.trainers_pokemon && !combatantPokemonIds.has(p.id))
      .map((p) => ({ id: p.id, nickname: p.nickname, pokedex: p.pokedex }))
  }

  // Member-only data (self-service join/send-out) -- their own Trainers in this Campaign, and their
  // own Team Pokemon on any of those Trainers. Meaningless once the encounter isn't active.
  let ownTrainers: { id: string; name: string }[] = []
  let ownTeamPokemon: { id: string; nickname: string | null; pokedex: { name: string } | null }[] = []
  // Unfiltered (unlike ownTrainers/ownTeamPokemon, which exclude anyone already a combatant, for the
  // "Join the fight"/"Send out" dropdowns) -- Attack Resolver and Trainer Actions need to know which
  // *already-in-combat* Pokemon/Trainers are the player's own.
  let ownTrainerIds = new Set<string>()
  let ownTeamPokemonIds = new Set<string>()
  if (!isGM && isActive) {
    // Bug fix (2026-09-14): backs both the eligibility restrictions from
    // [[Feature - Only active player on initiative tracker can do an action]] and the Join/Send-out
    // dropdowns -- same poisoned-pooled-connection vulnerability as the other queries on this page (see
    // singleWithRetry's own comment), retried the same way.
    const { data: ownTrainersRaw } = await singleWithRetry(() =>
      supabase
        .from('trainers')
        .select('id, name, trainers_pokemon(party_slot, pokemon(id, nickname, pokedex(name)))')
        .eq('campaign_id', campaignId)
        .eq('user_id', user.id)
        .eq('is_npc', false),
    )
    ownTrainerIds = new Set((ownTrainersRaw ?? []).map((t) => t.id))
    ownTrainers = (ownTrainersRaw ?? []).filter((t) => !combatantTrainerIds.has(t.id)).map((t) => ({ id: t.id, name: t.name }))
    const allOwnTeamPokemon = ((ownTrainersRaw ?? []) as unknown as { trainers_pokemon: { party_slot: number | null; pokemon: { id: string; nickname: string | null; pokedex: { name: string } | null } | null }[] }[])
      .flatMap((t) => t.trainers_pokemon)
      .filter((tp): tp is { party_slot: number; pokemon: NonNullable<typeof tp.pokemon> } => tp.party_slot !== null && tp.pokemon !== null)
      .map((tp) => tp.pokemon)
    ownTeamPokemonIds = new Set(allOwnTeamPokemon.map((p) => p.id))
    ownTeamPokemon = allOwnTeamPokemon.filter((p) => !combatantPokemonIds.has(p.id))
  }

  // [[Feature - Add attack resolution to combat encounters]]: attacker options are Pokemon combatants
  // only (see the FR's own scoping) -- the GM can attack with any of them, a member only with their
  // own. Target options are every combatant, either kind, any side (a status/support Move can target
  // an ally too). Moves are fetched once active is confirmed rather than for every page load.
  //
  // [[Feature - Only active player on initiative tracker can do an action]]: a member's own Pokemon is
  // only offered as an attacker while it's actually that combatant's turn -- restricting the option set
  // itself (not a disabled state) reuses the exact same data this page already computes
  // (currentCombatantId), matching this codebase's existing "eligible list" pattern elsewhere on this
  // page. GM stays fully exempt, per the FR -- can still attack as any combatant regardless of turn.
  let attackerOptions: AttackerOption[] = []
  const targetOptions: TargetOption[] = combatants.map((c) => ({
    id: c.id,
    name: combatantName(c),
    side: c.side,
    trainerId: c.trainers?.id ?? null,
    pokemonId: c.pokemon?.id ?? null,
  }))
  if (isActive) {
    const pokemonCombatants = combatants.filter((c): c is CombatantRow & { pokemon: NonNullable<CombatantRow['pokemon']> } => c.pokemon !== null)
    const eligible = pokemonCombatants.filter((c) => isGM || (ownTeamPokemonIds.has(c.pokemon.id) && c.id === currentCombatantId))
    if (eligible.length > 0) {
      // Bug fix (2026-09-14): reproduced live while running a full multi-player encounter test --
      // this query has the exact same unguarded vulnerability to a poisoned pooled connection as the
      // `encounters`/`campaigns` queries above (see singleWithRetry's own comment): it silently came
      // back empty for a Pokemon that genuinely knows a Move, with no thrown error, making a real
      // attacker's Move dropdown show nothing to select. singleWithRetry's "retry once on any error"
      // behavior applies just as well here (a plain multi-row select never returns PGRST116 for an
      // empty result -- there's no special case to avoid, unlike the .single() call sites).
      const { data: movesRaw } = await singleWithRetry(() =>
        supabase
          .from('pokemon_moves')
          .select('pokemon_id, moves(id, name)')
          .in(
            'pokemon_id',
            eligible.map((c) => c.pokemon.id),
          ),
      )
      const movesByPokemonId = new Map<string, { id: number; name: string }[]>()
      for (const row of (movesRaw ?? []) as unknown as { pokemon_id: string; moves: { id: number; name: string } | null }[]) {
        if (!row.moves) continue
        const arr = movesByPokemonId.get(row.pokemon_id) ?? []
        arr.push(row.moves)
        movesByPokemonId.set(row.pokemon_id, arr)
      }
      attackerOptions = eligible.map((c) => ({ id: c.id, pokemonId: c.pokemon.id, side: c.side, name: combatantName(c), moves: movesByPokemonId.get(c.pokemon.id) ?? [] }))
    }
  }

  // [[Feature - Trainers should see actions they could do in an Encounter]]: self-service for a
  // member's own Trainer combatant(s), full access for the GM over any Trainer combatant -- same
  // access model as attack resolution and recall/send-out. Deliberately generic: "Use" a Feature or
  // Item only ever calls the *existing* setFeatureUsesRemaining/useItem actions (exactly what the
  // Trainer's own page and Bag already call) -- what a specific Feature actually does when triggered
  // stays that Feature's own FR to automate, same relationship attack resolution has with Afflictions/
  // stat changes today. Trainer Moves are read-only -- no resolution or "use" action exists for those,
  // matching attack resolution's own Pokemon-only scoping.
  //
  // [[Feature - Only active player on initiative tracker can do an action]]: the panel itself still
  // shows for a member's own Trainer combatant regardless of turn (Moves stay visible/read-only either
  // way, per the FR), but each one carries its own isCurrentTurn -- TrainerActionsPanel disables the
  // Use buttons on Features/Items unless it's actually that Trainer combatant's turn. GM stays fully
  // exempt, per the FR.
  let trainerActionsData: TrainerActionsData[] = []
  if (isActive) {
    const trainerCombatants = combatants.filter((c): c is CombatantRow & { trainers: NonNullable<CombatantRow['trainers']> } => c.trainers !== null)
    const eligibleTrainers = trainerCombatants.filter((c) => isGM || ownTrainerIds.has(c.trainers.id))
    trainerActionsData = await Promise.all(
      eligibleTrainers.map(async (c) => {
        const trainerId = c.trainers.id
        const [{ activeFeatures }, { data: featureUses }, { data: trainerMovesRaw }, bag] = await Promise.all([
          loadTrainerDerived(supabase, trainerId, { classId: c.trainers.class_id ?? 0, level: c.trainers.level }),
          supabase.from('trainer_feature_uses').select('feature_id, uses_remaining').eq('trainer_id', trainerId),
          supabase.from('trainer_moves').select('uses_remaining, moves(name)').eq('trainer_id', trainerId),
          loadBagSnapshot(supabase, trainerId),
        ])
        const usesRemainingByFeature = Object.fromEntries((featureUses ?? []).map((fu) => [fu.feature_id, fu.uses_remaining]))
        return {
          trainerId,
          trainerName: c.trainers.name,
          isCurrentTurn: isGM || c.id === currentCombatantId,
          moves: ((trainerMovesRaw ?? []) as unknown as { uses_remaining: number | null; moves: { name: string } | null }[])
            .filter((m) => m.moves)
            .map((m) => ({ name: m.moves!.name, usesRemaining: m.uses_remaining })),
          features: activeFeatures.map((f) => ({
            id: f.id,
            name: f.name,
            description: f.description,
            usesRemaining: f.max_uses !== null ? (usesRemainingByFeature[f.id] ?? f.max_uses) : null,
          })),
          items: bag.items.filter((i) => i.quantity > 0).map((i) => ({ id: i.id, name: i.name, quantity: i.quantity })),
        }
      }),
    )
  }

  function combatantMaxHp(c: CombatantRow): number {
    if (c.trainers) return trainerMaxHpById.get(c.trainers.id) ?? c.trainers.current_hp
    if (c.pokemon) return computePokemonMaxHp(c.pokemon.pokedex?.base_hp ?? 0, c.pokemon.bonus_base_hp, c.pokemon.ev_hp, evsDisabled)
    return 0
  }

  function combatantName(c: CombatantRow): string {
    if (c.trainers) return c.trainers.name
    if (c.pokemon) {
      if (!combatantIsIdentified(c)) return 'Unidentified Pokémon'
      return c.pokemon.nickname ? `${c.pokemon.nickname} (${c.pokemon.pokedex?.name})` : (c.pokemon.pokedex?.name ?? 'Unknown')
    }
    return 'Unknown'
  }

  // Returns null (no link) for an unidentified opponent -- nothing about it is knowable yet, including
  // that its own detail page exists to click through to.
  function combatantHref(c: CombatantRow): string | null {
    if (c.trainers) return trainerHref({ id: c.trainers.id, is_npc: c.trainers.is_npc, campaign_id: c.trainers.campaign_id })
    if (c.pokemon) return combatantIsIdentified(c) ? pokemonHref({ id: c.pokemon.id, hasOwner: c.trainers !== null, campaignId }) : null
    return '#'
  }

  return (
    <main className="flex min-h-screen justify-center p-24">
      {isActive && <EncounterLivePoll />}
      {/* [[Improvement - Move initiative tracker to a right sidebar]]: same two-column shape as the PC
          board's own sidebar (`flex ... items-start gap-4` wrapping a flex-1 main column and a
          `sticky top-4 w-64 shrink-0` aside) -- only the tracker moves; everything else keeps its
          existing max-w-2xl width inside the now-narrower main column. No responsive stacking, per the
          user -- matches that same existing precedent, which has none either. */}
      <div className="flex w-full max-w-6xl items-start gap-4">
        <div className="flex flex-1 flex-col items-center gap-6">
          <div className="w-full max-w-2xl">
            <Link href={isGM ? `/campaigns/${campaignId}/encounters` : `/campaigns/${campaignId}`} className="text-sm underline">
              ← {isGM ? 'Encounters' : campaign.name}
            </Link>
          </div>

          <div className="flex w-full max-w-2xl items-center justify-between">
            <h1 className="text-2xl font-bold">
              {encounter.name} <span className="text-base font-normal text-muted">({encounter.status})</span>
            </h1>
            {isGM && (
              <div className="flex gap-2">
                {isDraft && (
                  <form action={startEncounter.bind(null, campaignId, encounterId)}>
                    <button type="submit" className="rounded bg-accent px-4 py-2 text-sm text-accent-foreground">
                      Start encounter
                    </button>
                  </form>
                )}
                {isActive && (
                  <>
                    <form action={advanceTurn.bind(null, encounterId, campaignId)}>
                      <button type="submit" className="rounded border px-4 py-2 text-sm">
                        Advance turn
                      </button>
                    </form>
                    <form action={resetEncounterToDraft.bind(null, campaignId, encounterId)}>
                      <ConfirmButton
                        confirmMessage="Reset this encounter back to Draft? Every combatant's initiative and the current turn will be cleared -- you'll need to Start it again to re-roll."
                        className="rounded border px-4 py-2 text-sm"
                      >
                        Reset to draft
                      </ConfirmButton>
                    </form>
                  </>
                )}
                <form action={deleteEncounter.bind(null, campaignId, encounterId)}>
                  <ConfirmButton confirmMessage={`Permanently delete "${encounter.name}"? This cannot be undone.`} className="rounded border border-danger px-4 py-2 text-sm text-danger">
                    Delete
                  </ConfirmButton>
                </form>
              </div>
            )}
          </div>

          {error && <p className="w-full max-w-2xl text-danger">{error}</p>}

          {isGM && (
            <div className="flex w-full max-w-2xl flex-col gap-3 rounded border-accent bg-accent/10 p-4 text-sm">
              <h2 className="font-semibold">Add a combatant</h2>
              {isDraft && (
                <p className="text-xs text-muted">
                  No initiative is rolled yet while this Encounter is a Draft -- it's filled in automatically (or you can set it by hand
                  below) once you Start it.
                </p>
              )}

              {campaignTrainers.length > 0 && (
                <form action={addTrainerCombatant.bind(null, encounterId, campaignId)} className="flex flex-wrap items-end gap-2">
                  <div className="flex flex-col gap-1">
                    <label htmlFor="trainerId">Trainer / NPC</label>
                    <select id="trainerId" name="trainerId" required defaultValue="" className="bg-surface-subtle rounded border p-2">
                      <option value="" disabled>
                        Select...
                      </option>
                      {campaignTrainers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                          {t.is_npc ? ' (NPC)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  {npcTeamPokemon.length > 0 && (
                    <div className="flex flex-col gap-1">
                      <label htmlFor="teamPokemonId">Team member (for an NPC)</label>
                      <select id="teamPokemonId" name="teamPokemonId" defaultValue="" className="bg-surface-subtle rounded border p-2">
                        <option value="">None</option>
                        {npcTeamPokemon.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="flex flex-col gap-1">
                    <label htmlFor="side1">Side</label>
                    <select id="side1" name="side" defaultValue="enemy" className="bg-surface-subtle rounded border p-2">
                      <option value="ally">Ally</option>
                      <option value="enemy">Enemy</option>
                    </select>
                  </div>
                  {isDraft ? (
                    <button type="submit" className="rounded border px-3 py-2">
                      Add
                    </button>
                  ) : (
                    <RollInputButton
                      promptMessage="Roll a d20 for initiative and enter the result (1-20)."
                      min={1}
                      max={20}
                      fieldName="d20Roll"
                      formAction={addTrainerCombatant.bind(null, encounterId, campaignId)}
                      className="rounded border px-3 py-2"
                    >
                      Add (roll d20)
                    </RollInputButton>
                  )}
                </form>
              )}

              {campaignPool.length > 0 && (
                <form action={addPokemonCombatant.bind(null, encounterId, campaignId)} className="flex flex-wrap items-end gap-2">
                  <div className="flex flex-col gap-1">
                    <label htmlFor="pokemonId">Wild Pokémon</label>
                    <select id="pokemonId" name="pokemonId" required defaultValue="" className="bg-surface-subtle rounded border p-2">
                      <option value="" disabled>
                        Select...
                      </option>
                      {campaignPool.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nickname ? `${p.nickname} (${p.pokedex?.name})` : p.pokedex?.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="side2">Side</label>
                    <select id="side2" name="side" defaultValue="enemy" className="bg-surface-subtle rounded border p-2">
                      <option value="ally">Ally</option>
                      <option value="enemy">Enemy</option>
                    </select>
                  </div>
                  <button type="submit" className="rounded border px-3 py-2">
                    Add
                  </button>
                </form>
              )}

              {campaignTrainers.length === 0 && campaignPool.length === 0 && (
                <p className="text-xs text-muted">No Trainers, NPCs, or unassigned Wild Pokémon in this Campaign to add yet.</p>
              )}
            </div>
          )}

          {/* [[Feature - Hide certain sections in Encounters]]: hides entirely once the player has
              already joined with everything they have, rather than showing the section with an
              explanatory "nothing to join with" message -- that message read oddly once the real
              reason was "already joined," not "nothing exists." GM stays unaffected (this section
              never showed for the GM in the first place). */}
          {!isGM && isActive && (ownTrainers.length > 0 || ownTeamPokemon.length > 0) && (
            <div className="flex w-full max-w-2xl flex-col gap-3 rounded border-accent bg-accent/10 p-4 text-sm">
              <h2 className="font-semibold">Join the fight</h2>

              {ownTrainers.length > 0 && (
                <form action={addTrainerCombatant.bind(null, encounterId, campaignId)} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="side" value="ally" />
                  <div className="flex flex-col gap-1">
                    <label htmlFor="joinTrainerId">Your Trainer</label>
                    <select id="joinTrainerId" name="trainerId" required defaultValue="" className="bg-surface-subtle rounded border p-2">
                      <option value="" disabled>
                        Select...
                      </option>
                      {ownTrainers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <RollInputButton
                    promptMessage="Roll a d20 for initiative and enter the result (1-20)."
                    min={1}
                    max={20}
                    fieldName="d20Roll"
                    formAction={addTrainerCombatant.bind(null, encounterId, campaignId)}
                    className="rounded bg-accent px-3 py-2 text-accent-foreground"
                  >
                    Join (roll d20)
                  </RollInputButton>
                </form>
              )}

              {ownTeamPokemon.length > 0 && (
                <form action={addPokemonCombatant.bind(null, encounterId, campaignId)} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="side" value="ally" />
                  <div className="flex flex-col gap-1">
                    <label htmlFor="sendPokemonId">Send out a Pokémon</label>
                    <select id="sendPokemonId" name="pokemonId" required defaultValue="" className="bg-surface-subtle rounded border p-2">
                      <option value="" disabled>
                        Select...
                      </option>
                      {ownTeamPokemon.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nickname ? `${p.nickname} (${p.pokedex?.name})` : p.pokedex?.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button type="submit" className="rounded bg-accent px-3 py-2 text-accent-foreground">
                    Send out
                  </button>
                </form>
              )}
            </div>
          )}

          {/* [[Feature - Hide certain sections in Encounters]]: hides entirely for a non-GM player
              when it isn't their own Pokemon's turn, rather than showing the panel with "No Pokemon
              combatants available to attack with." Stays visible unconditionally for the GM (who can
              always attack with any Pokemon combatant, or hits that same message if there are truly
              none in the encounter at all). */}
          {isActive && (isGM || attackerOptions.length > 0) && (
            <AttackResolver
              attackers={attackerOptions}
              targets={targetOptions}
              currentAttackerId={currentCombatantId}
              isGM={isGM}
              encounterId={encounterId}
              campaignId={campaignId}
            />
          )}

          {isActive && trainerActionsData.length > 0 && <TrainerActionsPanel trainers={trainerActionsData} />}
        </div>

        <aside className="sticky top-4 flex w-64 shrink-0 flex-col gap-2">
          {sortedForDisplay.length === 0 ? (
            <p className="text-sm text-muted">No combatants yet.</p>
          ) : (
            sortedForDisplay.map((c) => (
              <div
                key={c.id}
                className={`flex flex-col gap-2 rounded border p-3 ${
                  c.id === currentCombatantId ? 'border-2 border-warning bg-warning/10' : 'border-accent bg-accent/10'
                } ${combatantIsDown(c) ? 'opacity-50' : ''}`}
              >
                <div className="flex items-start gap-2">
                  {c.pokemon && !combatantIsIdentified(c) ? (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-surface-muted text-sm text-muted">?</div>
                  ) : (
                    c.pokemon?.pokedex?.sprite_code && (
                      <PokemonSprite spriteCode={c.pokemon.pokedex.sprite_code} shiny={c.pokemon.is_shiny} alt={combatantName(c)} size={32} />
                    )
                  )}
                  <div className="min-w-0">
                    <p className="text-sm">
                      <span className={`mr-1 rounded px-1.5 py-0.5 text-xs font-semibold ${c.side === 'ally' ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`}>
                        {c.side === 'ally' ? 'Ally' : 'Enemy'}
                      </span>
                      {/* [[Feature - Show more Pokemon and trainer information in Encounters]]: the
                          name is now a clickable trigger for the info overlay, regardless of whether
                          it's identified -- an unidentified enemy's overlay just says so, matching the
                          gating already enforced server-side in combatantDetailActions.ts. The old
                          navigate-away link still exists inside the overlay itself ("View full page"),
                          for the rare case something actually needs editing there. */}
                      <CombatantDetailModal combatantId={c.id} label={combatantName(c)} href={combatantHref(c)} />
                      {combatantTypeLabel(c) && <span className="text-muted"> -- {combatantTypeLabel(c)}</span>}
                    </p>
                    {c.id === currentCombatantId && <p className="text-xs font-semibold text-warning">← Current turn</p>}
                    <p className="text-xs text-muted">
                      {c.trainers ? c.trainers.current_hp : c.pokemon?.current_hp}/{combatantMaxHp(c)} HP · Initiative{' '}
                      {c.turn_order ?? 'not set'}
                      {combatantIsDown(c) ? ' · Down (0 HP)' : ''}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {isGM && (
                    <>
                      <form action={setCombatantInitiative.bind(null, encounterId, campaignId, c.id)} className="flex items-center gap-1">
                        <input
                          type="number"
                          name="turnOrder"
                          defaultValue={c.turn_order ?? ''}
                          placeholder="Init."
                          className="bg-surface-subtle w-16 rounded border px-1 py-1 text-xs"
                        />
                        <button type="submit" className="rounded border px-2 py-1 text-xs">
                          Set
                        </button>
                      </form>
                      <form action={removeCombatant.bind(null, encounterId, campaignId, c.id)}>
                        <ConfirmButton confirmMessage={`Remove ${combatantName(c)} from this encounter?`} className="rounded border border-danger px-2 py-1 text-xs text-danger">
                          Remove
                        </ConfirmButton>
                      </form>
                    </>
                  )}
                  {/* Bug fix (2026-09-13): these two used to check `ownTrainers`/`ownTeamPokemon` --
                      but those are deliberately *filtered to exclude anyone already a combatant*
                      (they back the "Join the fight"/"Send out" dropdowns, per the comment on their own
                      declaration above). That meant Leave/Recall could never appear for the exact
                      combatant row they're meant to act on, since being a combatant is precisely what
                      got it excluded from that list. Fixed to use the unfiltered `ownTrainerIds`/
                      `ownTeamPokemonIds` sets instead -- the same ones Attack Resolver/Trainer Actions
                      already rely on for this identical "is this already-in-combat one mine" check. */}
                  {!isGM && c.trainers?.id && ownTrainerIds.has(c.trainers.id) && (
                    <form action={removeCombatant.bind(null, encounterId, campaignId, c.id)}>
                      <ConfirmButton confirmMessage="Leave this encounter?" className="rounded border px-2 py-1 text-xs">
                        Leave
                      </ConfirmButton>
                    </form>
                  )}
                  {!isGM && c.pokemon?.id && ownTeamPokemonIds.has(c.pokemon.id) && (
                    <form action={removeCombatant.bind(null, encounterId, campaignId, c.id)}>
                      <ConfirmButton confirmMessage="Recall this Pokémon from the encounter?" className="rounded border px-2 py-1 text-xs">
                        Recall
                      </ConfirmButton>
                    </form>
                  )}
                  {/* [[Feature - Only active player on initiative tracker can do an action]]: the new
                      self-service escape hatch -- a player who doesn't want to (or can't) act on their
                      own turn no longer has to wait on the GM's "Advance turn". Only offered on the
                      player's own current-turn combatant; skip_my_turn() re-checks ownership itself
                      server-side regardless. */}
                  {!isGM && c.id === currentCombatantId && ((c.trainers?.id && ownTrainerIds.has(c.trainers.id)) || (c.pokemon?.id && ownTeamPokemonIds.has(c.pokemon.id))) && (
                    <form action={skipMyTurn.bind(null, encounterId, campaignId)}>
                      <button type="submit" className="rounded border px-2 py-1 text-xs">
                        Skip turn
                      </button>
                    </form>
                  )}
                  {c.pokemon && !combatantIsIdentified(c) && (
                    <form action={scanSpecies.bind(null, encounterId, campaignId, c.pokemon.pokedex_id)}>
                      <button type="submit" className="rounded border border-accent px-2 py-1 text-xs font-semibold text-accent">
                        Use Pokédex
                      </button>
                    </form>
                  )}
                </div>
              </div>
            ))
          )}
        </aside>
      </div>
    </main>
  )
}
