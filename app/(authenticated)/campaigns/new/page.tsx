import { createCampaign } from '@/app/(authenticated)/campaigns/actions'

export default async function NewCampaignPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-24">
      <h1 className="text-2xl font-bold">Create a Campaign</h1>

      {params.error && <p className="text-danger">{params.error}</p>}

      <form action={createCampaign} className="flex w-full max-w-md flex-col gap-3">
        <label htmlFor="name">Name</label>
        <input id="name" name="name" type="text" required className="bg-surface-subtle rounded border px-3 py-2" />

        <label htmlFor="description">Description (optional)</label>
        <textarea id="description" name="description" rows={3} className="bg-surface-subtle rounded border px-3 py-2" />

        <button type="submit" className="mt-2 rounded bg-accent px-4 py-2 text-accent-foreground">
          Create campaign
        </button>
      </form>
    </main>
  )
}
