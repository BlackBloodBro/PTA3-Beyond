'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// [[Improvement - Live-update the active Encounter page for all viewers]]: polling, not Realtime -- see
// the FR's own Design notes for the tradeoff. While the Encounter is active, silently re-fetch this
// page's server data every few seconds so every open viewer sees HP/combatant/turn changes made
// elsewhere without a manual reload. Renders nothing -- router.refresh() re-runs the page's own data
// fetch in place, which is enough since everything this page shows (effective stats, down-state, sorted
// turn order) is already server-computed; no client-side state to reconcile. React only applies
// `defaultValue` once per mounted element, so this doesn't clobber an in-progress, not-yet-submitted
// edit in an uncontrolled input (e.g. a not-yet-Set Initiative box) as long as that combatant stays in
// the list -- only a genuinely new/removed row remounts.
const POLL_INTERVAL_MS = 4000

export function EncounterLivePoll() {
  const router = useRouter()

  useEffect(() => {
    const id = setInterval(() => router.refresh(), POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [router])

  return null
}
