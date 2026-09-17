import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  loadPokedexBrowse,
  loadMovesBrowse,
  loadSkillsBrowse,
  loadClassesBrowse,
  loadOriginsBrowse,
  loadAfflictionsBrowse,
  loadPassivesBrowse,
  loadItemCategoriesBrowse,
  loadProficienciesBrowse,
  loadTypesBrowse,
} from '@/lib/pta3/referenceBrowser'
import { loadItemCatalog } from '@/lib/pta3/bag'
import { PokedexBrowser } from './PokedexBrowser'

// [[Improvement - Move Pokedex browsing into a Campaign's context]]: /pokedex is now Campaign-aware --
// every catalog a Campaign can add its own homebrew to (Pokédex/Moves/Items/Skills/Afflictions/
// Passives/Item Categories/Proficiencies/Types) is scoped to global-only, or global + one Campaign's
// own customs. Classes/Origins stay untouched -- purely global reference data, no FR scopes those to a
// Campaign. No picker UI -- the only way to reach this page is now the Campaign page's own Pokédex
// tile (`?campaign=<id>`), so the context is just whatever that link says, not something switched here.
export default async function PokedexPage({ searchParams }: { searchParams: Promise<{ campaign?: string }> }) {
  const { campaign: requestedCampaignId } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // A single fetch-by-id rather than a "which Campaigns am I in" list -- RLS itself already returns
  // null for a Campaign the viewer isn't actually a GM/member of (bad link, stale bookmark, left the
  // Campaign since), so this doubles as the same "don't guess, just fall back cleanly" validation a
  // separate list-based check would have needed anyway.
  const { data: campaign } = requestedCampaignId
    ? await supabase.from('campaigns').select('id, name').eq('id', requestedCampaignId).maybeSingle()
    : { data: null }

  const selectedCampaignId = campaign?.id ?? null

  const [pokedex, moves, items, skills, classes, origins, afflictions, passives, itemCategories, proficiencies, types, { data: habitats }] = await Promise.all([
    loadPokedexBrowse(supabase, selectedCampaignId),
    loadMovesBrowse(supabase, selectedCampaignId),
    loadItemCatalog(supabase, selectedCampaignId),
    loadSkillsBrowse(supabase, selectedCampaignId),
    loadClassesBrowse(supabase),
    loadOriginsBrowse(supabase),
    loadAfflictionsBrowse(supabase, selectedCampaignId),
    loadPassivesBrowse(supabase, selectedCampaignId),
    loadItemCategoriesBrowse(supabase, selectedCampaignId),
    loadProficienciesBrowse(supabase, selectedCampaignId),
    loadTypesBrowse(supabase, selectedCampaignId),
    supabase.from('habitats').select('id, name').order('name'),
  ])

  const backHref = selectedCampaignId ? `/campaigns/${selectedCampaignId}` : '/dashboard'
  const backLabel = campaign ? campaign.name : 'Dashboard'

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-24">
      <div className="w-full max-w-4xl">
        <Link href={backHref} className="text-sm underline">
          ← {backLabel}
        </Link>
      </div>

      <h1 className="w-full max-w-4xl text-2xl font-bold">Pokédex</h1>
      <p className="w-full max-w-4xl text-sm text-muted">
        {campaign ? `Showing the global catalog plus ${campaign.name}'s own homebrew.` : 'Showing the global catalog only.'}
      </p>

      <PokedexBrowser
        pokedex={pokedex}
        moves={moves}
        items={items}
        skills={skills}
        classes={classes}
        origins={origins}
        afflictions={afflictions}
        passives={passives}
        itemCategories={itemCategories}
        proficiencies={proficiencies}
        types={types}
        habitats={habitats ?? []}
      />
    </main>
  )
}
