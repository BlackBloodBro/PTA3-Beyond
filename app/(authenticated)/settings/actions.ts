'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { isLabelColor } from '@/lib/pta3/labelColors'

export async function updateThemePreferences(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const mode = formData.get('mode') === 'dark' ? 'dark' : 'light'

  // Empty string (the "Default" swatch) is the only way back to null/no-override once a named
  // accent has been picked -- isLabelColor rejects it, so it correctly falls through to null.
  const accentRaw = formData.get('accent')
  const accent = typeof accentRaw === 'string' && isLabelColor(accentRaw) ? accentRaw : null

  const { error } = await supabase.from('users').update({ theme_mode: mode, theme_accent: accent }).eq('id', user.id)

  if (error) {
    redirect(`/settings?error=${encodeURIComponent(error.message)}`)
  }

  // The (authenticated) layout reads theme prefs on every request -- revalidate the whole tree,
  // not just /settings, so every other page picks up the new theme on next navigation too.
  revalidatePath('/', 'layout')
  redirect('/settings')
}
