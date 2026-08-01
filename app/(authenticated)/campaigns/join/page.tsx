import { joinCampaign } from '@/app/(authenticated)/campaigns/actions'

export default async function JoinCampaignPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-24">
      <h1 className="text-2xl font-bold">Join a Campaign</h1>

      {params.error && <p className="text-danger">{params.error}</p>}

      <form action={joinCampaign} className="flex w-full max-w-sm flex-col gap-3">
        <label htmlFor="code">Invite code</label>
        <input
          id="code"
          name="code"
          type="text"
          required
          className="bg-surface-subtle rounded border px-3 py-2 uppercase"
          maxLength={6}
        />

        <button type="submit" className="mt-2 rounded bg-accent px-4 py-2 text-accent-foreground">
          Join
        </button>
      </form>
    </main>
  )
}
