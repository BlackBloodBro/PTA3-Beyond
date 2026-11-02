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
const POLL_INTERVAL_MS = 4000

type LiveContextValue = {
  snapshot: EncounterLiveSnapshot
  currentCombatantId: string | null
  // Re-read the live state right now -- used after the viewer's own action so they see it immediately.
  pollNow: () => void
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

  // A server re-render (router.refresh(), or any of the viewer's own actions) hands down a fresh `initial`
  // -- adopt it so the store never lags behind what the server just rendered.
  useEffect(() => {
    setSnapshot(initial)
    structureRef.current = structureKey(initial)
  }, [initial])

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
        router.refresh()
        return
      }
      setSnapshot((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next))
    } catch {
      // Network blip: keep the last known state, try again next tick.
    } finally {
      inFlight.current = false
    }
  }, [encounterId, router])

  useEffect(() => {
    if (!enabled) return
    const id = setInterval(poll, POLL_INTERVAL_MS)
    const onVisible = () => {
      if (!document.hidden) poll()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [enabled, poll])

  const currentCombatantId = computeCurrentCombatantId(snapshot.combatants, snapshot.currentTurnPosition, snapshot.status === 'active')

  return <LiveContext.Provider value={{ snapshot, currentCombatantId, pollNow: poll }}>{children}</LiveContext.Provider>
}
