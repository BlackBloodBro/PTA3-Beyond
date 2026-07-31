import { createCampaign } from '@/app/campaigns/actions'

export default async function NewCampaignPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-24">
      <h1 className="text-2xl font-bold">Create a Campaign</h1>

      {params.error && <p className="text-red-600">{params.error}</p>}

      <form action={createCampaign} className="flex w-full max-w-md flex-col gap-3">
        <label htmlFor="name">Name</label>
        <input id="name" name="name" type="text" required className="rounded border px-3 py-2" />

        <label htmlFor="description">Description (optional)</label>
        <textarea id="description" name="description" rows={3} className="rounded border px-3 py-2" />

        <button type="submit" className="mt-2 rounded bg-black px-4 py-2 text-white">
          Create campaign
        </button>
      </form>
    </main>
  )
}
