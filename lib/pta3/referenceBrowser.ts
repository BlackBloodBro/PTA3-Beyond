import type { SupabaseClient } from '@supabase/supabase-js'

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

// Loaded once per page visit, filtered client-side -- same "load everything upfront" pattern as
// loadItemCatalog. Deliberately excludes pokedex_moves/pokedex_passives (each species' full learnset)
// from this bulk query -- embedding that across ~986 species would multiply the payload far beyond
// loadItemCatalog's single-join precedent. Learnset eligibility stays visible on the owned-Pokémon
// detail page, where it's actually actionable.
export async function loadPokedexBrowse(supabase: SupabaseClient): Promise<PokedexBrowseRow[]> {
  const { data } = await supabase
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

  return (data ?? []).map((p) => ({
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
    habitatNames: (p.pokedex_habitats ?? []).map((h) => h.habitats!.name),
    dietNames: (p.pokedex_diets ?? []).map((d) => d.diets!.name),
    eggGroupNames: (p.pokedex_egg_groups ?? []).map((e) => e.egg_groups!.name),
    proficiencyNames: (p.pokedex_proficiencies ?? []).map((pr) => pr.proficiencies!.name),
  }))
}

export async function loadMovesBrowse(supabase: SupabaseClient): Promise<MoveBrowseRow[]> {
  const { data } = await supabase
    .from('moves')
    .select('id, name, damage_stat, frequency, damage_dice, range, description, types(name)')
    .order('name')

  return (data ?? []).map((m) => ({
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

export async function loadSkillsBrowse(supabase: SupabaseClient): Promise<SkillBrowseRow[]> {
  const { data } = await supabase.from('skills').select('id, name, stats(name)').order('name')

  return (data ?? []).map((s) => ({
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
