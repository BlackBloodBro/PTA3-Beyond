'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

// [[Feature - GM Custom - Item Category]]: same "re-derive GM-ness server-side, RLS backs it up too"
// shape as every other "GM Custom X" sibling's own requireGm.
async function requireGm(supabase: SupabaseClient, campaignId: string, userId: string): Promise<boolean> {
  const { data: campaign } = await supabase.from('campaigns').select('gm_user_id').eq('id', campaignId).maybeSingle()
  return campaign?.gm_user_id === userId
}

function optionalText(formData: FormData, key: string): string | null {
  const raw = (formData.get(key) as string)?.trim()
  return raw || null
}

type ItemCategoryFields = {
  name: string
  description: string | null
}

function parseItemCategoryFields(formData: FormData): { error: string } | { fields: ItemCategoryFields } {
  const name = (formData.get('name') as string)?.trim()
  if (!name) return { error: 'Name is required' }

  return {
    fields: {
      name,
      description: optionalText(formData, 'description'),
    },
  }
}

export async function createCustomItemCategory(campaignId: string, formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (!(await requireGm(supabase, campaignId, user.id))) {
    redirect(`/campaigns/${campaignId}/custom/item-categories?error=${encodeURIComponent('Only the GM can add custom item categories')}`)
  }

  const parsed = parseItemCategoryFields(formData)
  if ('error' in parsed) {
    redirect(`/campaigns/${campaignId}/custom/item-categories/new?error=${encodeURIComponent(parsed.error)}`)
  }

  const { data: inserted, error } = await supabase
    .from('item_categories')
    .insert({ ...parsed.fields, campaign_id: campaignId })
    .select('id')
    .single()

  if (error || !inserted) {
    const message = error?.code === '23505' ? `This campaign already has an item category named "${parsed.fields.name}"` : (error?.message ?? 'Could not create item category')
    redirect(`/campaigns/${campaignId}/custom/item-categories/new?error=${encodeURIComponent(message)}`)
  }

  redirect(`/campaigns/${campaignId}/custom/item-categories/${inserted.id}`)
}

export async function updateCustomItemCategory(campaignId: string, itemCategoryId: number, formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (!(await requireGm(supabase, campaignId, user.id))) {
    redirect(`/campaigns/${campaignId}/custom/item-categories?error=${encodeURIComponent('Only the GM can edit custom item categories')}`)
  }

  const parsed = parseItemCategoryFields(formData)
  if ('error' in parsed) {
    redirect(`/campaigns/${campaignId}/custom/item-categories/${itemCategoryId}?error=${encodeURIComponent(parsed.error)}`)
  }

  const { error } = await supabase.from('item_categories').update(parsed.fields).eq('id', itemCategoryId).eq('campaign_id', campaignId)

  if (error) {
    const message = error.code === '23505' ? `This campaign already has an item category named "${parsed.fields.name}"` : error.message
    redirect(`/campaigns/${campaignId}/custom/item-categories/${itemCategoryId}?error=${encodeURIComponent(message)}`)
  }

  redirect(`/campaigns/${campaignId}/custom/item-categories/${itemCategoryId}?saved=1`)
}

export async function deleteCustomItemCategory(campaignId: string, itemCategoryId: number) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (!(await requireGm(supabase, campaignId, user.id))) {
    redirect(`/campaigns/${campaignId}/custom/item-categories?error=${encodeURIComponent('Only the GM can delete custom item categories')}`)
  }

  // items_item_categories.item_category_id is on delete cascade -- deleting a category just drops
  // that tag off whichever of this Campaign's own custom items had it, the same "definitional data,
  // fine to cascade" treatment as every sibling relation table in this family (pokedex_moves,
  // moves_proficiencies, ...). No delete-in-use guard needed here.
  const { error } = await supabase.from('item_categories').delete().eq('id', itemCategoryId).eq('campaign_id', campaignId)
  if (error) {
    redirect(`/campaigns/${campaignId}/custom/item-categories/${itemCategoryId}?error=${encodeURIComponent(error.message)}`)
  }

  redirect(`/campaigns/${campaignId}/custom/item-categories`)
}
