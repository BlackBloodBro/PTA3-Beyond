import { createClient } from '@/lib/supabase/server'
import { trainerHref } from './trainerPaths'
import { pokemonHref } from './pokemonPaths'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

// Shared by every entity detail page (Trainer/NPC/Pokemon/Campaign, generic and campaign-scoped
// alike) to fetch the BookmarkToggle's initial state -- one identical query, not duplicated seven
// times across the route family.
export async function isBookmarked(
  supabase: SupabaseClient,
  userId: string,
  entityType: 'trainer' | 'pokemon' | 'campaign',
  entityId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('bookmarks')
    .select('id')
    .eq('user_id', userId)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .maybeSingle()
  return !!data
}

// entityId (the raw Trainer/Pokemon/Campaign id, not the bookmark row's own id) is only actually
// used by the Sidebar for campaign bookmarks so far (to build the NPCs/Wild Pokémon shortcut hrefs,
// [[Add Campaign Trainers and Pokemon to the sidebar]]), but populated uniformly for all three types
// rather than as a campaign-only optional field, since deriving it here once is simpler than parsing
// it back out of `href` later.
export type SidebarBookmark = { id: string; entityId: string; label: string; href: string; entityType: 'trainer' | 'pokemon' | 'campaign' }

// Campaigns, then Trainers, then Pokémon -- matches the Sidebar's own static link order above the
// Bookmarks section, so the grouping reads as a natural extension of it rather than an arbitrary one.
const ENTITY_TYPE_ORDER: Record<SidebarBookmark['entityType'], number> = { campaign: 0, trainer: 1, pokemon: 2 }

// Resolves a user's raw bookmark rows (entity_type + entity_id, no FK) into ready-to-render Sidebar
// entries -- one query per entity type present (skipped entirely if that type has zero bookmarks),
// rather than three unconditional queries. A bookmark whose target has since been deleted is silently
// dropped rather than shown as a broken link; the user can just re-bookmark once they notice.
export async function loadBookmarksForSidebar(supabase: SupabaseClient, userId: string): Promise<SidebarBookmark[]> {
  const { data: rows } = await supabase
    .from('bookmarks')
    .select('id, entity_type, entity_id, created_at')
    .eq('user_id', userId)
    .order('created_at')

  if (!rows || rows.length === 0) return []

  const trainerIds = rows.filter((r) => r.entity_type === 'trainer').map((r) => r.entity_id)
  const pokemonIds = rows.filter((r) => r.entity_type === 'pokemon').map((r) => r.entity_id)
  const campaignIds = rows.filter((r) => r.entity_type === 'campaign').map((r) => r.entity_id)

  const [{ data: trainers }, { data: pokemonRows }, { data: campaigns }] = await Promise.all([
    trainerIds.length > 0
      ? supabase.from('trainers').select('id, name, is_npc, campaign_id').in('id', trainerIds)
      : Promise.resolve({ data: [] as { id: string; name: string; is_npc: boolean; campaign_id: string | null }[] }),
    pokemonIds.length > 0
      ? supabase
          .from('pokemon')
          .select(
            `
            id, nickname, campaign_id,
            pokedex(name),
            trainers_pokemon(trainers(name, campaign_id))
          `,
          )
          .in('id', pokemonIds)
      : Promise.resolve({ data: [] as unknown[] }),
    campaignIds.length > 0
      ? supabase.from('campaigns').select('id, name').in('id', campaignIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ])

  const trainerById = new Map((trainers ?? []).map((t) => [t.id, t]))
  const campaignById = new Map((campaigns ?? []).map((c) => [c.id, c]))
  // trainers_pokemon.pokemon_id is a primary key, so this reverse embed (and the forward
  // trainers -> nested inside it) both come back as single objects at runtime -- same quirk
  // documented throughout the Pokemon page.
  const pokemonById = new Map(
    (pokemonRows ?? []).map((p) => [
      (p as { id: string }).id,
      p as unknown as {
        id: string
        nickname: string | null
        campaign_id: string | null
        pokedex: { name: string } | null
        trainers_pokemon: { trainers: { name: string; campaign_id: string | null } | null } | null
      },
    ]),
  )

  const result: SidebarBookmark[] = []
  for (const row of rows) {
    if (row.entity_type === 'trainer') {
      const t = trainerById.get(row.entity_id)
      if (!t) continue
      result.push({
        id: row.id,
        entityId: t.id,
        label: t.name,
        href: trainerHref({ id: t.id, is_npc: t.is_npc, campaign_id: t.campaign_id }),
        entityType: 'trainer',
      })
    } else if (row.entity_type === 'pokemon') {
      const p = pokemonById.get(row.entity_id)
      if (!p) continue
      const owningTrainer = p.trainers_pokemon?.trainers ?? null
      const speciesName = p.pokedex?.name ?? 'Pokémon'
      const trainerLabel = owningTrainer?.name ?? '(unassigned)'
      const label = `${p.nickname ? `${p.nickname} (${speciesName})` : speciesName} · ${trainerLabel}`
      const effectiveCampaignId = owningTrainer ? owningTrainer.campaign_id : p.campaign_id
      result.push({
        id: row.id,
        entityId: p.id,
        label,
        href: pokemonHref({ id: p.id, hasOwner: !!owningTrainer, campaignId: effectiveCampaignId }),
        entityType: 'pokemon',
      })
    } else {
      const c = campaignById.get(row.entity_id)
      if (!c) continue
      result.push({ id: row.id, entityId: c.id, label: c.name, href: `/campaigns/${c.id}`, entityType: 'campaign' })
    }
  }
  // Grouped by entity type (Campaigns/Trainers/Pokémon); stable sort keeps each group's original
  // created_at order (from the `rows` query above) intact.
  result.sort((a, b) => ENTITY_TYPE_ORDER[a.entityType] - ENTITY_TYPE_ORDER[b.entityType])
  return result
}
