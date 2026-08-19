import type { createClient } from '@/lib/supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

// Sets a Pokemon's permanent "original trainer" the first time it's ever linked to a Trainer -- only
// when not already set, so a Pokemon that's later unassigned/reassigned/gifted keeps its real original
// rather than getting overwritten. No DB-trigger precedent exists anywhere in this schema for "set
// once" logic (everything else is application-level TS), so this follows that same convention. Called
// from each of the 3 places a trainers_pokemon row is first created for a Pokemon: createPokemon,
// assignPokemon (both in app/(authenticated)/pokemon/actions.ts), and createStarterPokemon
// (app/(authenticated)/trainers/[id]/starter/actions.ts). Single conditional UPDATE rather than a
// read-then-write, so there's no race between checking and setting it.
export async function setOriginalTrainerIfUnset(
  supabase: SupabaseClient,
  pokemonId: string,
  trainerId: string,
  obtainMethodId: number | null,
): Promise<void> {
  await supabase
    .from('pokemon')
    .update({ original_trainer_id: trainerId, original_obtain_method_id: obtainMethodId })
    .eq('id', pokemonId)
    .is('original_trainer_id', null)
}
