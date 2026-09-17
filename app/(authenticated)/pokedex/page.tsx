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
// Passives/Item Categories/Proficiencies/Types) is scoped to global-only by default, or global + one
// selected Campaign's own customs via the picker below. Classes/Origins stay untouched -- purely
// global reference data, no FR scopes those to a Campaign.
export default async function PokedexPage({ searchParams }: { searchParams: Promise<{ campaign?: string }> }) {
  const { campaign: requestedCampaignId } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const [{ data: gmCampaigns }, { data: memberships }] = await Promise.all([
    supabase.from('campaigns').select('id, name').eq('gm_user_id', user.id).order('name'),
    supabase.from('campaign_members').select('campaigns(id, name)').eq('user_id', user.id).order('joined_at', { ascending: false }),
  ])

  // Same reverse/forward-embed quirk documented elsewhere in this codebase (lib/pta3/bag.ts) -- a
  // single-row FK embed comes back as one object at runtime, not the array TS sometimes infers.
  const membershipRows = (memberships ?? []) as unknown as { campaigns: { id: string; name: string } | null }[]
  const memberCampaigns = membershipRows.map((m) => m.campaigns).filter((c): c is { id: string; name: string } => c !== null)

  const myCampaigns = [...(gmCampaigns ?? []), ...memberCampaigns]
    .filter((c, i, arr) => arr.findIndex((o) => o.id === c.id) === i)
    .sort((a, b) => a.name.localeCompare(b.name))

  // A requested Campaign the viewer doesn't actually belong to (bad link, stale bookmark, left the
  // Campaign since) silently falls back to the global-only default, same "don't guess, just fall back
  // cleanly" spirit as a bad templateId elsewhere in this app.
  const selectedCampaignId = requestedCampaignId && myCampaigns.some((c) => c.id === requestedCampaignId) ? requestedCampaignId : null

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

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-24">
      <div className="w-full max-w-4xl">
        <Link href="/dashboard" className="text-sm underline">
          ← Dashboard
        </Link>
      </div>

      <div className="flex w-full max-w-4xl flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Pokédex</h1>
        <form method="get" className="flex items-end gap-2 text-sm">
          <div className="flex flex-col gap-1">
            <label htmlFor="campaign">Campaign context</label>
            <select id="campaign" name="campaign" defaultValue={selectedCampaignId ?? ''} className="bg-surface-subtle rounded border px-2 py-1">
              <option value="">Global only</option>
              {myCampaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="rounded border px-3 py-2">
            Switch
          </button>
        </form>
      </div>
      <p className="w-full max-w-4xl text-sm text-muted">
        {selectedCampaignId
          ? `Showing the global catalog plus ${myCampaigns.find((c) => c.id === selectedCampaignId)?.name}'s own homebrew.`
          : 'Showing the global catalog only. Pick a Campaign above to also see its homebrew.'}
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
