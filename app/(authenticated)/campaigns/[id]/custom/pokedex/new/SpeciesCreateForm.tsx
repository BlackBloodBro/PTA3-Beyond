'use client'

import { useRef, useState, useTransition } from 'react'
import { createCustomSpecies } from '../actions'
import { SpeciesStatBlockFields, type SpeciesStatBlockInitial } from '../SpeciesStatBlockFields'

type NamedIdOption = { id: number; name: string }
type MoveRow = { id: number; name: string; range: string; damage_stat: string; types: { name: string } | null }
type PassiveRow = { id: number; name: string; passive_type: string; category: string | null }
type StagedMove = { level_learned: number | null; move: MoveRow }
type StagedPassive = { level_learned: number | null; passive: PassiveRow }

// [[Feature - GM Custom - Pokemon]]: Moves and Passives can now be picked during creation itself,
// not only after the first save (2026-09-17 addendum, per the user) -- this wraps the same stat-block
// fields the edit page uses in a client <form onSubmit> instead of a plain <form action>, because the
// staged Moves/Passives (local-only state, nothing persisted yet -- there's no pokedexId to attach
// them to until the species itself exists) need to ride along in the same single submission rather
// than the edit page's own "click Add, persist immediately" flow. Reuses the exact search-then-click
// idiom SpeciesRelationsEditor/GrantMoveSection already established, just against local state instead
// of a server action per click.
export function SpeciesCreateForm({
  campaignId,
  types,
  sizes,
  weights,
  growthRates,
  habitats,
  proficiencies,
  diets,
  eggGroups,
  allMoves,
  allPassives,
  initial,
  initialMoves,
  initialPassives,
}: {
  campaignId: string
  types: NamedIdOption[]
  sizes: NamedIdOption[]
  weights: NamedIdOption[]
  growthRates: NamedIdOption[]
  habitats: NamedIdOption[]
  proficiencies: NamedIdOption[]
  diets: NamedIdOption[]
  eggGroups: NamedIdOption[]
  allMoves: MoveRow[]
  allPassives: PassiveRow[]
  initial?: SpeciesStatBlockInitial
  initialMoves?: StagedMove[]
  initialPassives?: StagedPassive[]
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const [isPending, startTransition] = useTransition()
  const [moves, setMoves] = useState<StagedMove[]>(initialMoves ?? [])
  const [passives, setPassives] = useState<StagedPassive[]>(initialPassives ?? [])
  const [moveSearch, setMoveSearch] = useState('')
  const [passiveSearch, setPassiveSearch] = useState('')
  const [moveLevel, setMoveLevel] = useState('')
  const [passiveLevel, setPassiveLevel] = useState('')

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

  function addMove(move: MoveRow) {
    setMoves((prev) => [...prev, { level_learned: parseLevel(moveLevel), move }])
    setMoveSearch('')
  }

  function addPassive(passive: PassiveRow) {
    setPassives((prev) => [...prev, { level_learned: parseLevel(passiveLevel), passive }])
    setPassiveSearch('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const formData = new FormData(formRef.current!)
    formData.set('movesJson', JSON.stringify(moves.map((m) => ({ id: m.move.id, levelLearned: m.level_learned }))))
    formData.set('passivesJson', JSON.stringify(passives.map((p) => ({ id: p.passive.id, levelLearned: p.level_learned }))))
    startTransition(() => createCustomSpecies(campaignId, formData))
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-3">
      <SpeciesStatBlockFields
        types={types}
        sizes={sizes}
        weights={weights}
        growthRates={growthRates}
        habitats={habitats}
        proficiencies={proficiencies}
        diets={diets}
        eggGroups={eggGroups}
        initial={initial}
      />

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
                <button type="button" onClick={() => setMoves((prev) => prev.filter((x) => x.move.id !== m.move.id))} className="shrink-0 rounded border px-2 py-1 text-xs">
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
                  <button type="button" onClick={() => addMove(move)} className="shrink-0 rounded border border-accent px-2 py-1 text-xs">
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
                <button type="button" onClick={() => setPassives((prev) => prev.filter((x) => x.passive.id !== p.passive.id))} className="shrink-0 rounded border px-2 py-1 text-xs">
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-end gap-2">
          <input
            type="text"
            value={passiveSearch}
            onChange={(e) => setPassiveSearch(e.target.value)}
            placeholder="Search the Passive catalog…"
            className="bg-surface-subtle flex-1 rounded border px-2 py-1"
          />
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
                  <button type="button" onClick={() => addPassive(passive)} className="shrink-0 rounded border border-accent px-2 py-1 text-xs">
                    Add
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </section>

      <button type="submit" disabled={isPending} className="mt-2 rounded bg-accent px-4 py-2 text-accent-foreground disabled:opacity-50">
        {isPending ? 'Creating…' : 'Create species'}
      </button>
    </form>
  )
}
