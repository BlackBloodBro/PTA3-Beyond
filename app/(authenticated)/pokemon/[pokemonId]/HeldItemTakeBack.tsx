'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { takeBackHeldItem } from '@/app/(authenticated)/pokemon/actions'

// Reverse of the Bag page's "Give to Pokémon" -- unequips the held item and returns it to the
// Trainer's bag. Only rendered when the Pokemon actually has a held item and belongs to a Trainer.
export function HeldItemTakeBack({ pokemonId }: { pokemonId: string }) {
  const [taken, setTaken] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleClick() {
    setPending(true)
    setError(null)
    const result = await takeBackHeldItem(pokemonId)
    setPending(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setTaken(true)
    router.refresh()
  }

  if (taken) return null

  return (
    <span className="ml-2 inline-flex items-center gap-2">
      <button type="button" onClick={handleClick} disabled={pending} className="rounded border px-2 py-0.5 text-xs disabled:opacity-50">
        Take back
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
  )
}
