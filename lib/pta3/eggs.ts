import type { SupabaseClient } from '@supabase/supabase-js'
import { trainerHasBaseClassFeature } from './trainerFeatures'

// [[Feature - Add Egg hatching logic]]

export type AvailableEgg = {
  trainersItemId: string
  pokedexId: number | null
  speciesName: string | null
  natureId: number | null
  natureName: string | null
  quantity: number
}

export type InProgressEgg = {
  id: string
  pokedexId: number
  speciesName: string
  sleepsCompleted: number
  sleepsRequired: number
  ready: boolean
}

export type EggSnapshot = {
  // Every "Egg" stack row in this Trainer's Bag -- each distinct pokedex_id/nature_id combo is its
  // own row already (same stacking key addToBag uses), so this doubles as the list of options a
  // "Start Hatching" picker offers.
  availableEggs: AvailableEgg[]
  // Only one at a time -- enforced at start (see actions.ts), not just a display convenience.
  inProgress: InProgressEgg | null
  hasNaturalEdge: boolean
}

export async function loadEggSnapshot(supabase: SupabaseClient, trainerId: string): Promise<EggSnapshot> {
  const [{ data: itemRows }, { data: eggRow }, hasNaturalEdge] = await Promise.all([
    supabase
      .from('trainers_items')
      .select('id, quantity, pokedex_id, nature_id, items!inner(name), pokedex(name), natures(name)')
      .eq('trainer_id', trainerId)
      .eq('items.name', 'Egg'),
    supabase
      .from('pokemon_eggs')
      .select('id, pokedex_id, sleeps_completed, sleeps_required, pokedex(name)')
      .eq('trainer_id', trainerId)
      .maybeSingle(),
    trainerHasBaseClassFeature(supabase, trainerId, 'Natural Edge'),
  ])

  // Reverse-embed quirk documented throughout this codebase -- pokedex/natures come back as single
  // objects at runtime here, not the arrays TS infers.
  type ItemRow = {
    id: string
    quantity: number
    pokedex_id: number | null
    nature_id: number | null
    pokedex: { name: string } | null
    natures: { name: string } | null
  }
  const availableEggs: AvailableEgg[] = ((itemRows ?? []) as unknown as ItemRow[]).map((r) => ({
    trainersItemId: r.id,
    pokedexId: r.pokedex_id,
    speciesName: r.pokedex?.name ?? null,
    natureId: r.nature_id,
    natureName: r.natures?.name ?? null,
    quantity: r.quantity,
  }))

  type EggRow = {
    id: string
    pokedex_id: number
    sleeps_completed: number
    sleeps_required: number
    pokedex: { name: string } | null
  } | null
  const egg = eggRow as unknown as EggRow
  const inProgress: InProgressEgg | null = egg
    ? {
        id: egg.id,
        pokedexId: egg.pokedex_id,
        speciesName: egg.pokedex?.name ?? 'Unknown',
        sleepsCompleted: egg.sleeps_completed,
        sleepsRequired: egg.sleeps_required,
        ready: egg.sleeps_completed >= egg.sleeps_required,
      }
    : null

  return { availableEggs, inProgress, hasNaturalEdge }
}
