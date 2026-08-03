'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type BookmarkEntityType = 'trainer' | 'pokemon' | 'campaign'

// Called directly from a client component (no <form action>, no redirect) so the star toggle on a
// Trainer/Pokemon/Campaign page updates in place -- same "plain function, not a form action" pattern
// as every other toggle in this app (afflictions, moves, labels).
export async function toggleBookmark(
  entityType: BookmarkEntityType,
  entityId: string,
): Promise<{ error: string } | { bookmarked: boolean }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: existing } = await supabase
    .from('bookmarks')
    .select('id')
    .eq('user_id', user.id)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase.from('bookmarks').delete().eq('id', existing.id)
    if (error) {
      return { error: error.message }
    }
    return { bookmarked: false }
  }

  const { error } = await supabase.from('bookmarks').insert({ user_id: user.id, entity_type: entityType, entity_id: entityId })
  if (error) {
    return { error: error.message }
  }
  return { bookmarked: true }
}
