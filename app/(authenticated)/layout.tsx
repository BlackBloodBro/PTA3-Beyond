import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from './Sidebar'

// Shared shell for every authenticated route (Dashboard/Campaigns/Trainers/Pokemon/Settings) --
// centralizes the auth guard so a signed-out visit anywhere under here redirects to /login before
// the page itself even renders, and gives every page the same thin header for free. Existing
// per-page `if (!user) redirect('/login')` checks are left in place rather than stripped out --
// this guard is a defense-in-depth addition, not a replacement, and removing them would mean
// touching all 21 pages' null-handling for a side-benefit this feature doesn't require.
export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Theme preference, read server-side so there's no client-side toggle/localStorage and no
  // flash-of-wrong-theme -- the HTML that reaches the browser already carries the right attributes.
  const { data: profile } = await supabase.from('users').select('theme_mode, theme_accent').eq('id', user.id).single()

  return (
    <div
      data-theme={profile?.theme_mode === 'dark' ? 'dark' : undefined}
      data-accent={profile?.theme_accent ?? undefined}
      className="min-h-screen bg-page text-foreground"
    >
      <header className="flex items-center justify-between border-b px-6 py-3">
        <Link href="/dashboard" className="font-bold">
          PTA3 Tool
        </Link>
        <Link href="/settings" className="text-sm underline">
          Settings
        </Link>
      </header>
      <div className="flex">
        <Sidebar />
        <div className="flex-1">{children}</div>
      </div>
    </div>
  )
}
