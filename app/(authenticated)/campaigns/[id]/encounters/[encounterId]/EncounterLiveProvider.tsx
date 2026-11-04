'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { computeCurrentCombatantId, structureKey, type EncounterLiveSnapshot } from '@/lib/pta3/encounterLive'

// [[Bug - Combat encounter page is slow, fails to load, and ejects players]]: replaces the old
// EncounterLivePoll, which called router.refresh() every 4 s for every viewer -- re-running the entire
// server page (auth + ~20 queries + per-combatant fan-out) each time. Now the page is rendered once, and
// this polls a tiny JSON endpoint for just the live state (HP, initiative, turn, Feature/Move/Item uses):
//  - nothing changed        -> do nothing
//  - only values changed    -> patch them in place through this store (no server re-render)
//  - structure changed      -> ONE full router.refresh() (encounter started/ended, a combatant joined or
//                              left, an enemy was revealed -- all server-rendered identity/layout)
// A failed poll is ignored and retried on the next tick; it never redirects, so a transient error can't
// eject anyone. Polling pauses while the tab is hidden and catches up the moment it's visible again.
// While a fight is quiet the poll backs off (4 s -> 8 s -> 10 s) and snaps back to 4 s on any change, on the
// viewer's own action, on a server re-render, or when the tab becomes visible.
function pollDelayMs(unchangedPolls: number): number {
  if (unchangedPolls < 5) return 4000
  if (unchangedPolls < 15) return 8000
  return 10000
}

type LiveContextValue = {
  snapshot: EncounterLiveSnapshot
  currentCombatantId: string | null
  // Re-read the live state right now -- used after the viewer's own action so they see it immediately.
  pollNow: () => void
  // Show a turn change the viewer just made at once (the action already returned the new position), then
  // confirm it with an immediate poll.
  applyTurnPosition: (position: number) => void
}

const LiveContext = createContext<LiveContextValue | null>(null)

export function useEncounterLive(): LiveContextValue {
  const ctx = useContext(LiveContext)
  if (!ctx) throw new Error('useEncounterLive must be used within EncounterLiveProvider')
  return ctx
}

export function EncounterLiveProvider({
  encounterId,
  initial,
  enabled,
  children,
}: {
  encounterId: string
  initial: EncounterLiveSnapshot
  enabled: boolean
  children: ReactNode
}) {
  const router = useRouter()
  const [snapshot, setSnapshot] = useState(initial)
  const structureRef = useRef(structureKey(initial))
  const inFlight = useRef(false)
  // A pollNow() that arrives while a routine poll is already in flight can't just be dropped -- that poll may
  // have read the state *before* the viewer's own action landed. It re-polls as soon as the running one ends.
  const rerunAfter = useRef(false)
  const pollRef = useRef<() => Promise<void>>(async () => {})
  const snapshotRef = useRef(snapshot)
  snapshotRef.current = snapshot
  const lastJson = useRef(JSON.stringify(initial))
  const unchangedPolls = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const poll = useCallback(async () => {
    if (inFlight.current || document.hidden) return
    inFlight.current = true
    try {
      const res = await fetch(`/api/encounters/${encounterId}/live`, { cache: 'no-store' })
      if (!res.ok) return
      const next = (await res.json()) as EncounterLiveSnapshot
      const nextStructure = structureKey(next)
      if (nextStructure !== structureRef.current) {
        structureRef.current = nextStructure
        unchangedPolls.current = 0
        router.refresh()
        return
      }
      const nextJson = JSON.stringify(next)
      if (nextJson === lastJson.current) {
        unchangedPolls.current += 1
        return
      }
      lastJson.current = nextJson
      unchangedPolls.current = 0
      setSnapshot(next)
    } catch {
      // Network blip: keep the last known state, try again next tick.
    } finally {
      inFlight.current = false
      if (rerunAfter.current) {
        rerunAfter.current = false
        void pollRef.current()
      }
    }
  }, [encounterId, router])
  pollRef.current = poll

  // Self-rescheduling timer rather than setInterval so the gap can change between polls. Nothing is scheduled
  // while the tab is hidden.
  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    if (document.hidden) return
    timer.current = setTimeout(async () => {
      await poll()
      schedule()
    }, pollDelayMs(unchangedPolls.current))
  }, [poll])

  // Re-read right now and go back to the fast rate: the viewer just did something, or the tab just woke up.
  const pollNow = useCallback(() => {
    unchangedPolls.current = 0
    if (inFlight.current) rerunAfter.current = true
    else void poll()
    schedule()
  }, [poll, schedule])

  const applyTurnPosition = useCallback(
    (position: number) => {
      const next = { ...snapshotRef.current, currentTurnPosition: position }
      lastJson.current = JSON.stringify(next)
      setSnapshot(next)
      pollNow()
    },
    [pollNow],
  )

  // A server re-render (router.refresh(), or any of the viewer's own actions) hands down a fresh `initial`
  // -- adopt it so the store never lags behind what the server just rendered, and poll quickly again.
  useEffect(() => {
    setSnapshot(initial)
    lastJson.current = JSON.stringify(initial)
    structureRef.current = structureKey(initial)
    unchangedPolls.current = 0
    if (enabled) schedule()
  }, [initial, enabled, schedule])

  useEffect(() => {
    if (!enabled) return
    schedule()
    const onVisibility = () => {
      if (document.hidden) schedule()
      else pollNow()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = null
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [enabled, schedule, pollNow])

  const currentCombatantId = computeCurrentCombatantId(snapshot.combatants, snapshot.currentTurnPosition, snapshot.status === 'active')

  return <LiveContext.Provider value={{ snapshot, currentCombatantId, pollNow, applyTurnPosition }}>{children}</LiveContext.Provider>
}
