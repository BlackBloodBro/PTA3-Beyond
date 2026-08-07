'use client'

import { useMemo, useState } from 'react'
import { createTrainer } from '@/app/(authenticated)/trainers/actions'
import { createNpc } from '@/app/(authenticated)/campaigns/[id]/actions'
import {
  POINT_BUY_BUDGET,
  POINT_BUY_COSTS,
  STAT_KEYS,
  pointBuyCost,
  statModifier,
  type StatKey,
} from '@/lib/pta3/pointBuy'

const STAT_LABELS: Record<StatKey, string> = {
  attack: 'Attack',
  defense: 'Defense',
  specialAttack: 'Special Attack',
  specialDefense: 'Special Defense',
  speed: 'Speed',
}

// The only 5-stat combinations that spend exactly the 25-point budget (there are 9 total),
// sorted from most extreme (min-maxed) to most balanced. Applying one sets stats in STAT_KEYS
// order as a starting point -- fine-tune from there with the +/- buttons.
const PRESETS: number[][] = [
  [6, 6, 1, 1, 1],
  [6, 4, 4, 1, 1],
  [6, 5, 3, 2, 1],
  [5, 5, 4, 2, 1],
  [4, 4, 4, 4, 1],
  [6, 5, 2, 2, 2],
  [6, 4, 3, 3, 2],
  [5, 4, 4, 3, 2],
  [5, 5, 3, 3, 3],
]

type Option = { id: number; name: string; lifestyle?: string | null }
type CampaignOption = { id: string; name: string }
type SkillOption = { id: number; name: string }
type OriginSkillTalentGroup = { pickCount: number; skills: SkillOption[] }

export function TrainerForm({
  classes,
  origins,
  campaigns,
  variant = 'player',
  campaignId,
  defaultCampaignId,
  classTalentOptions,
  originTalentGroups,
}: {
  classes: Option[]
  origins: Option[]
  campaigns: CampaignOption[]
  // 'npc' mode is used from a campaign's "+ New NPC" page: the campaign is fixed by the route
  // (not user-editable) and the form submits to createNpc instead of createTrainer.
  variant?: 'player' | 'npc'
  campaignId?: string
  // 'player' mode only -- preselects (but doesn't lock) the optional campaign dropdown, e.g. when
  // arriving via "Create a trainer for this campaign" from a specific campaign's own page.
  defaultCampaignId?: string
  // Every Class's flat Skill Talent list and every Origin's pick-groups, loaded in full upfront
  // (small reference data) so picking a Class/Origin can react instantly client-side instead of a
  // server round-trip -- same "load everything, filter client-side" shape as the level-up page's
  // Advanced Class picker.
  classTalentOptions: Record<number, SkillOption[]>
  originTalentGroups: Record<number, OriginSkillTalentGroup[]>
}) {
  const [stats, setStats] = useState<Record<StatKey, number>>({
    attack: 1,
    defense: 1,
    specialAttack: 1,
    specialDefense: 1,
    speed: 1,
  })

  const cost = useMemo(() => pointBuyCost(stats), [stats])
  const remaining = POINT_BUY_BUDGET - cost

  const [classId, setClassId] = useState('')
  const [originId, setOriginId] = useState('')
  const [classTalentSkillIds, setClassTalentSkillIds] = useState<Set<number>>(new Set())
  // Origin groups are independent of each other, so picks are tracked per group index rather than
  // one flat set -- picking a skill in group 0 shouldn't count against group 1's own cap even if
  // (hypothetically) the same skill id appeared in both.
  const [originGroupPicks, setOriginGroupPicks] = useState<Set<number>[]>([])

  const classSkillOptions = classId ? (classTalentOptions[Number(classId)] ?? []) : []
  const originGroups = originId ? (originTalentGroups[Number(originId)] ?? []) : []

  function handleClassChange(value: string) {
    setClassId(value)
    setClassTalentSkillIds(new Set())
  }

  function handleOriginChange(value: string) {
    setOriginId(value)
    setOriginGroupPicks([])
  }

  function toggleClassTalent(skillId: number) {
    setClassTalentSkillIds((prev) => {
      const next = new Set(prev)
      if (next.has(skillId)) {
        next.delete(skillId)
      } else if (next.size < 2) {
        next.add(skillId)
      }
      return next
    })
  }

  function toggleOriginTalent(groupIndex: number, pickCount: number, skillId: number) {
    setOriginGroupPicks((prev) => {
      const next = [...prev]
      const current = new Set(next[groupIndex] ?? [])
      if (current.has(skillId)) {
        current.delete(skillId)
      } else if (current.size < pickCount) {
        current.add(skillId)
      }
      next[groupIndex] = current
      return next
    })
  }

  const classTalentsSatisfied = classSkillOptions.length === 0 || classTalentSkillIds.size === 2
  const originTalentsSatisfied = originGroups.every((g, i) => (originGroupPicks[i]?.size ?? 0) === g.pickCount)

  function applyPreset(values: number[]) {
    setStats(() => {
      const next = {} as Record<StatKey, number>
      STAT_KEYS.forEach((key, i) => {
        next[key] = values[i]
      })
      return next
    })
  }

  function adjust(key: StatKey, delta: number) {
    setStats((s) => {
      const newValue = s[key] + delta
      if (newValue < 1 || newValue > 6) return s
      const newCost = cost - POINT_BUY_COSTS[s[key]] + POINT_BUY_COSTS[newValue]
      if (delta > 0 && newCost > POINT_BUY_BUDGET) return s
      return { ...s, [key]: newValue }
    })
  }

  return (
    <form
      action={variant === 'npc' ? createNpc.bind(null, campaignId!) : createTrainer}
      className="flex w-full max-w-md flex-col gap-4"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="name">Name</label>
        <input id="name" name="name" type="text" required className="bg-surface-subtle rounded border px-3 py-2" />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="classId">Class</label>
        <select
          id="classId"
          name="classId"
          required
          value={classId}
          onChange={(e) => handleClassChange(e.target.value)}
          className="bg-surface-subtle rounded border px-3 py-2"
        >
          <option value="" disabled>
            Select a class
          </option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {classSkillOptions.length > 0 && (
        <fieldset className="flex flex-col gap-2 rounded border p-3 text-sm">
          <legend className="px-1 font-medium">Class Skill Talents (choose 2)</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {classSkillOptions.map((s) => (
              <label key={s.id} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  name="classTalentSkillIds"
                  value={s.id}
                  checked={classTalentSkillIds.has(s.id)}
                  disabled={!classTalentSkillIds.has(s.id) && classTalentSkillIds.size >= 2}
                  onChange={() => toggleClassTalent(s.id)}
                />
                {s.name}
              </label>
            ))}
          </div>
          <p className="text-xs text-muted">{classTalentSkillIds.size} / 2 picked</p>
        </fieldset>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="originId">Origin</label>
        <select
          id="originId"
          name="originId"
          required
          value={originId}
          onChange={(e) => handleOriginChange(e.target.value)}
          className="bg-surface-subtle rounded border px-3 py-2"
        >
          <option value="" disabled>
            Select an origin
          </option>
          {origins.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
              {o.lifestyle ? ` (${o.lifestyle})` : ''}
            </option>
          ))}
        </select>
      </div>

      {originGroups.map((group, i) => (
        <fieldset key={i} className="flex flex-col gap-2 rounded border p-3 text-sm">
          <legend className="px-1 font-medium">
            Origin Skill Talents (choose {group.pickCount}
            {originGroups.length > 1 ? ` -- group ${i + 1}` : ''})
          </legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {group.skills.map((s) => (
              <label key={s.id} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  name="originTalentSkillIds"
                  value={s.id}
                  checked={originGroupPicks[i]?.has(s.id) ?? false}
                  disabled={!(originGroupPicks[i]?.has(s.id) ?? false) && (originGroupPicks[i]?.size ?? 0) >= group.pickCount}
                  onChange={() => toggleOriginTalent(i, group.pickCount, s.id)}
                />
                {s.name}
              </label>
            ))}
          </div>
          <p className="text-xs text-muted">
            {originGroupPicks[i]?.size ?? 0} / {group.pickCount} picked
          </p>
        </fieldset>
      ))}

      {variant === 'player' && campaigns.length > 0 && (
        <div className="flex flex-col gap-1">
          <label htmlFor="campaignId">Campaign (optional)</label>
          <select id="campaignId" name="campaignId" defaultValue={defaultCampaignId ?? ''} className="bg-surface-subtle rounded border px-3 py-2">
            <option value="">No campaign</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <fieldset className="flex flex-col gap-2 rounded border p-4">
        <legend className="px-1 font-semibold">
          Stats — {cost} / {POINT_BUY_BUDGET} points used
          {remaining !== 0 && (
            <span className="ml-2 font-normal text-danger">
              ({remaining > 0 ? `${remaining} unspent` : `${-remaining} over budget`})
            </span>
          )}
        </legend>

        <div className="flex flex-wrap gap-2 pb-2">
          {PRESETS.map((values) => (
            <button
              key={values.join('')}
              type="button"
              onClick={() => applyPreset(values)}
              className="rounded border px-2 py-1 text-sm hover:bg-surface-muted"
            >
              {[...values].sort((a, b) => b - a).join('')}
            </button>
          ))}
        </div>

        {STAT_KEYS.map((key) => (
          <div key={key} className="flex items-center justify-between gap-4">
            <label>{STAT_LABELS[key]}</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => adjust(key, -1)}
                disabled={stats[key] <= 1}
                aria-label={`Decrease ${STAT_LABELS[key]}`}
                className="h-7 w-7 rounded border disabled:cursor-not-allowed disabled:opacity-30"
              >
                −
              </button>
              <input type="hidden" name={key} value={stats[key]} />
              <span className="w-4 text-center">{stats[key]}</span>
              <button
                type="button"
                onClick={() => adjust(key, 1)}
                disabled={stats[key] >= 6 || cost + POINT_BUY_COSTS[stats[key] + 1] - POINT_BUY_COSTS[stats[key]] > POINT_BUY_BUDGET}
                aria-label={`Increase ${STAT_LABELS[key]}`}
                className="h-7 w-7 rounded border disabled:cursor-not-allowed disabled:opacity-30"
              >
                +
              </button>
              <span className="w-28 text-sm text-muted">
                mod {statModifier(stats[key]) >= 0 ? '+' : ''}
                {statModifier(stats[key])}, {POINT_BUY_COSTS[stats[key]]} pts
              </span>
            </div>
          </div>
        ))}
      </fieldset>

      <button
        type="submit"
        disabled={remaining !== 0 || !classTalentsSatisfied || !originTalentsSatisfied}
        className="rounded bg-accent px-4 py-2 text-accent-foreground disabled:cursor-not-allowed disabled:opacity-40"
      >
        {variant === 'npc' ? 'Create NPC' : 'Create trainer'}
      </button>
    </form>
  )
}
