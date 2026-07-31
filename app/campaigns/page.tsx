import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function CampaignsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const [{ data: gmCampaigns }, { data: memberships }] = await Promise.all([
    supabase.from('campaigns').select('id, name').eq('gm_user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('campaign_members').select('campaigns(id, name)').eq('user_id', user.id).order('joined_at', { ascending: false }),
  ])

  const memberCampaigns = (memberships ?? [])
    .map((m) => m.campaigns)
    .filter((c): c is { id: string; name: string } => c !== null)

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-24">
      <div className="w-full max-w-2xl">
        <Link href="/dashboard" className="text-sm underline">
          ← Dashboard
        </Link>
      </div>

      <div className="flex w-full max-w-2xl items-center justify-between">
        <h1 className="text-2xl font-bold">Campaigns</h1>
        <div className="flex gap-2">
          <Link href="/campaigns/join" className="rounded border px-4 py-2 text-sm">
            Join a campaign
          </Link>
          <Link href="/campaigns/new" className="rounded bg-black px-4 py-2 text-sm text-white">
            + New campaign
          </Link>
        </div>
      </div>

      <div className="flex w-full max-w-2xl flex-col gap-2">
        {(gmCampaigns ?? []).length === 0 && memberCampaigns.length === 0 ? (
          <p className="text-sm text-neutral-500">You&apos;re not part of any campaigns yet.</p>
        ) : (
          <>
            {(gmCampaigns ?? []).map((c) => (
              <Link key={c.id} href={`/campaigns/${c.id}`} className="rounded border p-3 underline">
                {c.name} <span className="text-sm font-normal text-neutral-500">(GM)</span>
              </Link>
            ))}
            {memberCampaigns.map((c) => (
              <Link key={c.id} href={`/campaigns/${c.id}`} className="rounded border p-3 underline">
                {c.name}
              </Link>
            ))}
          </>
        )}
      </div>
    </main>
  )
}
