import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/app/auth/actions'
import { LABEL_COLORS, LABEL_SWATCH_CLASSES } from '@/lib/pta3/labelColors'
import { updateThemePreferences, updateUsername, updatePassword } from './actions'
import packageJson from '@/package.json'

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>
}) {
  const { error, message } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase.from('users').select('display_name, theme_mode, theme_accent').eq('id', user.id).single()

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-24">
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="text-muted">Signed in as {profile?.display_name ?? user.email}</p>

      {error && <p className="text-danger">{error}</p>}
      {message && <p className="text-success">{message}</p>}

      <form action={updateUsername} className="flex w-full max-w-sm flex-col gap-2 rounded border p-4">
        <label htmlFor="displayName" className="text-sm font-semibold">
          Username
        </label>
        <input
          id="displayName"
          name="displayName"
          type="text"
          required
          defaultValue={profile?.display_name ?? ''}
          className="bg-surface-subtle rounded border px-3 py-2"
        />
        <button type="submit" className="w-fit rounded bg-accent px-4 py-2 text-accent-foreground">
          Save username
        </button>
      </form>

      <form action={updatePassword} className="flex w-full max-w-sm flex-col gap-2 rounded border p-4">
        <label htmlFor="currentPassword" className="text-sm font-semibold">
          Change password
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          placeholder="Current password"
          required
          className="bg-surface-subtle rounded border px-3 py-2"
        />
        <input
          name="newPassword"
          type="password"
          placeholder="New password"
          required
          className="bg-surface-subtle rounded border px-3 py-2"
        />
        <input
          name="confirmPassword"
          type="password"
          placeholder="Confirm new password"
          required
          className="bg-surface-subtle rounded border px-3 py-2"
        />
        <button type="submit" className="w-fit rounded bg-accent px-4 py-2 text-accent-foreground">
          Save password
        </button>
      </form>

      <form action={updateThemePreferences} className="flex w-full max-w-sm flex-col gap-4 rounded border p-4">
        <fieldset className="flex gap-4">
          <legend className="mb-1 text-sm font-semibold">Mode</legend>
          <label className="flex items-center gap-1 text-sm">
            <input type="radio" name="mode" value="light" defaultChecked={profile?.theme_mode === 'light'} />
            Light
          </label>
          <label className="flex items-center gap-1 text-sm">
            <input type="radio" name="mode" value="dark" defaultChecked={profile?.theme_mode !== 'light'} />
            Dark
          </label>
        </fieldset>

        <fieldset className="flex flex-wrap items-center gap-2">
          <legend className="mb-1 w-full text-sm font-semibold">Accent color</legend>
          <label className="flex items-center gap-1">
            <input type="radio" name="accent" value="" defaultChecked={!profile?.theme_accent} className="sr-only peer" />
            <span className="h-5 w-5 rounded-full bg-black ring-offset-1 peer-checked:ring-2 peer-checked:ring-black" title="Default" />
          </label>
          {LABEL_COLORS.map((color) => (
            <label key={color} className="flex items-center gap-1">
              <input
                type="radio"
                name="accent"
                value={color}
                defaultChecked={profile?.theme_accent === color}
                className="sr-only peer"
              />
              <span
                className={`h-5 w-5 rounded-full ${LABEL_SWATCH_CLASSES[color]} ring-offset-1 peer-checked:ring-2 peer-checked:ring-black`}
                title={color}
              />
            </label>
          ))}
        </fieldset>

        <button type="submit" className="w-fit rounded bg-accent px-4 py-2 text-accent-foreground">
          Save preferences
        </button>
      </form>

      <form action={signOut}>
        <button type="submit" className="rounded border px-4 py-2">
          Sign out
        </button>
      </form>

      <p className="text-xs text-muted">Version {packageJson.version}</p>
    </main>
  )
}
