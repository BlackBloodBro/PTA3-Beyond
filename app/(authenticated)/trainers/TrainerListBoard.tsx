'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { deleteTrainer } from '@/app/(authenticated)/trainers/actions'
import { ConfirmButton } from '@/components/ConfirmButton'
import { trainerHref } from '@/lib/pta3/trainerPaths'
import { TrainerCampaignControl } from './TrainerCampaignControl'

export type TrainerListRow = {
  id: string
  name: string
  level: number
  className: string | null
  originName: string | null
  campaignId: string | null
  campaignName: string | null
  pokemonCount: number
}

// Client-side filtering over the full list, no URL sync -- same PcBoard.tsx pattern used elsewhere,
// but this list is personal (owned by the browsing user) rather than GM/campaign-scoped tooling, so
// there's no shared-link use case that would call for URL state instead.
function matchesSearch(t: TrainerListRow, searchText: string): boolean {
  if (!searchText) return true
  const needle = searchText.toLowerCase()
  const haystack = `${t.name} ${t.className ?? ''} ${t.originName ?? ''}`.toLowerCase()
  return haystack.includes(needle)
}

export function TrainerListBoard({
  trainers,
  assignableCampaigns,
}: {
  trainers: TrainerListRow[]
  assignableCampaigns: { id: string; name: string }[]
}) {
  const [searchText, setSearchText] = useState('')

  const filtered = useMemo(() => trainers.filter((t) => matchesSearch(t, searchText)), [trainers, searchText])

  return (
    <div className="flex w-full max-w-2xl flex-col gap-4">
      {trainers.length > 0 && (
        <div className="flex flex-wrap items-end gap-2 text-sm">
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor="trainerSearch">Search</label>
            <input
              id="trainerSearch"
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Name, class, or origin"
              className="bg-surface-subtle rounded border px-2 py-1"
            />
          </div>
          <p className="text-xs text-muted">{filtered.length} of {trainers.length}</p>
        </div>
      )}

      {trainers.length === 0 ? (
        <p className="text-sm text-muted">You don&apos;t have any trainers yet.</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted">No trainers match.</p>
      ) : (
        filtered.map((t) => (
          <div key={t.id} className="rounded border-accent bg-accent/10 p-4">
            <div className="flex items-center justify-between gap-2">
              <Link href={trainerHref({ id: t.id, is_npc: false, campaign_id: t.campaignId })} className="text-lg font-semibold underline">
                {t.name}
              </Link>
              <form action={deleteTrainer.bind(null, t.id)}>
                <ConfirmButton
                  confirmMessage={`Permanently delete ${t.name}? This cannot be undone.${
                    t.pokemonCount > 0 ? ` Their ${t.pokemonCount} Pokémon will become unassigned, not deleted.` : ''
                  }`}
                  className="rounded border border-danger px-3 py-1 text-sm text-danger"
                >
                  Delete
                </ConfirmButton>
              </form>
            </div>
            <p className="text-sm text-muted">
              Level {t.level} {t.className} — {t.originName}
            </p>
            <TrainerCampaignControl
              trainerId={t.id}
              initialCampaignId={t.campaignId}
              initialCampaignName={t.campaignName}
              assignableCampaigns={assignableCampaigns}
            />
          </div>
        ))
      )}
    </div>
  )
}
