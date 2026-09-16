'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

// [[Feature - GM Custom - Items]]: same "re-derive GM-ness server-side, RLS backs it up too" shape as
// [[Feature - GM Custom - Pokemon]]'s own requireGm.
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

async function replaceRelationRows(supabase: SupabaseClient, table: string, column: string, itemId: number, ids: number[]) {
  await supabase.from(table).delete().eq('item_id', itemId)
  if (ids.length > 0) {
    await supabase.from(table).insert(ids.map((id) => ({ item_id: itemId, [column]: id })))
  }
}

// held_item_boosts is a 1:1 detail row, present only when a boost is actually configured -- unlike
// the plain replace-whole-set relation tables, this is an upsert-or-delete on a single row.
async function replaceBoost(supabase: SupabaseClient, itemId: number, boostedTypeId: number | null, boostAmount: number | null) {
  if (boostedTypeId === null || boostAmount === null) {
    await supabase.from('held_item_boosts').delete().eq('item_id', itemId)
    return
  }
  await supabase.from('held_item_boosts').upsert({ item_id: itemId, boosted_type_id: boostedTypeId, boost_amount: boostAmount })
}

type ItemFields = {
  name: string
  description: string | null
  buyable: boolean
  price: number | null
  stackable: boolean
  holdable: boolean
}

function parseItemFields(formData: FormData): { error: string } | { fields: ItemFields } {
  const name = (formData.get('name') as string)?.trim()
  if (!name) return { error: 'Name is required' }

  return {
    fields: {
      name,
      description: optionalText(formData, 'description'),
      buyable: formData.get('buyable') === 'on',
      price: optionalInt(formData, 'price'),
      stackable: formData.get('stackable') === 'on',
      holdable: formData.get('holdable') === 'on',
    },
  }
}

export async function createCustomItem(campaignId: string, formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (!(await requireGm(supabase, campaignId, user.id))) {
    redirect(`/campaigns/${campaignId}/custom/items?error=${encodeURIComponent('Only the GM can add custom items')}`)
  }

  const parsed = parseItemFields(formData)
  if ('error' in parsed) {
    redirect(`/campaigns/${campaignId}/custom/items/new?error=${encodeURIComponent(parsed.error)}`)
  }

  const { data: inserted, error } = await supabase
    .from('items')
    .insert({ ...parsed.fields, campaign_id: campaignId })
    .select('id')
    .single()

  if (error || !inserted) {
    const message = error?.code === '23505' ? `This campaign already has an item named "${parsed.fields.name}"` : (error?.message ?? 'Could not create item')
    redirect(`/campaigns/${campaignId}/custom/items/new?error=${encodeURIComponent(message)}`)
  }

  await Promise.all([
    replaceRelationRows(supabase, 'items_item_categories', 'item_category_id', inserted.id, toIdArray(formData, 'categoryIds')),
    replaceBoost(supabase, inserted.id, optionalInt(formData, 'boostedTypeId'), optionalInt(formData, 'boostAmount')),
  ])

  redirect(`/campaigns/${campaignId}/custom/items/${inserted.id}`)
}

export async function updateCustomItem(campaignId: string, itemId: number, formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (!(await requireGm(supabase, campaignId, user.id))) {
    redirect(`/campaigns/${campaignId}/custom/items?error=${encodeURIComponent('Only the GM can edit custom items')}`)
  }

  const parsed = parseItemFields(formData)
  if ('error' in parsed) {
    redirect(`/campaigns/${campaignId}/custom/items/${itemId}?error=${encodeURIComponent(parsed.error)}`)
  }

  const { error } = await supabase.from('items').update(parsed.fields).eq('id', itemId).eq('campaign_id', campaignId)

  if (error) {
    const message = error.code === '23505' ? `This campaign already has an item named "${parsed.fields.name}"` : error.message
    redirect(`/campaigns/${campaignId}/custom/items/${itemId}?error=${encodeURIComponent(message)}`)
  }

  await Promise.all([
    replaceRelationRows(supabase, 'items_item_categories', 'item_category_id', itemId, toIdArray(formData, 'categoryIds')),
    replaceBoost(supabase, itemId, optionalInt(formData, 'boostedTypeId'), optionalInt(formData, 'boostAmount')),
  ])

  redirect(`/campaigns/${campaignId}/custom/items/${itemId}?saved=1`)
}

export async function deleteCustomItem(campaignId: string, itemId: number) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (!(await requireGm(supabase, campaignId, user.id))) {
    redirect(`/campaigns/${campaignId}/custom/items?error=${encodeURIComponent('Only the GM can delete custom items')}`)
  }

  // No on-delete-cascade from trainers_items.item_id -- deleting an item some Trainer already has in
  // their Bag fails on the FK constraint rather than silently orphaning that row.
  const { error } = await supabase.from('items').delete().eq('id', itemId).eq('campaign_id', campaignId)
  if (error) {
    const message = error.code === '23503' ? "Can't delete an item that's already in someone's Bag" : error.message
    redirect(`/campaigns/${campaignId}/custom/items/${itemId}?error=${encodeURIComponent(message)}`)
  }

  redirect(`/campaigns/${campaignId}/custom/items`)
}
