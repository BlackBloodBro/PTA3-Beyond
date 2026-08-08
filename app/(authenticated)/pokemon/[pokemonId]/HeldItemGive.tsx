'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { giveHeldItem } from '@/app/(authenticated)/trainers/[id]/bag/actions'

export type GivableItem = { id: string; name: string }

// Reverse of HeldItemTakeBack -- equips an item straight from the Trainer's bag. Item name only, no
// description (per the FR's own scope note -- still go to the Inventory for that). Only rendered when
// the Pokemon has no held item yet and belongs to a Trainer.
export function HeldItemGive({ trainerId, pokemonId, items }: { trainerId: string; pokemonId: string; items: GivableItem[] }) {
  const [open, setOpen] = useState(false)
  const [selectedId, setSelectedId] = useState('')
  const [given, setGiven] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleConfirm() {
    if (!selectedId) return
    setPending(true)
    setError(null)
    const result = await giveHeldItem(trainerId, selectedId, pokemonId)
    setPending(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setGiven(true)
    setOpen(false)
    router.refresh()
  }

  if (given) return null

  if (!open) {
    return (
      <span className="ml-2 inline-flex items-center gap-2">
        <button type="button" onClick={() => setOpen(true)} disabled={items.length === 0} className="rounded border px-2 py-0.5 text-xs disabled:opacity-50">
          Give item
        </button>
      </span>
    )
  }

  return (
    <span className="ml-2 inline-flex flex-wrap items-center gap-2">
      <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="bg-surface-subtle rounded border px-2 py-1 text-xs">
        <option value="">Select an item…</option>
        {items.map((it) => (
          <option key={it.id} value={it.id}>{it.name}</option>
        ))}
      </select>
      <button type="button" disabled={!selectedId || pending} onClick={handleConfirm} className="rounded bg-accent px-2 py-0.5 text-xs text-accent-foreground disabled:opacity-50">
        Confirm
      </button>
      <button type="button" onClick={() => setOpen(false)} className="rounded border px-2 py-0.5 text-xs">
        Cancel
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
  )
}
