import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/app/auth/actions'
import { LABEL_COLORS, LABEL_SWATCH_CLASSES } from '@/lib/pta3/labelColors'
import { updateThemePreferences, updateUsername, updatePassword, deleteAccount } from './actions'
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

  // What "Delete account" would remove, and which of the user's GM'd Campaigns still block it (another user's
  // player Trainer in it -- the same rule delete_own_account enforces).
  const [{ data: ownTrainers }, { data: gmCampaigns }] = await Promise.all([
    supabase.from('trainers').select('id, is_npc').eq('user_id', user.id),
    supabase.from('campaigns').select('id, name').eq('gm_user_id', user.id).order('name'),
  ])
  const gmCampaignIds = (gmCampaigns ?? []).map((c) => c.id)
  const { data: otherPlayerTrainers } = gmCampaignIds.length
    ? await supabase
        .from('trainers')
        .select('campaign_id')
        .in('campaign_id', gmCampaignIds)
        .eq('is_npc', false)
        .neq('user_id', user.id)
    : { data: [] as { campaign_id: string | null }[] }
  const blockingIds = new Set((otherPlayerTrainers ?? []).map((t) => t.campaign_id))
  const blockingCampaigns = (gmCampaigns ?? []).filter((c) => blockingIds.has(c.id))
  const playerTrainerCount = (ownTrainers ?? []).filter((t) => !t.is_npc).length
  const npcCount = (ownTrainers ?? []).filter((t) => t.is_npc).length

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

      <section id="delete-account" className="flex w-full max-w-sm flex-col gap-2 rounded border border-danger p-4">
        <h2 className="text-sm font-semibold text-danger">Delete account</h2>
        <p className="text-sm">
          Permanently deletes your account and everything only you have. This can&apos;t be undone.
        </p>
        <ul className="list-disc pl-5 text-sm text-muted">
          <li>
            {playerTrainerCount} Trainer{playerTrainerCount === 1 ? '' : 's'}
            {npcCount > 0 && ` and ${npcCount} NPC${npcCount === 1 ? '' : 's'}`}, with their Pokémon and items
          </li>
          <li>
            {gmCampaigns?.length ?? 0} campaign{gmCampaigns?.length === 1 ? '' : 's'} you GM
            {gmCampaigns && gmCampaigns.length > 0 && `: ${gmCampaigns.map((c) => c.name).join(', ')}`}
          </li>
          <li>Pokémon you created that are now another player&apos;s, or in another GM&apos;s campaign, are kept for them</li>
        </ul>
        {blockingCampaigns.length > 0 ? (
          <div className="text-sm text-danger">
            <p>Other players still have Trainers in these campaigns. Remove their Trainers or delete the campaigns first:</p>
            <ul className="list-disc pl-5">
              {blockingCampaigns.map((c) => (
                <li key={c.id}>
                  <Link href={`/campaigns/${c.id}`} className="underline">
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <form action={deleteAccount} className="flex flex-col gap-2">
            <input
              name="password"
              type="password"
              placeholder="Your password"
              required
              autoComplete="current-password"
              className="bg-surface-subtle rounded border px-3 py-2"
            />
            <label htmlFor="deleteConfirmation" className="text-sm">
              Type <span className="font-mono font-semibold">DELETE</span> to confirm
            </label>
            <input
              id="deleteConfirmation"
              name="confirmation"
              type="text"
              required
              autoComplete="off"
              pattern="DELETE"
              className="bg-surface-subtle rounded border px-3 py-2"
            />
            <button type="submit" className="w-fit rounded bg-danger px-4 py-2 text-white">
              Delete my account
            </button>
          </form>
        )}
      </section>

      <p className="text-xs text-muted">Version {packageJson.version}</p>
    </main>
  )
}
