'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { resolveAccuracy, type AccuracyResult } from './combatActions'
import { adjustPokemonHp } from '@/app/(authenticated)/pokemon/actions'
import { adjustTrainerHp } from '@/app/(authenticated)/trainers/actions'

export type AttackerOption = { id: string; name: string; moves: { id: number; name: string }[] }
export type TargetOption = { id: string; name: string; trainerId: string | null; pokemonId: string | null }

// [[Feature - Add attack resolution to combat encounters]]: the one genuinely multi-step, physical-
// dice interaction in this feature -- pick attacker + Move + target, roll a d20 for real and enter it
// (native window.prompt, same convention as RollInputButton elsewhere, just not tied to a <form>
// since this calls resolveAccuracy directly rather than submitting one), see the computed hit/miss,
// then on a hit against a damage Move roll the shown dice for real and enter the total, which applies
// immediately via the *existing* adjustPokemonHp/adjustTrainerHp actions -- no new HP-mutation logic.
// All of this is plain in-memory component state; nothing about "resolving an attack" is persisted.
export function AttackResolver({ attackers, targets }: { attackers: AttackerOption[]; targets: TargetOption[] }) {
  const router = useRouter()
  const [attackerId, setAttackerId] = useState('')
  const [moveId, setMoveId] = useState('')
  const [targetId, setTargetId] = useState('')
  const [result, setResult] = useState<AccuracyResult | null>(null)
  const [resolving, setResolving] = useState(false)
  const [damageInput, setDamageInput] = useState('')
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState(false)

  const attacker = attackers.find((a) => a.id === attackerId)
  const target = targets.find((t) => t.id === targetId)

  function promptForRoll(label: string, max: number): number | null {
    let entry = window.prompt(`Roll ${label} for real and enter the result (1-${max}).`)
    while (entry !== null) {
      const n = Number(entry)
      if (Number.isInteger(n) && n >= 1 && n <= max) return n
      entry = window.prompt(`Enter a whole number from 1 to ${max}:`)
    }
    return null
  }

  async function handleResolve() {
    if (!attackerId || !moveId || !targetId) return
    const roll = promptForRoll('a d20', 20)
    if (roll === null) return
    setResolving(true)
    setResult(null)
    setApplied(false)
    setDamageInput('')
    const res = await resolveAccuracy(attackerId, targetId, Number(moveId), roll)
    setResolving(false)
    setResult(res)
  }

  async function handleApplyDamage() {
    if (!target || !damageInput) return
    const amount = Number(damageInput)
    if (!Number.isInteger(amount) || amount < 0) return
    setApplying(true)
    const applyResult = target.pokemonId
      ? await adjustPokemonHp(target.pokemonId, -1, amount)
      : await adjustTrainerHp(target.trainerId!, -1, amount)
    setApplying(false)
    if (!('error' in applyResult)) {
      setApplied(true)
      router.refresh()
    }
  }

  return (
    <div className="flex w-full max-w-2xl flex-col gap-3 rounded border-accent bg-accent/10 p-4 text-sm">
      <h2 className="font-semibold">Resolve an attack</h2>

      {attackers.length === 0 ? (
        <p className="text-xs text-muted">No Pokemon combatants available to attack with.</p>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="attackerId">Attacker</label>
            <select
              id="attackerId"
              value={attackerId}
              onChange={(e) => {
                setAttackerId(e.target.value)
                setMoveId('')
                setResult(null)
              }}
              className="bg-surface-subtle rounded border p-2"
            >
              <option value="" disabled>
                Select...
              </option>
              {attackers.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="moveId">Move</label>
            <select
              id="moveId"
              value={moveId}
              onChange={(e) => {
                setMoveId(e.target.value)
                setResult(null)
              }}
              disabled={!attacker}
              className="bg-surface-subtle rounded border p-2"
            >
              <option value="" disabled>
                Select...
              </option>
              {(attacker?.moves ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="targetId">Target</label>
            <select
              id="targetId"
              value={targetId}
              onChange={(e) => {
                setTargetId(e.target.value)
                setResult(null)
              }}
              className="bg-surface-subtle rounded border p-2"
            >
              <option value="" disabled>
                Select...
              </option>
              {targets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleResolve}
            disabled={!attackerId || !moveId || !targetId || resolving}
            className="rounded bg-accent px-3 py-2 text-accent-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            {resolving ? 'Resolving…' : 'Roll d20 & resolve'}
          </button>
        </div>
      )}

      {result && 'error' in result && <p className="text-danger">{result.error}</p>}

      {result && !('error' in result) && (
        <div className="rounded border p-3">
          <p>
            <span className="font-semibold">{result.moveName}</span> -- rolled {result.roll} + {result.toHitModifier} ={' '}
            {result.roll + result.toHitModifier} vs. target&apos;s {result.targetStatLabel} ({result.targetNumber}):{' '}
            <span className={result.hit ? 'font-semibold text-success' : 'font-semibold text-danger'}>{result.hit ? 'Hit!' : 'Missed'}</span>
          </p>

          {result.hit && !result.isDamageMove && (
            <p className="mt-1 text-xs text-muted">Status Move -- apply its effect manually (Afflictions/Stats), nothing else happens here.</p>
          )}

          {result.hit && result.isDamageMove && result.isImmune && <p className="mt-1 text-xs text-muted">Immune -- 0 damage, nothing to apply.</p>}

          {result.hit && result.isDamageMove && !result.isImmune && (
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <p className="w-full text-xs text-muted">
                Roll{' '}
                {result.damageDice
                  ? `${result.damageDice} ${result.damageModifier >= 0 ? '+' : ''}${result.damageModifier}`
                  : `${result.damageModifier >= 0 ? '+' : ''}${result.damageModifier}`}
                {result.effectivenessLabel ? ` (${result.effectivenessLabel})` : ''} for real and enter the total:
              </p>
              <input
                type="number"
                min={0}
                value={damageInput}
                onChange={(e) => setDamageInput(e.target.value)}
                className="bg-surface-subtle w-24 rounded border p-2"
                placeholder="Damage"
              />
              <button
                type="button"
                onClick={handleApplyDamage}
                disabled={!damageInput || applying || applied}
                className="rounded border border-danger px-3 py-2 text-danger disabled:cursor-not-allowed disabled:opacity-40"
              >
                {applied ? 'Applied' : applying ? 'Applying…' : 'Apply damage'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
