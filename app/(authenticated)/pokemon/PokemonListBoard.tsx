'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { deletePokemon } from '@/app/(authenticated)/pokemon/actions'
import { PokemonSprite } from '@/components/PokemonSprite'
import { ConfirmButton } from '@/components/ConfirmButton'
import { PokemonAssignmentPanel, type Trainer } from './PokemonAssignmentPanel'
import { pokemonHref } from '@/lib/pta3/pokemonPaths'

export type PokemonListRow = {
  id: string
  nickname: string | null
  is_shiny: boolean
  speciesName: string | null
  spriteCode: string | null
  trainerId: string | null
  trainerName: string | null
  trainerIsNpc: boolean | null
  trainerCampaignId: string | null
  campaignId: string | null
}

// Same client-side, no-URL-sync filtering approach as TrainerListBoard.tsx / PcBoard.tsx.
function matchesSearch(p: PokemonListRow, searchText: string): boolean {
  if (!searchText) return true
  const needle = searchText.toLowerCase()
  const haystack = `${p.nickname ?? ''} ${p.speciesName ?? ''}`.toLowerCase()
  return haystack.includes(needle)
}

export function PokemonListBoard({
  pokemon,
  assignableTrainers,
  assignableCampaigns,
}: {
  pokemon: PokemonListRow[]
  assignableTrainers: Trainer[]
  assignableCampaigns: { id: string; name: string }[]
}) {
  const [searchText, setSearchText] = useState('')

  const filtered = useMemo(() => pokemon.filter((p) => matchesSearch(p, searchText)), [pokemon, searchText])

  return (
    <div className="flex w-full max-w-2xl flex-col gap-2">
      {pokemon.length > 0 && (
        <div className="flex flex-wrap items-end gap-2 text-sm">
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor="pokemonSearch">Search</label>
            <input
              id="pokemonSearch"
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Nickname or species"
              className="bg-surface-subtle rounded border px-2 py-1"
            />
          </div>
          <p className="text-xs text-muted">{filtered.length} of {pokemon.length}</p>
        </div>
      )}

      {pokemon.length === 0 ? (
        <p className="text-sm text-muted">You don&apos;t have any Pokémon yet.</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted">No Pokémon match.</p>
      ) : (
        filtered.map((p) => (
          <div key={p.id} className="flex flex-col gap-2 rounded border-accent bg-accent/10 p-3">
            <div className="flex items-center justify-between gap-2">
              <Link
                href={pokemonHref({
                  id: p.id,
                  hasOwner: p.trainerId !== null,
                  campaignId: p.trainerId !== null ? p.trainerCampaignId : p.campaignId,
                })}
                className="flex items-center gap-2 underline"
              >
                {p.spriteCode && <PokemonSprite spriteCode={p.spriteCode} shiny={p.is_shiny} alt={p.speciesName ?? ''} size={32} />}
                {p.nickname ? `${p.nickname} (${p.speciesName})` : p.speciesName}
              </Link>
              <form action={deletePokemon.bind(null, p.id)}>
                <ConfirmButton
                  confirmMessage={`Permanently delete ${p.nickname ? `${p.nickname} (${p.speciesName})` : p.speciesName}? This cannot be undone.`}
                  className="rounded border border-danger px-3 py-1 text-xs text-danger"
                >
                  Delete
                </ConfirmButton>
              </form>
            </div>

            <PokemonAssignmentPanel
              pokemonId={p.id}
              initialTrainerId={p.trainerId}
              initialTrainerName={p.trainerName}
              initialTrainerIsNpc={p.trainerIsNpc}
              initialTrainerCampaignId={p.trainerCampaignId}
              initialCampaignId={p.campaignId}
              assignableTrainers={assignableTrainers}
              assignableCampaigns={assignableCampaigns}
            />
          </div>
        ))
      )}
    </div>
  )
}
