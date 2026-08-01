import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function BagPage({ params }: { params: Promise<{ id: string }> }) {
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

  const { data: items } = await supabase
    .from('trainers_items')
    .select('quantity, items(name), moves(name), pokedex(name)')
    .eq('trainer_id', id)

  return (
    <main className="flex min-h-screen flex-col items-center gap-4 p-24">
      <h1 className="text-2xl font-bold">{trainer.name}&apos;s Bag</h1>
      {(items ?? []).length === 0 ? (
        <p className="text-muted">No items yet.</p>
      ) : (
        <ul className="w-full max-w-md list-disc pl-5">
          {(items ?? []).map((it, i) => (
            <li key={i}>
              {it.items!.name} x{it.quantity}
              {it.moves ? ` (${it.moves.name})` : ''}
              {it.pokedex ? ` (${it.pokedex.name})` : ''}
            </li>
          ))}
        </ul>
      )}
      <Link href={`/trainers/${id}`} className="underline">
        Back to {trainer.name}
      </Link>
    </main>
  )
}
