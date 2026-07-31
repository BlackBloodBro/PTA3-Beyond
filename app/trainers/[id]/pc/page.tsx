import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function PCPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // No .eq('user_id', ...) filter -- RLS scopes this to the owner or the campaign's GM.
  const { data: trainer } = await supabase.from('trainers').select('id, name').eq('id', id).single()

  if (!trainer) {
    redirect('/dashboard')
  }

  return (
    <main className="flex min-h-screen flex-col items-center gap-4 p-24">
      <h1 className="text-2xl font-bold">{trainer.name}&apos;s PC</h1>
      <p className="text-neutral-500">Coming soon — stored Pokémon will show up here.</p>
      <Link href={`/trainers/${id}`} className="underline">
        Back to {trainer.name}
      </Link>
    </main>
  )
}
