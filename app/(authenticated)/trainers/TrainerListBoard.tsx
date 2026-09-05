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
  isNpc: boolean
}

// [[Improvement - Add additional filters to Trainer overview]]: a real campaign id (UUID) never
// collides with this sentinel, so it's safe as the "No campaign" option's value.
const NO_CAMPAIGN_VALUE = '__none__'

// Client-side filtering over the full list, no URL sync -- same PcBoard.tsx pattern used elsewhere,
// but this list is personal (owned by the browsing user) rather than GM/campaign-scoped tooling, so
// there's no shared-link use case that would call for URL state instead.
// [[Improvement - Add additional filters to Trainer overview]]: Class/Origin/Campaign filters added
// alongside the existing text search -- every field they need was already fetched and rendered
// (className/originName/campaignId), so this is purely additive, no new query.
function matchesFilters(t: TrainerListRow, searchText: string, classFilter: string, originFilter: string, campaignFilter: string): boolean {
  if (searchText) {
    const needle = searchText.toLowerCase()
    const haystack = `${t.name} ${t.className ?? ''} ${t.originName ?? ''}`.toLowerCase()
    if (!haystack.includes(needle)) return false
  }
  if (classFilter && t.className !== classFilter) return false
  if (originFilter && t.originName !== originFilter) return false
  if (campaignFilter === NO_CAMPAIGN_VALUE) {
    if (t.campaignId !== null) return false
  } else if (campaignFilter && t.campaignId !== campaignFilter) {
    return false
  }
  return true
}

function TrainerRow({ t, assignableCampaigns }: { t: TrainerListRow; assignableCampaigns: { id: string; name: string; isGM: boolean }[] }) {
  return (
    <div className="rounded border-accent bg-accent/10 p-4">
      <div className="flex items-center justify-between gap-2">
        <Link href={trainerHref({ id: t.id, is_npc: t.isNpc, campaign_id: t.campaignId })} className="text-lg font-semibold underline">
          {t.name}
        </Link>
        {/* [[Bug - Deleting an NPC from the Trainers overview redirects to the Campaign's NPC
            page]]: explicit returnTo keeps the user on this list regardless of the deleted
            Trainer's type, instead of deleteTrainer's own default (which sends an NPC's delete
            to its Campaign's NPC page -- correct when deleting from that Trainer's own page, not
            from a list of many). */}
        <form action={deleteTrainer.bind(null, t.id, '/trainers')}>
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
        initialIsNpc={t.isNpc}
        assignableCampaigns={assignableCampaigns}
      />
    </div>
  )
}

export function TrainerListBoard({
  trainers,
  assignableCampaigns,
}: {
  trainers: TrainerListRow[]
  assignableCampaigns: { id: string; name: string; isGM: boolean }[]
}) {
  const [searchText, setSearchText] = useState('')
  const [classFilter, setClassFilter] = useState('')
  const [originFilter, setOriginFilter] = useState('')
  const [campaignFilter, setCampaignFilter] = useState('')

  // Options built from what's actually present among these Trainers, not a full Classes/Origins/
  // Campaigns table fetch -- only values that could ever actually match something are offered.
  const classOptions = useMemo(
    () => Array.from(new Set(trainers.map((t) => t.className).filter((v): v is string => v !== null))).sort(),
    [trainers],
  )
  const originOptions = useMemo(
    () => Array.from(new Set(trainers.map((t) => t.originName).filter((v): v is string => v !== null))).sort(),
    [trainers],
  )
  const campaignOptions = useMemo(() => {
    const byId = new Map<string, string>()
    for (const t of trainers) {
      if (t.campaignId && t.campaignName) byId.set(t.campaignId, t.campaignName)
    }
    return Array.from(byId, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [trainers])

  const filtered = useMemo(
    () => trainers.filter((t) => matchesFilters(t, searchText, classFilter, originFilter, campaignFilter)),
    [trainers, searchText, classFilter, originFilter, campaignFilter],
  )
  // [[Improvement - Inconsistency with Trainers vs Pokemon]]: NPCs (owned by this GM, same as any
  // Wild Pokemon) now show up here too, per the user's resolved design -- in their own section
  // rather than mixed into "Your Trainers", reusing the is_npc flag the row already carries.
  const playerRows = useMemo(() => filtered.filter((t) => !t.isNpc), [filtered])
  const npcRows = useMemo(() => filtered.filter((t) => t.isNpc), [filtered])
  const hasAnyNpcs = trainers.some((t) => t.isNpc)

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
          <div className="flex flex-col gap-1">
            <label htmlFor="trainerClassFilter">Class</label>
            <select
              id="trainerClassFilter"
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="bg-surface-subtle rounded border px-2 py-1"
            >
              <option value="">Any class</option>
              {classOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="trainerOriginFilter">Origin</label>
            <select
              id="trainerOriginFilter"
              value={originFilter}
              onChange={(e) => setOriginFilter(e.target.value)}
              className="bg-surface-subtle rounded border px-2 py-1"
            >
              <option value="">Any origin</option>
              {originOptions.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="trainerCampaignFilter">Campaign</label>
            <select
              id="trainerCampaignFilter"
              value={campaignFilter}
              onChange={(e) => setCampaignFilter(e.target.value)}
              className="bg-surface-subtle rounded border px-2 py-1"
            >
              <option value="">Any campaign</option>
              <option value={NO_CAMPAIGN_VALUE}>No campaign</option>
              {campaignOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <p className="ml-auto text-xs text-muted">{filtered.length} of {trainers.length}</p>
        </div>
      )}

      {trainers.length === 0 ? (
        <p className="text-sm text-muted">You don&apos;t have any trainers yet.</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted">No trainers match.</p>
      ) : (
        <>
          <div className="flex flex-col gap-4">
            {hasAnyNpcs && <h2 className="font-semibold">Your Trainers</h2>}
            {playerRows.length === 0 ? (
              hasAnyNpcs && <p className="text-sm text-muted">No trainers match.</p>
            ) : (
              playerRows.map((t) => <TrainerRow key={t.id} t={t} assignableCampaigns={assignableCampaigns} />)
            )}
          </div>

          {hasAnyNpcs && (
            <div className="flex flex-col gap-4">
              <h2 className="font-semibold">Your NPCs</h2>
              {npcRows.length === 0 ? (
                <p className="text-sm text-muted">No NPCs match.</p>
              ) : (
                npcRows.map((t) => <TrainerRow key={t.id} t={t} assignableCampaigns={assignableCampaigns} />)
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
