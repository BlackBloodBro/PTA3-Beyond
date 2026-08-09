// Fires automatically on every navigation into or between authenticated pages while that page's async
// Server Component data-fetches -- covers all of them via route-group inheritance, no per-route files.
export default function AuthenticatedLoading() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-24">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      <p className="text-sm text-muted">Loading…</p>
    </main>
  )
}
