import type { SupabaseClient } from '@supabase/supabase-js'

// [[Feature - Implement Trainer Moves]]: the moves a Trainer personally knows (separate from their Pokemon's moves).
// There is no learnset to gate them -- a Trainer Move comes from a Class Feature, an item, a story reward -- so the
// owner or the GM simply adds whichever Move applies. Everything else (uses, the Sleep recharge) mirrors a Pokemon's moves.
export type TrainerMoveInfo = {
  id: number
  name: string
  typeName: string | null
  damageStat: string
  range: string | null
  frequency: string
  damageDice: string | null
  description: string | null
}

export type KnownTrainerMove = TrainerMoveInfo & {
  usesRemaining: number | null
}

export type TrainerMovesSnapshot = {
  known: KnownTrainerMove[]
  // Every Move this Trainer could be given (global ones plus its own Campaign's custom ones). Only loaded for someone who
  // can edit -- a read-only viewer has no picker to fill.
  catalog: TrainerMoveInfo[]
}

type MoveRow = {
  id: number
  name: string
  damage_stat: string
  range: string | null
  frequency: string
  damage_dice: string | null
  description: string | null
  types: { name: string } | null
}

const MOVE_COLUMNS = 'id, name, damage_stat, range, frequency, damage_dice, description, types(name)'

function toInfo(m: MoveRow): TrainerMoveInfo {
  return {
    id: m.id,
    name: m.name,
    typeName: m.types?.name ?? null,
    damageStat: m.damage_stat,
    range: m.range,
    frequency: m.frequency,
    damageDice: m.damage_dice,
    description: m.description,
  }
}

export async function loadTrainerMoves(
  supabase: SupabaseClient,
  trainerId: string,
  campaignId: string | null,
  canEdit: boolean,
): Promise<TrainerMovesSnapshot> {
  const catalogQuery = supabase.from('moves').select(MOVE_COLUMNS).order('name')
  const [{ data: knownRows }, { data: catalogRows }] = await Promise.all([
    supabase.from('trainer_moves').select(`uses_remaining, moves(${MOVE_COLUMNS})`).eq('trainer_id', trainerId),
    canEdit
      ? campaignId
        ? catalogQuery.or(`campaign_id.is.null,campaign_id.eq.${campaignId}`)
        : catalogQuery.is('campaign_id', null)
      : Promise.resolve({ data: [] as unknown[] }),
  ])

  // Same single-row-embed quirk documented throughout this codebase: the embeds are one object at runtime, not the
  // array TS infers.
  const known = ((knownRows ?? []) as unknown as { uses_remaining: number | null; moves: MoveRow | null }[])
    .filter((r) => r.moves)
    .map((r) => ({ ...toInfo(r.moves!), usesRemaining: r.uses_remaining }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const catalog = ((catalogRows ?? []) as unknown as MoveRow[]).map(toInfo)

  return { known, catalog }
}
