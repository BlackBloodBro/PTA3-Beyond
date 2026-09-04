import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { computeLoyaltyTier } from '@/lib/pta3/pokemonLevel'
import type { BreedingCandidate } from '@/lib/pta3/breeding'
import { trainerHasBaseClassFeature } from '@/lib/pta3/trainerFeatures'
import { BreedingBoard } from '@/app/(authenticated)/breeding/BreedingBoard'

// [[Feature - Add a Pokemon Breeding Check mechanic]]: a campaign-less Trainer has no Campaign roster
// to breed against (no fellow players, no GM to arbitrate an NPC pairing) -- found missing during
// Testing, per the user. Scoped to just this one Trainer's own two Pokemon, paired with each other,
// mirroring the personal Bag page's own "campaign-less only" shape exactly.
export default async function TrainerBreedingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: trainer } = await supabase.from('trainers').select('id, name, user_id, campaign_id').eq('id', id).single()

  if (!trainer) {
    redirect('/dashboard')
  }

  // Any Trainer belonging to a Campaign breeds via /campaigns/[id]/breeding instead, against the
  // whole roster -- this route only ever serves campaign-less Trainers.
  if (trainer.campaign_id) {
    notFound()
  }

  // No GM to defer to for a campaign-less Trainer -- owner only, same as the personal Bag page.
  if (trainer.user_id !== user.id) {
    redirect(`/trainers/${id}`)
  }

  const [{ data: pokemonRows }, { data: loyaltyRows }] = await Promise.all([
    supabase
      .from('trainers_pokemon')
      .select(
        `
        pokemon(
          id, nickname, gender, pokedex_id, loyalty_points, nature_id,
          pokedex(name, pokedex_egg_groups(egg_group_id)),
          pokemon_afflictions(affliction_id)
        )
      `,
      )
      .eq('trainer_id', id),
    supabase.from('loyalties').select('name, sort_order, min_points'),
  ])

  // Reverse-embed quirk documented throughout this codebase -- `pokemon` comes back as a single
  // object at runtime here, not the array TS infers. `pokedex_egg_groups`/`pokemon_afflictions` are
  // genuinely one-to-many, so those really do come back as arrays.
  type Row = {
    pokemon: {
      id: string
      nickname: string | null
      gender: string | null
      pokedex_id: number
      loyalty_points: number
      nature_id: number | null
      pokedex: { name: string; pokedex_egg_groups: { egg_group_id: number }[] } | null
      pokemon_afflictions: { affliction_id: number }[]
    } | null
  }

  const candidates: BreedingCandidate[] = ((pokemonRows ?? []) as unknown as Row[])
    .filter((r) => r.pokemon)
    .map((r) => ({
      id: r.pokemon!.id,
      name: r.pokemon!.nickname ?? r.pokemon!.pokedex?.name ?? 'Unknown',
      speciesName: r.pokemon!.pokedex?.name ?? 'Unknown',
      pokedexId: r.pokemon!.pokedex_id,
      gender: r.pokemon!.gender,
      loyaltyTier: computeLoyaltyTier(r.pokemon!.loyalty_points, loyaltyRows ?? [])?.sort_order ?? 0,
      // No Campaign, so no cross-Trainer/NPC concept applies -- both candidates are always this same
      // Trainer's own, which the Friendship-tier math already resolves to Friends/Romantic correctly
      // via sameTrainer without needing a real trainerId to compare against.
      trainerId: id,
      trainerName: trainer.name,
      trainerIsNpc: false,
      eggGroupIds: (r.pokemon!.pokedex?.pokedex_egg_groups ?? []).map((g) => g.egg_group_id),
      hasActiveAffliction: (r.pokemon!.pokemon_afflictions ?? []).length > 0,
    }))

  const [hasUnexpectedHatch, hasEggFinder, hasUnlikelyPairings] = await Promise.all([
    trainerHasBaseClassFeature(supabase, id, 'Unexpected Hatch'),
    trainerHasBaseClassFeature(supabase, id, 'Egg Finder'),
    trainerHasBaseClassFeature(supabase, id, 'Unlikely Pairings'),
  ])

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-24">
      <div className="w-full max-w-2xl">
        <Link href={`/trainers/${id}`} className="text-sm underline">
          ← {trainer.name}
        </Link>
      </div>

      <div className="w-full max-w-2xl">
        <h1 className="text-2xl font-bold">Breeding</h1>
      </div>

      <BreedingBoard
        campaignId={null}
        initiatingTrainerId={id}
        initiatingTrainerName={trainer.name}
        candidates={candidates}
        hasUnexpectedHatch={hasUnexpectedHatch}
        hasEggFinder={hasEggFinder}
        hasUnlikelyPairings={hasUnlikelyPairings}
      />
    </main>
  )
}
