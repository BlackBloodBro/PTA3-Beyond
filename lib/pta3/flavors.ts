import type { createClient } from '@/lib/supabase/server'

// Rolled once at Pokemon creation, per [[Track Pokemon Likes and Dislikes]]. Each of the 5 flavours
// independently rolls liked (20%) / disliked (20%) / neutral (60%); if that produces zero liked
// flavours, one random flavour is forced to liked afterward (not a full reroll of all 5) so any
// dislikes that already landed aren't disturbed. Neutral flavours have no row -- only returns the
// liked/disliked ones, ready to insert into pokemon_flavor_preferences.
export async function pickFlavorPreferences(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<{ flavorId: number; liked: boolean }[]> {
  const { data: flavors } = await supabase.from('flavors').select('id')
  if (!flavors || flavors.length === 0) return []

  const rolled = flavors.map((f) => {
    const roll = Math.random()
    return { flavorId: f.id, liked: roll < 0.2, disliked: roll >= 0.2 && roll < 0.4 }
  })

  if (!rolled.some((r) => r.liked)) {
    const forced = rolled[Math.floor(Math.random() * rolled.length)]
    forced.liked = true
    forced.disliked = false
  }

  return rolled.filter((r) => r.liked || r.disliked).map((r) => ({ flavorId: r.flavorId, liked: r.liked }))
}

// Shared by all 3 Pokemon detail page variants -- comma-separated flavour names split by liked/disliked,
// '—' when empty (dislikes legitimately can be, likes never are after the creation-time top-up above).
export function formatFlavorPreferences(prefs: { liked: boolean; flavor: { name: string } | null }[]): {
  likes: string
  dislikes: string
} {
  const likes = prefs.filter((p) => p.liked).map((p) => p.flavor?.name)
  const dislikes = prefs.filter((p) => !p.liked).map((p) => p.flavor?.name)
  return {
    likes: likes.length > 0 ? likes.join(', ') : '—',
    dislikes: dislikes.length > 0 ? dislikes.join(', ') : '—',
  }
}
