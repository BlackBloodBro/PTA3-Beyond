'use client'

import { PokemonSprite } from '@/components/PokemonSprite'
import { ConfirmButton } from '@/components/ConfirmButton'
import { sortByInitiative } from '@/lib/pta3/encounterLive'
import { useState } from 'react'
import { removeCombatant, scanSpecies, setCombatantInitiative, skipMyTurn } from '../actions'
import { CombatantDetailModal } from './CombatantDetailModal'
import { useEncounterLive } from './EncounterLiveProvider'

// [[Improvement - Make Advance turn update in place]]: the player's own "Skip turn" -- calls skip_my_turn() and
// re-polls instead of redirecting (which re-rendered the whole page).
function SkipTurnButton({ encounterId }: { encounterId: string }) {
  const { pollNow } = useEncounterLive()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setPending(true)
    setError(null)
    const res = await skipMyTurn(encounterId)
    setPending(false)
    if ('error' in res) {
      setError(res.error)
      return
    }
    pollNow()
  }

  return (
    <>
      <button type="button" onClick={handleClick} disabled={pending} className="rounded border px-2 py-1 text-xs disabled:opacity-60">
        {pending ? 'Skipping…' : 'Skip turn'}
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </>
  )
}

// The static, server-rendered half of one initiative row -- identity/masking, max HP, and what the viewer
// owns. None of it changes mid-fight (a change in who's in the fight, or an enemy being revealed, does a
// full page refresh instead). The live half -- current HP, initiative, whose turn it is -- comes from the
// live store, so the tracker updates in place without re-rendering the server page.
export type TrackerCombatant = {
  id: string
  side: 'ally' | 'enemy'
  name: string
  href: string | null
  typeLabel: string | null
  // Pokemon only.
  pokemon: { pokedexId: number; spriteCode: string | null; shiny: boolean; identified: boolean } | null
  maxHp: number
  isOwnTrainer: boolean
  isOwnPokemon: boolean
  initialHp: number
  initialTurnOrder: number | null
}

// [[Improvement - Move initiative tracker to a right sidebar]] et al: markup carried over unchanged from
// the old server-rendered aside in page.tsx.
export function InitiativeTracker({
  combatants,
  isGM,
  encounterId,
  campaignId,
}: {
  combatants: TrackerCombatant[]
  isGM: boolean
  encounterId: string
  campaignId: string
}) {
  const { snapshot, currentCombatantId } = useEncounterLive()
  const liveById = new Map(snapshot.combatants.map((c) => [c.id, c]))
  const marked = new Set(snapshot.markedCombatantIds)

  const rows = sortByInitiative(
    combatants.map((c) => {
      const live = liveById.get(c.id)
      return { ...c, turnOrder: live ? live.turnOrder : c.initialTurnOrder, currentHp: live ? live.currentHp : c.initialHp }
    }),
  )

  if (rows.length === 0) return <p className="text-sm text-muted">No combatants yet.</p>

  return (
    <>
      {rows.map((c) => {
        const isDown = c.currentHp <= 0
        const isCurrent = c.id === currentCombatantId
        return (
          <div
            key={c.id}
            className={`flex flex-col gap-2 rounded border p-3 ${isCurrent ? 'border-2 border-warning bg-warning/10' : 'border-accent bg-accent/10'} ${
              isDown ? 'opacity-50' : ''
            }`}
          >
            <div className="flex items-start gap-2">
              {c.pokemon && !c.pokemon.identified ? (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-surface-muted text-sm text-muted">?</div>
              ) : (
                c.pokemon?.spriteCode && <PokemonSprite spriteCode={c.pokemon.spriteCode} shiny={c.pokemon.shiny} alt={c.name} size={32} />
              )}
              <div className="min-w-0">
                <p className="text-sm">
                  <span className={`mr-1 rounded px-1.5 py-0.5 text-xs font-semibold ${c.side === 'ally' ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`}>
                    {c.side === 'ally' ? 'Ally' : 'Enemy'}
                  </span>
                  <CombatantDetailModal combatantId={c.id} label={c.name} href={c.href} />
                  {marked.has(c.id) && (
                    <span className="ml-1 rounded bg-warning/20 px-1.5 py-0.5 text-xs font-semibold text-warning" title="Critical advice: critical hits on a natural 18-20">
                      Marked
                    </span>
                  )}
                  {c.typeLabel && <span className="text-muted"> -- {c.typeLabel}</span>}
                </p>
                {isCurrent && <p className="text-xs font-semibold text-warning">← Current turn</p>}
                <p className="text-xs text-muted">
                  {c.currentHp}/{c.maxHp} HP · Initiative {c.turnOrder ?? 'not set'}
                  {isDown ? ' · Down (0 HP)' : ''}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isGM && (
                <>
                  {/* key={turnOrder}: an uncontrolled defaultValue is only read on mount, so remount the
                      input when a live update changes the value (e.g. another GM tab set it). */}
                  <form action={setCombatantInitiative.bind(null, encounterId, campaignId, c.id)} className="flex items-center gap-1">
                    <input
                      key={c.turnOrder ?? 'none'}
                      type="number"
                      name="turnOrder"
                      defaultValue={c.turnOrder ?? ''}
                      placeholder="Init."
                      className="bg-surface-subtle w-16 rounded border px-1 py-1 text-xs"
                    />
                    <button type="submit" className="rounded border px-2 py-1 text-xs">
                      Set
                    </button>
                  </form>
                  <form action={removeCombatant.bind(null, encounterId, campaignId, c.id)}>
                    <ConfirmButton confirmMessage={`Remove ${c.name} from this encounter?`} className="rounded border border-danger px-2 py-1 text-xs text-danger">
                      Remove
                    </ConfirmButton>
                  </form>
                </>
              )}
              {!isGM && c.isOwnTrainer && (
                <form action={removeCombatant.bind(null, encounterId, campaignId, c.id)}>
                  <ConfirmButton confirmMessage="Leave this encounter?" className="rounded border px-2 py-1 text-xs">
                    Leave
                  </ConfirmButton>
                </form>
              )}
              {!isGM && c.isOwnPokemon && (
                <form action={removeCombatant.bind(null, encounterId, campaignId, c.id)}>
                  <ConfirmButton confirmMessage="Recall this Pokémon from the encounter?" className="rounded border px-2 py-1 text-xs">
                    Recall
                  </ConfirmButton>
                </form>
              )}
              {/* [[Feature - Only active player on initiative tracker can do an action]]: self-service
                  skip, only on the player's own current-turn combatant; skip_my_turn() re-checks
                  ownership server-side regardless. */}
              {!isGM && isCurrent && (c.isOwnTrainer || c.isOwnPokemon) && (
                <SkipTurnButton encounterId={encounterId} />
              )}
              {c.pokemon && !c.pokemon.identified && (
                <form action={scanSpecies.bind(null, encounterId, campaignId, c.pokemon.pokedexId)}>
                  <button type="submit" className="rounded border border-accent px-2 py-1 text-xs font-semibold text-accent">
                    Use Pokédex
                  </button>
                </form>
              )}
            </div>
          </div>
        )
      })}
    </>
  )
}
