// Bug fix (2026-09-14): confirmed live -- a pooled Supabase connection that lands in a bad state
// (concretely observed: Postgres "current transaction is aborted, commands ignored until end of
// transaction block", firing on dozens of consecutive requests in a row before self-clearing) fails
// every query run on it, with no way for this app to force the pool to cycle it out. This is the actual
// root cause behind real players getting kicked out of an active Encounter -- confirmed via the dev
// server's own request log during a real live game, correlating with the user's own report of it
// happening both when joining an encounter and when a poll picked up a GM's turn advance.
//
// Only Postgrest's own PGRST116 ("no matching row") is a genuine not-found. Any other error gets one
// retry -- a fresh request from this same client is very likely to land on a *different* pooled
// connection, since the pool hands out connections round-robin/least-recently-used rather than pinning
// one client to one broken connection forever (consistent with what the log showed: the error cleared
// on its own after enough requests cycled through).
export async function singleWithRetry<Fn extends () => PromiseLike<{ error: { code?: string } | null }>>(
  query: Fn,
): Promise<Awaited<ReturnType<Fn>>> {
  const first = await query()
  if (first.error && first.error.code !== 'PGRST116') {
    return query() as Promise<Awaited<ReturnType<Fn>>>
  }
  return first as Awaited<ReturnType<Fn>>
}
