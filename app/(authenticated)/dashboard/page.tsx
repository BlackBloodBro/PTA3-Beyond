import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Lightweight counts only -- the actual lists (with all their delete/assign controls) live on
  // their own dedicated pages now. Campaigns/trainers can use a plain head-count; Pokemon can't,
  // since a Pokemon you created and then assigned to your own trainer would otherwise be counted
  // twice (it matches both "created_by_user_id = you" and "linked to one of your trainers") -- so
  // this fetches just enough (ids + whether a trainers_pokemon link exists) to match the same
  // assigned-vs-unassigned split the /pokemon page itself uses, without pulling the full row data.
  const [
    { count: gmCampaignCount },
    { count: memberCampaignCount },
    { count: trainerCount },
    { count: assignedPokemonCount },
    { data: poolPokemonRows },
    { data: profile },
  ] = await Promise.all([
    supabase.from('campaigns').select('id', { count: 'exact', head: true }).eq('gm_user_id', user.id),
    supabase.from('campaign_members').select('campaign_id', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('trainers').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_npc', false),
    supabase
      .from('trainers_pokemon')
      .select('trainer_id, trainers!inner(user_id)', { count: 'exact', head: true })
      .eq('trainers.user_id', user.id),
    supabase.from('pokemon').select('id, trainers_pokemon(trainer_id)').eq('created_by_user_id', user.id),
    supabase.from('users').select('display_name').eq('id', user.id).single(),
  ])

  const campaignCount = (gmCampaignCount ?? 0) + (memberCampaignCount ?? 0)
  const unassignedPokemonCount = (poolPokemonRows ?? []).filter((p) => !p.trainers_pokemon).length
  const pokemonCount = (assignedPokemonCount ?? 0) + unassignedPokemonCount

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-24">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="text-muted">Signed in as {profile?.display_name ?? user.email}</p>

      {error && <p className="text-danger">{error}</p>}

      <div className="flex w-full max-w-2xl flex-col gap-3">
        <Link href="/campaigns" className="rounded border p-4 hover:bg-surface-subtle">
          <span className="text-lg font-semibold">{campaignCount} Campaigns</span>
          <span className="block text-sm text-muted underline">View all</span>
        </Link>
        <Link href="/trainers" className="rounded border p-4 hover:bg-surface-subtle">
          <span className="text-lg font-semibold">{trainerCount ?? 0} Trainers</span>
          <span className="block text-sm text-muted underline">View all</span>
        </Link>
        <Link href="/pokemon" className="rounded border p-4 hover:bg-surface-subtle">
          <span className="text-lg font-semibold">{pokemonCount} Pokémon</span>
          <span className="block text-sm text-muted underline">View all</span>
        </Link>
      </div>
    </main>
  )
}
