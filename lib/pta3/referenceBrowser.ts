import type { SupabaseClient } from '@supabase/supabase-js'
import { loadExcludedPokedexIds } from './pokedexExclusions'

export type PokedexBrowseRow = {
  id: number
  name: string
  description: string | null
  base_hp: number
  base_atk: number
  base_def: number
  base_sp_atk: number
  base_sp_def: number
  base_speed: number
  catch_rate: number | null
  egg_hatch_rate: string | null
  sprite_code: string | null
  type1Name: string
  type2Name: string | null
  sizeName: string | null
  weightName: string | null
  growthRateName: string | null
  habitatNames: string[]
  dietNames: string[]
  eggGroupNames: string[]
  proficiencyNames: string[]
}

export type MoveBrowseRow = {
  id: number
  name: string
  typeName: string
  damage_stat: string
  frequency: string | null
  damage_dice: string | null
  range: string | null
  description: string | null
}

export type SkillBrowseRow = {
  id: number
  name: string
  statName: string | null
}

export type FeatureBrowseRow = {
  id: number
  name: string
  description: string
  level_required: number
}

export type SubclassBrowseRow = {
  id: number
  name: string
  description: string | null
  features: FeatureBrowseRow[]
}

export type ClassBrowseRow = {
  id: number
  name: string
  description: string | null
  baseFeatures: FeatureBrowseRow[]
  subclasses: SubclassBrowseRow[]
}

export type OriginBrowseRow = {
  id: number
  name: string
  description: string | null
  lifestyle: string | null
  features: FeatureBrowseRow[]
}

export type StatModifierRow = { statName: string; modifier: number }

export type AfflictionBrowseRow = {
  id: number
  name: string
  description: string | null
  catch_modifier: number | null
  statModifiers: StatModifierRow[]
}

export type PassiveBrowseRow = {
  id: number
  name: string
  description: string | null
  passive_type: string
  category: string | null
  context: string | null
  statModifiers: StatModifierRow[]
}

export type NamedCatalogRow = { id: number; name: string; description: string | null }

// [[Improvement - Move Pokedex browsing into a Campaign's context]]: every Campaign-scopable catalog
// loader below takes an optional campaignId -- omitted (undefined) preserves every existing call
// site's current behavior (no extra filter beyond RLS itself), `null` scopes to "global only" (the
// no-Campaign-selected default), and a real id scopes to "global + this Campaign's own customs". Same
// inline "reassign query if a condition applies" shape as loadItemCatalog (lib/pta3/bag.ts) and
// loadOtherVisibleTypes ([[Feature - GM Custom - Type]]) -- deliberately not a shared generic helper,
// since the Supabase query builder's own generics don't thread cleanly through one.

// Loaded once per page visit, filtered client-side -- same "load everything upfront" pattern as
// loadItemCatalog. Deliberately excludes pokedex_moves/pokedex_passives (each species' full learnset)
// from this bulk query -- embedding that across ~986 species would multiply the payload far beyond
// loadItemCatalog's single-join precedent. Learnset eligibility stays visible on the owned-Pokémon
// detail page, where it's actually actionable.
export async function loadPokedexBrowse(supabase: SupabaseClient, campaignId?: string | null): Promise<PokedexBrowseRow[]> {
  let query = supabase
    .from('pokedex')
    .select(
      `
      id, name, description, base_hp, base_atk, base_def, base_sp_atk, base_sp_def, base_speed,
      catch_rate, egg_hatch_rate, sprite_code,
      type_1:types!type_1_id(name), type_2:types!type_2_id(name),
      size:sizes!size_id(name), weight:weights!weight_id(name),
      growth_rate:growth_rates!growth_rate_id(name),
      pokedex_habitats(habitats(name)),
      pokedex_diets(diets(name)),
      pokedex_egg_groups(egg_groups(name)),
      pokedex_proficiencies(proficiencies(name))
    `,
    )
    .order('name')
  if (campaignId !== undefined) {
    query = campaignId ? query.or(`campaign_id.is.null,campaign_id.eq.${campaignId}`) : query.is('campaign_id', null)
  }
  // [[Feature - GM can restrict global catalog entries from a Campaign]]: applied for GM and player
  // alike -- this is a read-only browse of "what this Campaign's world contains," not an enforcement
  // point, so there's no reason to show the GM their own exclusions still sitting in the list.
  if (campaignId) {
    const excludedIds = await loadExcludedPokedexIds(supabase, campaignId)
    if (excludedIds.length > 0) {
      query = query.not('id', 'in', `(${excludedIds.join(',')})`)
    }
  }
  const { data } = await query

  // Same reverse/forward-embed quirk documented elsewhere in this codebase (lib/pta3/bag.ts) --
  // a single-row FK embed (type_1, type_2, size, weight, growth_rate) comes back as one object at
  // runtime, not the array TS sometimes infers once enough distinct embed shapes exist project-wide.
  type Row = {
    id: number
    name: string
    description: string | null
    base_hp: number
    base_atk: number
    base_def: number
    base_sp_atk: number
    base_sp_def: number
    base_speed: number
    catch_rate: number | null
    egg_hatch_rate: string | null
    sprite_code: string | null
    type_1: { name: string } | null
    type_2: { name: string } | null
    size: { name: string } | null
    weight: { name: string } | null
    growth_rate: { name: string } | null
    pokedex_habitats: { habitats: { name: string } | null }[]
    pokedex_diets: { diets: { name: string } | null }[]
    pokedex_egg_groups: { egg_groups: { name: string } | null }[]
    pokedex_proficiencies: { proficiencies: { name: string } | null }[]
  }
  const rows = (data ?? []) as unknown as Row[]

  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    base_hp: p.base_hp,
    base_atk: p.base_atk,
    base_def: p.base_def,
    base_sp_atk: p.base_sp_atk,
    base_sp_def: p.base_sp_def,
    base_speed: p.base_speed,
    catch_rate: p.catch_rate,
    egg_hatch_rate: p.egg_hatch_rate,
    sprite_code: p.sprite_code,
    type1Name: p.type_1!.name,
    type2Name: p.type_2?.name ?? null,
    sizeName: p.size?.name ?? null,
    weightName: p.weight?.name ?? null,
    growthRateName: p.growth_rate?.name ?? null,
    habitatNames: p.pokedex_habitats.map((h) => h.habitats!.name),
    dietNames: p.pokedex_diets.map((d) => d.diets!.name),
    eggGroupNames: p.pokedex_egg_groups.map((e) => e.egg_groups!.name),
    proficiencyNames: p.pokedex_proficiencies.map((pr) => pr.proficiencies!.name),
  }))
}

export async function loadMovesBrowse(supabase: SupabaseClient, campaignId?: string | null): Promise<MoveBrowseRow[]> {
  let query = supabase.from('moves').select('id, name, damage_stat, frequency, damage_dice, range, description, types(name)').order('name')
  if (campaignId !== undefined) {
    query = campaignId ? query.or(`campaign_id.is.null,campaign_id.eq.${campaignId}`) : query.is('campaign_id', null)
  }
  const { data } = await query

  type Row = { id: number; name: string; damage_stat: string; frequency: string | null; damage_dice: string | null; range: string | null; description: string | null; types: { name: string } | null }
  const rows = (data ?? []) as unknown as Row[]

  return rows.map((m) => ({
    id: m.id,
    name: m.name,
    typeName: m.types!.name,
    damage_stat: m.damage_stat,
    frequency: m.frequency,
    damage_dice: m.damage_dice,
    range: m.range,
    description: m.description,
  }))
}

export async function loadSkillsBrowse(supabase: SupabaseClient, campaignId?: string | null): Promise<SkillBrowseRow[]> {
  let query = supabase.from('skills').select('id, name, stats(name)').order('name')
  if (campaignId !== undefined) {
    query = campaignId ? query.or(`campaign_id.is.null,campaign_id.eq.${campaignId}`) : query.is('campaign_id', null)
  }
  const { data } = await query

  type Row = { id: number; name: string; stats: { name: string } | null }
  const rows = (data ?? []) as unknown as Row[]

  return rows.map((s) => ({
    id: s.id,
    name: s.name,
    statName: s.stats?.name ?? null,
  }))
}

// [[Add Classes and Origins to Pokedex]]: unlike loadClassBuilderData (lib/pta3/trainerFeatures.ts),
// this is pure reference browsing -- every Feature for every Class/Subclass, no per-trainer level
// gating or milestone resolution. Small tables (5 classes, 29 subclasses, 15 origins) grouped in JS
// from 3 flat queries rather than nested embeds, same "load everything, assemble client-side" spirit
// as the other browse loaders.
export async function loadClassesBrowse(supabase: SupabaseClient): Promise<ClassBrowseRow[]> {
  const [{ data: classes }, { data: subclasses }, { data: features }] = await Promise.all([
    supabase.from('classes').select('id, name, description').order('name'),
    supabase.from('subclasses').select('id, class_id, name, description').order('name'),
    supabase.from('features').select('id, name, description, level_required, class_id, subclass_id').order('level_required'),
  ])

  const featuresByClass = new Map<number, FeatureBrowseRow[]>()
  const featuresBySubclass = new Map<number, FeatureBrowseRow[]>()
  for (const f of features ?? []) {
    const row = { id: f.id, name: f.name, description: f.description, level_required: f.level_required }
    if (f.subclass_id) {
      featuresBySubclass.set(f.subclass_id, [...(featuresBySubclass.get(f.subclass_id) ?? []), row])
    } else {
      featuresByClass.set(f.class_id, [...(featuresByClass.get(f.class_id) ?? []), row])
    }
  }

  const subclassesByClass = new Map<number, SubclassBrowseRow[]>()
  for (const s of subclasses ?? []) {
    const row = { id: s.id, name: s.name, description: s.description, features: featuresBySubclass.get(s.id) ?? [] }
    subclassesByClass.set(s.class_id, [...(subclassesByClass.get(s.class_id) ?? []), row])
  }

  return (classes ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    baseFeatures: featuresByClass.get(c.id) ?? [],
    subclasses: subclassesByClass.get(c.id) ?? [],
  }))
}

export async function loadOriginsBrowse(supabase: SupabaseClient): Promise<OriginBrowseRow[]> {
  const [{ data: origins }, { data: features }] = await Promise.all([
    supabase.from('origins').select('id, name, description, lifestyle').order('name'),
    supabase.from('features').select('id, name, description, level_required, origin_id').not('origin_id', 'is', null),
  ])

  const featuresByOrigin = new Map<number, FeatureBrowseRow[]>()
  for (const f of features ?? []) {
    if (!f.origin_id) continue
    const row = { id: f.id, name: f.name, description: f.description, level_required: f.level_required }
    featuresByOrigin.set(f.origin_id, [...(featuresByOrigin.get(f.origin_id) ?? []), row])
  }

  return (origins ?? []).map((o) => ({
    id: o.id,
    name: o.name,
    description: o.description,
    lifestyle: o.lifestyle,
    features: featuresByOrigin.get(o.id) ?? [],
  }))
}

// [[Improvement - Move Pokedex browsing into a Campaign's context]]: five catalogs that are
// Campaign-scopable (the "GM Custom X" family) but had no browsable tab in this reference browser at
// all before this FR -- same "load everything, filter client-side" shape as every loader above.
export async function loadAfflictionsBrowse(supabase: SupabaseClient, campaignId?: string | null): Promise<AfflictionBrowseRow[]> {
  let query = supabase.from('afflictions').select('id, name, description, catch_modifier, afflictions_stats(modifier, stats(name))').order('name')
  if (campaignId !== undefined) {
    query = campaignId ? query.or(`campaign_id.is.null,campaign_id.eq.${campaignId}`) : query.is('campaign_id', null)
  }
  const { data } = await query

  type Row = { id: number; name: string; description: string | null; catch_modifier: number | null; afflictions_stats: { modifier: number; stats: { name: string } | null }[] }
  const rows = (data ?? []) as unknown as Row[]

  return rows.map((a) => ({
    id: a.id,
    name: a.name,
    description: a.description,
    catch_modifier: a.catch_modifier,
    statModifiers: a.afflictions_stats.map((s) => ({ statName: s.stats!.name, modifier: s.modifier })),
  }))
}

export async function loadPassivesBrowse(supabase: SupabaseClient, campaignId?: string | null): Promise<PassiveBrowseRow[]> {
  let query = supabase.from('passives').select('id, name, description, passive_type, category, context, passives_stats(modifier, stats(name))').order('name')
  if (campaignId !== undefined) {
    query = campaignId ? query.or(`campaign_id.is.null,campaign_id.eq.${campaignId}`) : query.is('campaign_id', null)
  }
  const { data } = await query

  type Row = {
    id: number
    name: string
    description: string | null
    passive_type: string
    category: string | null
    context: string | null
    passives_stats: { modifier: number; stats: { name: string } | null }[]
  }
  const rows = (data ?? []) as unknown as Row[]

  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    passive_type: p.passive_type,
    category: p.category,
    context: p.context,
    statModifiers: p.passives_stats.map((s) => ({ statName: s.stats!.name, modifier: s.modifier })),
  }))
}

export async function loadItemCategoriesBrowse(supabase: SupabaseClient, campaignId?: string | null): Promise<NamedCatalogRow[]> {
  let query = supabase.from('item_categories').select('id, name, description').order('name')
  if (campaignId !== undefined) {
    query = campaignId ? query.or(`campaign_id.is.null,campaign_id.eq.${campaignId}`) : query.is('campaign_id', null)
  }
  const { data } = await query
  return data ?? []
}

export async function loadProficienciesBrowse(supabase: SupabaseClient, campaignId?: string | null): Promise<NamedCatalogRow[]> {
  let query = supabase.from('proficiencies').select('id, name, description').order('name')
  if (campaignId !== undefined) {
    query = campaignId ? query.or(`campaign_id.is.null,campaign_id.eq.${campaignId}`) : query.is('campaign_id', null)
  }
  const { data } = await query
  return data ?? []
}

export async function loadTypesBrowse(supabase: SupabaseClient, campaignId?: string | null): Promise<NamedCatalogRow[]> {
  let query = supabase.from('types').select('id, name, description').neq('name', 'Special/Variable').order('name')
  if (campaignId !== undefined) {
    query = campaignId ? query.or(`campaign_id.is.null,campaign_id.eq.${campaignId}`) : query.is('campaign_id', null)
  }
  const { data } = await query
  return data ?? []
}
