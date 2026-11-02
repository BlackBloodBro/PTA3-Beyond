import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { loadEncounterLiveSnapshot } from '@/lib/pta3/encounterLive'

// [[Bug - Combat encounter page is slow, fails to load, and ejects players]]: the cheap poll target for an
// active Encounter. RLS still decides what this viewer can see -- same client, same session as the page.
// Every failure answers with a plain status code (never a redirect): the client just keeps its last state
// and tries again on the next tick, so a transient hiccup can never eject a player from the fight.
export async function GET(_request: Request, { params }: { params: Promise<{ encounterId: string }> }) {
  const { encounterId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })

  try {
    const snapshot = await loadEncounterLiveSnapshot(supabase, encounterId, user.id)
    if (!snapshot) return NextResponse.json({ error: 'not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } })
    return NextResponse.json(snapshot, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
