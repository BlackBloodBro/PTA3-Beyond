'use client'

import { useState } from 'react'
import { addSpeciesMove, removeSpeciesMove, addSpeciesPassive, removeSpeciesPassive } from '../actions'

type MoveRow = { id: number; name: string; range: string; damage_stat: string; types: { name: string } | null }
type PassiveRow = { id: number; name: string; passive_type: string; category: string | null }
type AttachedMove = { level_learned: number | null; move: MoveRow }
type AttachedPassive = { level_learned: number | null; passive: PassiveRow }

// [[Feature - GM Custom - Pokemon]]: Moves (632 rows) and Passives (327 rows) are too large for a
// checkbox wall (SpeciesForm's own habitats/proficiencies/diets/egg-groups approach), so this reuses
// the name-filtered-search-then-click-to-add shape PokemonInteractive.tsx's own GrantMoveSection
// already established for the same "big global catalog, add by name" need -- a real existing
// component idiom, better-suited here than the plain <datalist> the FR originally proposed before
// this was checked. level_learned is optional (blank = null = TM-eligible, matching [[Bug - Get Move
// Proficiencies locked in]]'s existing null-is-unrestricted convention) and applies to whichever row
// gets clicked next, not a per-row field -- a GM adding several moves at the same level types it
// once, not once per move.
export function SpeciesRelationsEditor({
  campaignId,
  pokedexId,
  allMoves,
  allPassives,
  initialMoves,
  initialPassives,
}: {
  campaignId: string
  pokedexId: number
  allMoves: MoveRow[]
  allPassives: PassiveRow[]
  initialMoves: AttachedMove[]
  initialPassives: AttachedPassive[]
}) {
  const [moves, setMoves] = useState(initialMoves)
  const [passives, setPassives] = useState(initialPassives)
  const [moveSearch, setMoveSearch] = useState('')
  const [passiveSearch, setPassiveSearch] = useState('')
  const [moveLevel, setMoveLevel] = useState('')
  const [passiveLevel, setPassiveLevel] = useState('')
  const [pendingId, setPendingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const knownMoveIds = new Set(moves.map((m) => m.move.id))
  const knownPassiveIds = new Set(passives.map((p) => p.passive.id))

  const moveNeedle = moveSearch.trim().toLowerCase()
  const moveMatches = moveNeedle ? allMoves.filter((m) => !knownMoveIds.has(m.id) && m.name.toLowerCase().includes(moveNeedle)).slice(0, 8) : []

  const passiveNeedle = passiveSearch.trim().toLowerCase()
  const passiveMatches = passiveNeedle ? allPassives.filter((p) => !knownPassiveIds.has(p.id) && p.name.toLowerCase().includes(passiveNeedle)).slice(0, 8) : []

  function parseLevel(raw: string): number | null {
    const trimmed = raw.trim()
    if (!trimmed) return null
    const n = Number(trimmed)
    return Number.isNaN(n) ? null : n
  }

  async function handleAddMove(move: MoveRow) {
    setError(null)
    setPendingId(move.id)
    const levelLearned = parseLevel(moveLevel)
    const result = await addSpeciesMove(campaignId, pokedexId, move.id, levelLearned)
    setPendingId(null)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setMoves((prev) => [...prev, { level_learned: levelLearned, move }])
    setMoveSearch('')
  }

  async function handleRemoveMove(moveId: number) {
    setError(null)
    setPendingId(moveId)
    const result = await removeSpeciesMove(campaignId, pokedexId, moveId)
    setPendingId(null)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setMoves((prev) => prev.filter((m) => m.move.id !== moveId))
  }

  async function handleAddPassive(passive: PassiveRow) {
    setError(null)
    setPendingId(passive.id)
    const levelLearned = parseLevel(passiveLevel)
    const result = await addSpeciesPassive(campaignId, pokedexId, passive.id, levelLearned)
    setPendingId(null)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setPassives((prev) => [...prev, { level_learned: levelLearned, passive }])
    setPassiveSearch('')
  }

  async function handleRemovePassive(passiveId: number) {
    setError(null)
    setPendingId(passiveId)
    const result = await removeSpeciesPassive(campaignId, pokedexId, passiveId)
    setPendingId(null)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setPassives((prev) => prev.filter((p) => p.passive.id !== passiveId))
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      {error && <p className="text-danger">{error}</p>}

      <section className="flex flex-col gap-2 rounded border border-accent bg-accent/10 p-4 text-sm">
        <h2 className="font-semibold">Moves ({moves.length})</h2>
        {moves.length === 0 ? (
          <p className="text-muted">None yet.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {moves.map((m) => (
              <li key={m.move.id} className="flex items-center justify-between gap-2 rounded border p-2">
                <span>
                  {m.move.name} <span className="text-xs text-muted">{m.level_learned === null ? '(TM-eligible)' : `(level ${m.level_learned})`}</span>
                </span>
                <button type="button" disabled={pendingId === m.move.id} onClick={() => handleRemoveMove(m.move.id)} className="shrink-0 rounded border px-2 py-1 text-xs disabled:opacity-30">
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-end gap-2">
          <input type="text" value={moveSearch} onChange={(e) => setMoveSearch(e.target.value)} placeholder="Search the Move catalog…" className="bg-surface-subtle flex-1 rounded border px-2 py-1" />
          <input type="number" min={0} value={moveLevel} onChange={(e) => setMoveLevel(e.target.value)} placeholder="Level" className="bg-surface-subtle w-20 rounded border px-2 py-1" />
        </div>
        {moveNeedle && (
          <ul className="flex flex-col gap-1">
            {moveMatches.length === 0 ? (
              <li className="text-muted">No matches.</li>
            ) : (
              moveMatches.map((move) => (
                <li key={move.id} className="flex items-center justify-between gap-2 rounded border p-2">
                  <span>
                    {move.name} <span className="text-xs text-muted">{move.types?.name} · {move.range} · {move.damage_stat.replace('_', ' ')}</span>
                  </span>
                  <button type="button" disabled={pendingId === move.id} onClick={() => handleAddMove(move)} className="shrink-0 rounded border border-accent px-2 py-1 text-xs disabled:opacity-30">
                    Add
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2 rounded border border-accent bg-accent/10 p-4 text-sm">
        <h2 className="font-semibold">Passives ({passives.length})</h2>
        {passives.length === 0 ? (
          <p className="text-muted">None yet.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {passives.map((p) => (
              <li key={p.passive.id} className="flex items-center justify-between gap-2 rounded border p-2">
                <span>
                  {p.passive.name}{' '}
                  <span className="text-xs text-muted">
                    ({p.passive.passive_type}{p.passive.category ? ` · ${p.passive.category.replace('_', ' ')}` : ''}) {p.level_learned === null ? '(always known)' : `(level ${p.level_learned})`}
                  </span>
                </span>
                <button type="button" disabled={pendingId === p.passive.id} onClick={() => handleRemovePassive(p.passive.id)} className="shrink-0 rounded border px-2 py-1 text-xs disabled:opacity-30">
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-end gap-2">
          <input type="text" value={passiveSearch} onChange={(e) => setPassiveSearch(e.target.value)} placeholder="Search the Passive catalog…" className="bg-surface-subtle flex-1 rounded border px-2 py-1" />
          <input type="number" min={0} value={passiveLevel} onChange={(e) => setPassiveLevel(e.target.value)} placeholder="Level" className="bg-surface-subtle w-20 rounded border px-2 py-1" />
        </div>
        {passiveNeedle && (
          <ul className="flex flex-col gap-1">
            {passiveMatches.length === 0 ? (
              <li className="text-muted">No matches.</li>
            ) : (
              passiveMatches.map((passive) => (
                <li key={passive.id} className="flex items-center justify-between gap-2 rounded border p-2">
                  <span>
                    {passive.name} <span className="text-xs text-muted">({passive.passive_type}{passive.category ? ` · ${passive.category.replace('_', ' ')}` : ''})</span>
                  </span>
                  <button type="button" disabled={pendingId === passive.id} onClick={() => handleAddPassive(passive)} className="shrink-0 rounded border border-accent px-2 py-1 text-xs disabled:opacity-30">
                    Add
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </section>
    </div>
  )
}
