'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

// [[Feature - GM Custom - Pokemon]]: every action here re-derives GM-ness server-side rather than
// trusting the page not rendering the form to a non-GM -- RLS backs this up too (the migration's
// "GM manages their campaign's custom species" policy), but checking here first lets a bad request
// redirect with a clean error instead of surfacing a raw RLS-denial Postgres error.
async function requireGm(supabase: SupabaseClient, campaignId: string, userId: string): Promise<boolean> {
  const { data: campaign } = await supabase.from('campaigns').select('gm_user_id').eq('id', campaignId).maybeSingle()
  return campaign?.gm_user_id === userId
}

function toIdArray(formData: FormData, key: string): number[] {
  return formData
    .getAll(key)
    .map((v) => Number(v))
    .filter((n) => !Number.isNaN(n))
}

// [[Feature - GM Custom - Pokemon]]: Moves/Passives picked during creation ([[Feature - GM Custom -
// Pokemon]]'s creation-time-editing addendum, 2026-09-17) arrive as one JSON-encoded array field --
// unlike habitatIds/etc.'s repeated-checkbox-value shape, each entry here also carries its own
// optional level_learned, which a plain repeated `<input>` can't express as cleanly. Malformed/absent
// input is treated as "nothing staged" rather than an error -- this only ever comes from this
// codebase's own client component, never a bare user-typed form.
function parseStagedLearnset(formData: FormData, key: string): { id: number; levelLearned: number | null }[] {
  const raw = formData.get(key) as string | null
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((entry) => ({ id: Number(entry?.id), levelLearned: entry?.levelLearned === null || entry?.levelLearned === undefined ? null : Number(entry.levelLearned) }))
      .filter((entry) => Number.isInteger(entry.id))
  } catch {
    return []
  }
}

function optionalInt(formData: FormData, key: string): number | null {
  const raw = (formData.get(key) as string)?.trim()
  if (!raw) return null
  const n = Number(raw)
  return Number.isNaN(n) ? null : n
}

function optionalText(formData: FormData, key: string): string | null {
  const raw = (formData.get(key) as string)?.trim()
  return raw || null
}

// Replaces every one of a species' rows in one relation table with a fresh set -- simpler than
// diffing add/remove given these are all small (<=58-row) checkbox multi-selects submitted whole on
// every save, unlike Moves/Passives' own incremental one-at-a-time flow below.
async function replaceRelationRows(supabase: SupabaseClient, table: string, column: string, pokedexId: number, ids: number[]) {
  await supabase.from(table).delete().eq('pokedex_id', pokedexId)
  if (ids.length > 0) {
    await supabase.from(table).insert(ids.map((id) => ({ pokedex_id: pokedexId, [column]: id })))
  }
}

type StatBlockFields = {
  name: string
  type_1_id: number
  type_2_id: number | null
  size_id: number | null
  weight_id: number | null
  growth_rate_id: number | null
  base_hp: number
  base_atk: number
  base_def: number
  base_sp_atk: number
  base_sp_def: number
  base_speed: number
  catch_rate: number | null
  egg_hatch_rate: string | null
  description: string | null
  sprite_code: string | null
}

function parseStatBlock(formData: FormData): { error: string } | { fields: StatBlockFields } {
  const name = (formData.get('name') as string)?.trim()
  const type1Id = optionalInt(formData, 'type1Id')
  const baseHp = optionalInt(formData, 'baseHp')
  const baseAtk = optionalInt(formData, 'baseAtk')
  const baseDef = optionalInt(formData, 'baseDef')
  const baseSpAtk = optionalInt(formData, 'baseSpAtk')
  const baseSpDef = optionalInt(formData, 'baseSpDef')
  const baseSpeed = optionalInt(formData, 'baseSpeed')

  if (!name) return { error: 'Name is required' }
  if (type1Id === null) return { error: 'Type 1 is required' }
  if (baseHp === null || baseAtk === null || baseDef === null || baseSpAtk === null || baseSpDef === null || baseSpeed === null) {
    return { error: 'All six base stats are required' }
  }

  return {
    fields: {
      name,
      type_1_id: type1Id,
      type_2_id: optionalInt(formData, 'type2Id'),
      size_id: optionalInt(formData, 'sizeId'),
      weight_id: optionalInt(formData, 'weightId'),
      growth_rate_id: optionalInt(formData, 'growthRateId'),
      base_hp: baseHp,
      base_atk: baseAtk,
      base_def: baseDef,
      base_sp_atk: baseSpAtk,
      base_sp_def: baseSpDef,
      base_speed: baseSpeed,
      catch_rate: optionalInt(formData, 'catchRate'),
      egg_hatch_rate: optionalText(formData, 'eggHatchRate'),
      description: optionalText(formData, 'description'),
      sprite_code: optionalText(formData, 'spriteCode'),
    },
  }
}

export async function createCustomSpecies(campaignId: string, formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (!(await requireGm(supabase, campaignId, user.id))) {
    redirect(`/campaigns/${campaignId}/custom/pokedex?error=${encodeURIComponent('Only the GM can add custom species')}`)
  }

  const parsed = parseStatBlock(formData)
  if ('error' in parsed) {
    redirect(`/campaigns/${campaignId}/custom/pokedex/new?error=${encodeURIComponent(parsed.error)}`)
  }

  const { data: inserted, error } = await supabase
    .from('pokedex')
    .insert({ ...parsed.fields, campaign_id: campaignId })
    .select('id')
    .single()

  if (error || !inserted) {
    // A duplicate name within this Campaign hits the partial unique index added alongside
    // campaign_id -- surface that plainly rather than a raw constraint-violation message.
    const message = error?.code === '23505' ? `This campaign already has a species named "${parsed.fields.name}"` : (error?.message ?? 'Could not create species')
    redirect(`/campaigns/${campaignId}/custom/pokedex/new?error=${encodeURIComponent(message)}`)
  }

  const stagedMoves = parseStagedLearnset(formData, 'movesJson')
  const stagedPassives = parseStagedLearnset(formData, 'passivesJson')

  await Promise.all([
    replaceRelationRows(supabase, 'pokedex_habitats', 'habitat_id', inserted.id, toIdArray(formData, 'habitatIds')),
    replaceRelationRows(supabase, 'pokedex_proficiencies', 'proficiency_id', inserted.id, toIdArray(formData, 'proficiencyIds')),
    replaceRelationRows(supabase, 'pokedex_diets', 'diet_id', inserted.id, toIdArray(formData, 'dietIds')),
    replaceRelationRows(supabase, 'pokedex_egg_groups', 'egg_group_id', inserted.id, toIdArray(formData, 'eggGroupIds')),
    stagedMoves.length > 0
      ? supabase.from('pokedex_moves').insert(stagedMoves.map((m) => ({ pokedex_id: inserted.id, move_id: m.id, level_learned: m.levelLearned })))
      : Promise.resolve(),
    stagedPassives.length > 0
      ? supabase.from('pokedex_passives').insert(stagedPassives.map((p) => ({ pokedex_id: inserted.id, passive_id: p.id, level_learned: p.levelLearned })))
      : Promise.resolve(),
  ])

  redirect(`/campaigns/${campaignId}/custom/pokedex/${inserted.id}`)
}

export async function updateCustomSpecies(campaignId: string, pokedexId: number, formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (!(await requireGm(supabase, campaignId, user.id))) {
    redirect(`/campaigns/${campaignId}/custom/pokedex?error=${encodeURIComponent('Only the GM can edit custom species')}`)
  }

  const parsed = parseStatBlock(formData)
  if ('error' in parsed) {
    redirect(`/campaigns/${campaignId}/custom/pokedex/${pokedexId}?error=${encodeURIComponent(parsed.error)}`)
  }

  // Scoped to this Campaign's own id too, not just the row id -- belt-and-suspenders alongside RLS,
  // same reasoning as requireGm above.
  const { error } = await supabase.from('pokedex').update(parsed.fields).eq('id', pokedexId).eq('campaign_id', campaignId)

  if (error) {
    const message = error.code === '23505' ? `This campaign already has a species named "${parsed.fields.name}"` : error.message
    redirect(`/campaigns/${campaignId}/custom/pokedex/${pokedexId}?error=${encodeURIComponent(message)}`)
  }

  await Promise.all([
    replaceRelationRows(supabase, 'pokedex_habitats', 'habitat_id', pokedexId, toIdArray(formData, 'habitatIds')),
    replaceRelationRows(supabase, 'pokedex_proficiencies', 'proficiency_id', pokedexId, toIdArray(formData, 'proficiencyIds')),
    replaceRelationRows(supabase, 'pokedex_diets', 'diet_id', pokedexId, toIdArray(formData, 'dietIds')),
    replaceRelationRows(supabase, 'pokedex_egg_groups', 'egg_group_id', pokedexId, toIdArray(formData, 'eggGroupIds')),
  ])

  redirect(`/campaigns/${campaignId}/custom/pokedex/${pokedexId}?saved=1`)
}

export async function deleteCustomSpecies(campaignId: string, pokedexId: number) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (!(await requireGm(supabase, campaignId, user.id))) {
    redirect(`/campaigns/${campaignId}/custom/pokedex?error=${encodeURIComponent('Only the GM can delete custom species')}`)
  }

  // No on-delete-cascade from pokemon.pokedex_id -- deleting a species still in use by a real
  // Pokemon fails on the FK constraint rather than silently orphaning that Pokemon's species.
  const { error } = await supabase.from('pokedex').delete().eq('id', pokedexId).eq('campaign_id', campaignId)
  if (error) {
    const message = error.code === '23503' ? "Can't delete a species that's already in use by a Pokémon" : error.message
    redirect(`/campaigns/${campaignId}/custom/pokedex/${pokedexId}?error=${encodeURIComponent(message)}`)
  }

  redirect(`/campaigns/${campaignId}/custom/pokedex`)
}

// Moves/Passives are added one at a time from the edit page's own search-and-click UI ([[Feature -
// GM Custom - Pokemon]]: 632/327 rows is too large for a checkbox wall, matching how a GM would
// naturally build up a homebrew learnset at the table anyway) -- called directly from that client
// component, same "plain function, not a <form action>" shape as TrainerActionsPanel's own
// setFeatureUsesRemaining/useItem calls.
export async function addSpeciesMove(campaignId: string, pokedexId: number, moveId: number, levelLearned: number | null): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  if (!(await requireGm(supabase, campaignId, user.id))) return { error: 'Only the GM can edit this species' }

  const { error } = await supabase.from('pokedex_moves').insert({ pokedex_id: pokedexId, move_id: moveId, level_learned: levelLearned })
  if (error) return { error: error.code === '23505' ? 'This species already knows that Move' : error.message }
  return { success: true }
}

export async function removeSpeciesMove(campaignId: string, pokedexId: number, moveId: number): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  if (!(await requireGm(supabase, campaignId, user.id))) return { error: 'Only the GM can edit this species' }

  const { error } = await supabase.from('pokedex_moves').delete().eq('pokedex_id', pokedexId).eq('move_id', moveId)
  if (error) return { error: error.message }
  return { success: true }
}

export async function addSpeciesPassive(campaignId: string, pokedexId: number, passiveId: number, levelLearned: number | null): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  if (!(await requireGm(supabase, campaignId, user.id))) return { error: 'Only the GM can edit this species' }

  const { error } = await supabase.from('pokedex_passives').insert({ pokedex_id: pokedexId, passive_id: passiveId, level_learned: levelLearned })
  if (error) return { error: error.code === '23505' ? 'This species already has that Passive' : error.message }
  return { success: true }
}

export async function removeSpeciesPassive(campaignId: string, pokedexId: number, passiveId: number): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  if (!(await requireGm(supabase, campaignId, user.id))) return { error: 'Only the GM can edit this species' }

  const { error } = await supabase.from('pokedex_passives').delete().eq('pokedex_id', pokedexId).eq('passive_id', passiveId)
  if (error) return { error: error.message }
  return { success: true }
}
