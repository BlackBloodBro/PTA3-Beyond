import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// [[Feature - GM Custom - Pokemon]]: a hub for every "GM Custom X" category (Pokemon today; Items/
// Moves/Passives/Afflictions/etc. as their own FRs land later, per the user) rather than routing
// straight to Pokemon's own list -- keeps a stable top-level "Custom" landing spot on the Campaign
// page regardless of how many customization categories eventually exist.
export default async function CampaignCustomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: campaign } = await supabase.from('campaigns').select('id, name, gm_user_id').eq('id', id).single()

  if (!campaign || campaign.gm_user_id !== user.id) {
    redirect(`/campaigns/${id}`)
  }

  const [
    { count: customSpeciesCount },
    { count: customItemCount },
    { count: customAfflictionCount },
    { count: customMoveCount },
    { count: customPassiveCount },
    { count: customItemCategoryCount },
    { count: customProficiencyCount },
  ] = await Promise.all([
    supabase.from('pokedex').select('id', { count: 'exact', head: true }).eq('campaign_id', id),
    supabase.from('items').select('id', { count: 'exact', head: true }).eq('campaign_id', id),
    supabase.from('afflictions').select('id', { count: 'exact', head: true }).eq('campaign_id', id),
    supabase.from('moves').select('id', { count: 'exact', head: true }).eq('campaign_id', id),
    supabase.from('passives').select('id', { count: 'exact', head: true }).eq('campaign_id', id),
    supabase.from('item_categories').select('id', { count: 'exact', head: true }).eq('campaign_id', id),
    supabase.from('proficiencies').select('id', { count: 'exact', head: true }).eq('campaign_id', id),
  ])

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-24">
      <div className="w-full max-w-2xl">
        <Link href={`/campaigns/${id}`} className="text-sm underline">
          ← {campaign.name}
        </Link>
      </div>

      <h1 className="w-full max-w-2xl text-2xl font-bold">Custom</h1>
      <p className="w-full max-w-2xl text-sm text-muted">Homebrew content scoped to this Campaign only, alongside the global catalogs.</p>

      <Link href={`/campaigns/${id}/custom/pokedex`} className="block w-full max-w-2xl rounded border-accent bg-accent/10 p-3 hover:bg-accent/20">
        <span className="text-lg font-semibold">{customSpeciesCount ?? 0} Pokémon</span>
        <span className="block text-sm text-muted underline">View all</span>
      </Link>

      <Link href={`/campaigns/${id}/custom/items`} className="block w-full max-w-2xl rounded border-accent bg-accent/10 p-3 hover:bg-accent/20">
        <span className="text-lg font-semibold">{customItemCount ?? 0} Items</span>
        <span className="block text-sm text-muted underline">View all</span>
      </Link>

      <Link href={`/campaigns/${id}/custom/afflictions`} className="block w-full max-w-2xl rounded border-accent bg-accent/10 p-3 hover:bg-accent/20">
        <span className="text-lg font-semibold">{customAfflictionCount ?? 0} Afflictions</span>
        <span className="block text-sm text-muted underline">View all</span>
      </Link>

      <Link href={`/campaigns/${id}/custom/moves`} className="block w-full max-w-2xl rounded border-accent bg-accent/10 p-3 hover:bg-accent/20">
        <span className="text-lg font-semibold">{customMoveCount ?? 0} Moves</span>
        <span className="block text-sm text-muted underline">View all</span>
      </Link>

      <Link href={`/campaigns/${id}/custom/passives`} className="block w-full max-w-2xl rounded border-accent bg-accent/10 p-3 hover:bg-accent/20">
        <span className="text-lg font-semibold">{customPassiveCount ?? 0} Passives</span>
        <span className="block text-sm text-muted underline">View all</span>
      </Link>

      <Link href={`/campaigns/${id}/custom/item-categories`} className="block w-full max-w-2xl rounded border-accent bg-accent/10 p-3 hover:bg-accent/20">
        <span className="text-lg font-semibold">{customItemCategoryCount ?? 0} Item Categories</span>
        <span className="block text-sm text-muted underline">View all</span>
      </Link>

      <Link href={`/campaigns/${id}/custom/proficiencies`} className="block w-full max-w-2xl rounded border-accent bg-accent/10 p-3 hover:bg-accent/20">
        <span className="text-lg font-semibold">{customProficiencyCount ?? 0} Proficiencies</span>
        <span className="block text-sm text-muted underline">View all</span>
      </Link>
    </main>
  )
}
