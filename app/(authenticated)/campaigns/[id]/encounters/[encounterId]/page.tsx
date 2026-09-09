import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { trainerHref } from '@/lib/pta3/trainerPaths'
import { pokemonHref } from '@/lib/pta3/pokemonPaths'
import { PokemonSprite } from '@/components/PokemonSprite'
import { ConfirmButton } from '@/components/ConfirmButton'
import { RollInputButton } from '@/components/RollInputButton'
import { loadQualifyingMilestones, computeMaxHp, loadTrainerDerived } from '@/lib/pta3/trainerFeatures'
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
} from '../actions'
import { AttackResolver, type AttackerOption, type TargetOption } from './AttackResolver'
import { EncounterLivePoll } from './EncounterLivePoll'
import { TrainerActionsPanel, type TrainerActionsData } from './TrainerActionsPanel'

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
    id: string; nickname: string | null; current_hp: number; is_shiny: boolean; bonus_base_hp: number; ev_hp: number
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

  const { data: campaign } = await supabase.from('campaigns').select('id, name, gm_user_id').eq('id', campaignId).single()
  if (!campaign) {
    redirect('/dashboard')
  }
  const isGM = campaign.gm_user_id === user.id

  const { data: encounterRaw } = await supabase
    .from('encounters')
    .select('id, campaign_id, name, status, current_turn_position, started_at, ended_at')
    .eq('id', encounterId)
    .single()

  // RLS already scopes what a non-GM can even see (only their own campaign's *active* encounter) --
  // this just resolves the right redirect for every other case (wrong campaign in the URL, or the
  // encounter genuinely doesn't exist/isn't visible to this user).
  if (!encounterRaw || encounterRaw.campaign_id !== campaignId) {
    redirect(isGM ? `/campaigns/${campaignId}/encounters` : `/campaigns/${campaignId}`)
  }
  const encounter = encounterRaw!
  const isDraft = encounter.status === 'draft'
  const isActive = encounter.status === 'active'

  const { data: combatantsRaw } = await supabase
    .from('encounter_combatants')
    .select(
      `
      id, side, trainer_id, pokemon_id, turn_order,
      trainers(id, name, level, current_hp, is_npc, campaign_id, class_id, classes(name)),
      pokemon(id, nickname, current_hp, is_shiny, bonus_base_hp, ev_hp, pokedex(name, sprite_code, base_hp))
    `,
    )
    .eq('encounter_id', encounterId)

  // Same reverse/forward-embed quirk documented throughout this codebase -- trainers/pokemon/classes/
  // pokedex come back as single objects at runtime, not the arrays TS infers.
  const combatants = (combatantsRaw ?? []) as unknown as CombatantRow[]

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
  const activeSorted = [...combatants]
    .filter((c) => !combatantIsDown(c) && c.turn_order !== null)
    .sort((a, b) => b.turn_order! - a.turn_order!)
  const currentCombatantId = isActive && activeSorted.length > 0 ? activeSorted[encounter.current_turn_position % activeSorted.length].id : null
  const sortedForDisplay = [...combatants].sort((a, b) => (b.turn_order ?? -Infinity) - (a.turn_order ?? -Infinity))

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
    const { data: ownTrainersRaw } = await supabase
      .from('trainers')
      .select('id, name, trainers_pokemon(party_slot, pokemon(id, nickname, pokedex(name)))')
      .eq('campaign_id', campaignId)
      .eq('user_id', user.id)
      .eq('is_npc', false)
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
    const eligible = pokemonCombatants.filter((c) => isGM || ownTeamPokemonIds.has(c.pokemon.id))
    if (eligible.length > 0) {
      const { data: movesRaw } = await supabase
        .from('pokemon_moves')
        .select('pokemon_id, moves(id, name)')
        .in(
          'pokemon_id',
          eligible.map((c) => c.pokemon.id),
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
    if (c.pokemon) return (c.pokemon.pokedex?.base_hp ?? 0) + c.pokemon.bonus_base_hp + c.pokemon.ev_hp * 6
    return 0
  }

  function combatantName(c: CombatantRow): string {
    if (c.trainers) return c.trainers.name
    if (c.pokemon) return c.pokemon.nickname ? `${c.pokemon.nickname} (${c.pokemon.pokedex?.name})` : (c.pokemon.pokedex?.name ?? 'Unknown')
    return 'Unknown'
  }

  function combatantHref(c: CombatantRow): string {
    if (c.trainers) return trainerHref({ id: c.trainers.id, is_npc: c.trainers.is_npc, campaign_id: c.trainers.campaign_id })
    if (c.pokemon) return pokemonHref({ id: c.pokemon.id, hasOwner: c.trainers !== null, campaignId })
    return '#'
  }

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-24">
      {isActive && <EncounterLivePoll />}
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

      <div className="flex w-full max-w-2xl flex-col gap-2">
        {sortedForDisplay.length === 0 ? (
          <p className="text-sm text-muted">No combatants yet.</p>
        ) : (
          sortedForDisplay.map((c) => (
            <div
              key={c.id}
              className={`flex items-center justify-between gap-2 rounded border p-3 ${
                c.id === currentCombatantId ? 'border-2 border-warning bg-warning/10' : 'border-accent bg-accent/10'
              } ${combatantIsDown(c) ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center gap-2">
                {c.pokemon?.pokedex?.sprite_code && (
                  <PokemonSprite spriteCode={c.pokemon.pokedex.sprite_code} shiny={c.pokemon.is_shiny} alt={combatantName(c)} size={32} />
                )}
                <div>
                  <p className="text-sm">
                    <span className={`mr-1 rounded px-1.5 py-0.5 text-xs font-semibold ${c.side === 'ally' ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`}>
                      {c.side === 'ally' ? 'Ally' : 'Enemy'}
                    </span>
                    <Link href={combatantHref(c)} className="font-semibold underline">
                      {combatantName(c)}
                    </Link>
                    {c.id === currentCombatantId && <span className="ml-2 text-xs font-semibold text-warning">← Current turn</span>}
                  </p>
                  <p className="text-xs text-muted">
                    {c.trainers ? c.trainers.current_hp : c.pokemon?.current_hp}/{combatantMaxHp(c)} HP · Initiative{' '}
                    {c.turn_order ?? 'not set'}
                    {combatantIsDown(c) ? ' · Down (0 HP)' : ''}
                  </p>
                </div>
              </div>
              {isGM && (
                <div className="flex items-center gap-2">
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
                </div>
              )}
              {!isGM && c.trainers?.id && ownTrainers.some((t) => t.id === c.trainers!.id) && (
                <form action={removeCombatant.bind(null, encounterId, campaignId, c.id)}>
                  <ConfirmButton confirmMessage="Leave this encounter?" className="rounded border px-2 py-1 text-xs">
                    Leave
                  </ConfirmButton>
                </form>
              )}
              {!isGM && c.pokemon?.id && ownTeamPokemon.some((p) => p.id === c.pokemon!.id) && (
                <form action={removeCombatant.bind(null, encounterId, campaignId, c.id)}>
                  <ConfirmButton confirmMessage="Recall this Pokémon from the encounter?" className="rounded border px-2 py-1 text-xs">
                    Recall
                  </ConfirmButton>
                </form>
              )}
            </div>
          ))
        )}
      </div>

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

      {!isGM && isActive && (
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

          {ownTrainers.length === 0 && ownTeamPokemon.length === 0 && (
            <p className="text-xs text-muted">You don&apos;t have a Trainer or Team Pokémon in this Campaign to join with.</p>
          )}
        </div>
      )}

      {isActive && <AttackResolver attackers={attackerOptions} targets={targetOptions} currentAttackerId={currentCombatantId} />}

      {isActive && trainerActionsData.length > 0 && <TrainerActionsPanel trainers={trainerActionsData} />}
    </main>
  )
}
