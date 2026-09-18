import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SellPricePercentSection } from '../SellPricePercentSection'
import { LoyaltySettingsSection } from '../LoyaltySettingsSection'
import { ExpGrantSettingsSection } from '../ExpGrantSettingsSection'
import { LevelBandSettingsSection } from '../LevelBandSettingsSection'

// [[Improvement - Move all Customization settings into one menu]]: the single GM-only "Customization"
// menu -- every tunable Campaign setting (Sell price, Loyalty settings) plus every "GM Custom X"
// catalog and the Pokedex exclusion list, reached via the Campaign page's own "Customization" button
// (next to Edit) rather than a mid-page tile. Route/URL kept as /custom (an internal path segment, not
// user-facing) -- only the visible label changed, so no link elsewhere needed updating, just this page
// and every sub-page's own "← Custom" back-link text.
export default async function CampaignCustomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: campaign } = await supabase.from('campaigns').select('id, name, gm_user_id, sell_price_percent').eq('id', id).single()

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
    { count: customSkillCount },
    { count: customTypeCount },
    { count: excludedSpeciesCount },
    { data: globalTiers },
    { data: tierOverrides },
    { data: globalEvents },
    { data: eventOverrides },
    { data: globalExpEvents },
    { data: expEventOverrides },
    { data: globalLevelBands },
    { data: levelBandOverrides },
  ] = await Promise.all([
    supabase.from('pokedex').select('id', { count: 'exact', head: true }).eq('campaign_id', id),
    supabase.from('items').select('id', { count: 'exact', head: true }).eq('campaign_id', id),
    supabase.from('afflictions').select('id', { count: 'exact', head: true }).eq('campaign_id', id),
    supabase.from('moves').select('id', { count: 'exact', head: true }).eq('campaign_id', id),
    supabase.from('passives').select('id', { count: 'exact', head: true }).eq('campaign_id', id),
    supabase.from('item_categories').select('id', { count: 'exact', head: true }).eq('campaign_id', id),
    supabase.from('proficiencies').select('id', { count: 'exact', head: true }).eq('campaign_id', id),
    supabase.from('skills').select('id', { count: 'exact', head: true }).eq('campaign_id', id),
    supabase.from('types').select('id', { count: 'exact', head: true }).eq('campaign_id', id),
    // [[Feature - GM can restrict global catalog entries from a Campaign]]: not a "custom X" addition
    // like the tiles above -- this counts species EXCLUDED from the global catalog for this Campaign.
    supabase.from('campaign_excluded_pokedex').select('pokedex_id', { count: 'exact', head: true }).eq('campaign_id', id),
    // [[Feature - Allow a GM to change Loyalty settings]]: effective (override-merged) tiers/events
    // plus which ones are actually overridden, for LoyaltySettingsSection's per-row "Default"/"Reset"
    // state -- moved here from the Campaign page itself, per this FR.
    supabase.from('loyalties').select('id, name, min_points').order('sort_order'),
    supabase.from('campaign_loyalty_tier_overrides').select('loyalty_id, min_points').eq('campaign_id', id),
    supabase.from('loyalty_point_events').select('id, name, points'),
    supabase.from('campaign_loyalty_event_overrides').select('event_id, points').eq('campaign_id', id),
    // [[Feature - Add triggers for a Pokemon to gain EXP automatically]]: same effective-value /
    // isOverridden shape as the Loyalty event rows above, for ExpGrantSettingsSection.
    supabase.from('exp_grant_events').select('id, name, exp'),
    supabase.from('campaign_exp_grant_overrides').select('event_id, exp').eq('campaign_id', id),
    // [[Feature - Let a GM customize EXP needed per level band]]: same effective-value / isOverridden
    // shape as the rows above, for LevelBandSettingsSection.
    supabase.from('level_bands').select('band, exp_per_level').order('band'),
    supabase.from('campaign_level_band_overrides').select('band, exp_per_level').eq('campaign_id', id),
  ])

  const tierOverrideById = new Map((tierOverrides ?? []).map((o) => [o.loyalty_id, o.min_points]))
  const loyaltyTierRows = (globalTiers ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    defaultMinPoints: t.min_points,
    minPoints: tierOverrideById.get(t.id) ?? t.min_points,
    isOverridden: tierOverrideById.has(t.id),
  }))

  const eventOverrideById = new Map((eventOverrides ?? []).map((o) => [o.event_id, o.points]))
  const loyaltyEventRows = (globalEvents ?? []).map((e) => ({
    id: e.id,
    name: e.name,
    defaultPoints: e.points,
    points: eventOverrideById.get(e.id) ?? e.points,
    isOverridden: eventOverrideById.has(e.id),
  }))

  const expEventOverrideById = new Map((expEventOverrides ?? []).map((o) => [o.event_id, o.exp]))
  const expGrantRows = (globalExpEvents ?? []).map((e) => ({
    id: e.id,
    name: e.name,
    defaultExp: e.exp,
    exp: expEventOverrideById.get(e.id) ?? e.exp,
    isOverridden: expEventOverrideById.has(e.id),
  }))

  const levelBandOverrideByBand = new Map((levelBandOverrides ?? []).map((o) => [o.band, o.exp_per_level]))
  const levelBandRows = (globalLevelBands ?? []).map((b) => ({
    band: b.band,
    defaultExpPerLevel: b.exp_per_level,
    expPerLevel: levelBandOverrideByBand.get(b.band) ?? b.exp_per_level,
    isOverridden: levelBandOverrideByBand.has(b.band),
  }))

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-24">
      <div className="w-full max-w-2xl">
        <Link href={`/campaigns/${id}`} className="text-sm underline">
          ← {campaign.name}
        </Link>
      </div>

      <h1 className="w-full max-w-2xl text-2xl font-bold">Customization</h1>
      <p className="w-full max-w-2xl text-sm text-muted">
        Every GM-tunable setting for this Campaign -- Sell price, Loyalty settings, and homebrew content alongside the global catalogs.
      </p>

      <SellPricePercentSection campaignId={id} initialPercent={campaign.sell_price_percent} />

      <ExpGrantSettingsSection campaignId={id} events={expGrantRows} />

      <LevelBandSettingsSection campaignId={id} bands={levelBandRows} />

      <LoyaltySettingsSection campaignId={id} tiers={loyaltyTierRows} events={loyaltyEventRows} />

      {/* Per the user (2026-09-18): the 9 "GM Custom X" catalogs specifically (Pokemon through Types)
          as a 3x3 grid under their own "Homebrew" heading -- Excluded Pokémon stays out of this grid
          since it's a different concept (removing from the global catalog, not adding to it). */}
      <h2 className="w-full max-w-2xl text-lg font-semibold">Homebrew</h2>
      <div className="grid w-full max-w-2xl grid-cols-3 gap-3">
        <Link href={`/campaigns/${id}/custom/pokedex`} className="rounded border-accent bg-accent/10 p-3 hover:bg-accent/20">
          <span className="font-semibold">{customSpeciesCount ?? 0} Pokémon</span>
          <span className="block text-sm text-muted underline">View all</span>
        </Link>

        <Link href={`/campaigns/${id}/custom/items`} className="rounded border-accent bg-accent/10 p-3 hover:bg-accent/20">
          <span className="font-semibold">{customItemCount ?? 0} Items</span>
          <span className="block text-sm text-muted underline">View all</span>
        </Link>

        <Link href={`/campaigns/${id}/custom/afflictions`} className="rounded border-accent bg-accent/10 p-3 hover:bg-accent/20">
          <span className="font-semibold">{customAfflictionCount ?? 0} Afflictions</span>
          <span className="block text-sm text-muted underline">View all</span>
        </Link>

        <Link href={`/campaigns/${id}/custom/moves`} className="rounded border-accent bg-accent/10 p-3 hover:bg-accent/20">
          <span className="font-semibold">{customMoveCount ?? 0} Moves</span>
          <span className="block text-sm text-muted underline">View all</span>
        </Link>

        <Link href={`/campaigns/${id}/custom/passives`} className="rounded border-accent bg-accent/10 p-3 hover:bg-accent/20">
          <span className="font-semibold">{customPassiveCount ?? 0} Passives</span>
          <span className="block text-sm text-muted underline">View all</span>
        </Link>

        <Link href={`/campaigns/${id}/custom/item-categories`} className="rounded border-accent bg-accent/10 p-3 hover:bg-accent/20">
          <span className="font-semibold">{customItemCategoryCount ?? 0} Item Categories</span>
          <span className="block text-sm text-muted underline">View all</span>
        </Link>

        <Link href={`/campaigns/${id}/custom/proficiencies`} className="rounded border-accent bg-accent/10 p-3 hover:bg-accent/20">
          <span className="font-semibold">{customProficiencyCount ?? 0} Proficiencies</span>
          <span className="block text-sm text-muted underline">View all</span>
        </Link>

        <Link href={`/campaigns/${id}/custom/skills`} className="rounded border-accent bg-accent/10 p-3 hover:bg-accent/20">
          <span className="font-semibold">{customSkillCount ?? 0} Skills</span>
          <span className="block text-sm text-muted underline">View all</span>
        </Link>

        <Link href={`/campaigns/${id}/custom/types`} className="rounded border-accent bg-accent/10 p-3 hover:bg-accent/20">
          <span className="font-semibold">{customTypeCount ?? 0} Types</span>
          <span className="block text-sm text-muted underline">View all</span>
        </Link>
      </div>

      <Link
        href={`/campaigns/${id}/custom/pokedex-exclusions`}
        className="block w-full max-w-2xl rounded border-accent bg-accent/10 p-3 hover:bg-accent/20"
      >
        <span className="text-lg font-semibold">{excludedSpeciesCount ?? 0} Excluded Pokémon</span>
        <span className="block text-sm text-muted underline">Mark global species that don&apos;t exist in this Campaign&apos;s world</span>
      </Link>
    </main>
  )
}
