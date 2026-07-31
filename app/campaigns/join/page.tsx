import { joinCampaign } from '@/app/campaigns/actions'

export default async function JoinCampaignPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-24">
      <h1 className="text-2xl font-bold">Join a Campaign</h1>

      {params.error && <p className="text-red-600">{params.error}</p>}

      <form action={joinCampaign} className="flex w-full max-w-sm flex-col gap-3">
        <label htmlFor="code">Invite code</label>
        <input
          id="code"
          name="code"
          type="text"
          required
          className="rounded border px-3 py-2 uppercase"
          maxLength={6}
        />

        <button type="submit" className="mt-2 rounded bg-black px-4 py-2 text-white">
          Join
        </button>
      </form>
    </main>
  )
}
