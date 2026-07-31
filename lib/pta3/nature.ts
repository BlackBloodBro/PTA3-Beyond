import type { createClient } from '@/lib/supabase/server'

// Shared by both Pokemon-creation flows (starter and GM-created): picks uniformly among all
// seeded natures rather than hardcoding a count, so it stays correct if more get added later.
export async function pickRandomNatureId(supabase: Awaited<ReturnType<typeof createClient>>): Promise<number | null> {
  const { data: natures } = await supabase.from('natures').select('id')
  if (!natures || natures.length === 0) return null
  return natures[Math.floor(Math.random() * natures.length)].id
}
