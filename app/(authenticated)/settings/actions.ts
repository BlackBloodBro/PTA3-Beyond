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

export async function updateUsername(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const displayName = (formData.get('displayName') as string)?.trim()

  if (!displayName) {
    redirect(`/settings?error=${encodeURIComponent('Username is required')}`)
  }

  const { error } = await supabase.from('users').update({ display_name: displayName }).eq('id', user.id)

  if (error) {
    redirect(`/settings?error=${encodeURIComponent(error.message)}`)
  }

  // display_name is also shown on /dashboard -- revalidate the whole tree, same as theme prefs.
  revalidatePath('/', 'layout')
  redirect('/settings')
}

// Supabase's updateUser({ password }) doesn't require the current password by default -- unlike
// typical "change password" UX elsewhere, so this re-authenticates first as an explicit verification
// gate. There's no dedicated "just verify this password" call, so signInWithPassword itself (same one
// app/auth/actions.ts's login already uses) doubles as the check: if it fails, the current password
// was wrong and updateUser is never called.
export async function updatePassword(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || !user.email) {
    redirect('/login')
  }

  const currentPassword = formData.get('currentPassword') as string
  const newPassword = formData.get('newPassword') as string
  const confirmPassword = formData.get('confirmPassword') as string

  if (!currentPassword || !newPassword || !confirmPassword) {
    redirect(`/settings?error=${encodeURIComponent('All password fields are required')}`)
  }
  if (newPassword !== confirmPassword) {
    redirect(`/settings?error=${encodeURIComponent('New passwords do not match')}`)
  }

  const { error: verifyError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword })
  if (verifyError) {
    redirect(`/settings?error=${encodeURIComponent('Current password is incorrect')}`)
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) {
    redirect(`/settings?error=${encodeURIComponent(error.message)}`)
  }

  redirect(`/settings?message=${encodeURIComponent('Password updated')}`)
}
