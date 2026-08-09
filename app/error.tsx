'use client'

import Link from 'next/link'
import { StatePage } from '@/components/StatePage'

// Catches throws from (authenticated)/layout.tsx's own fetches (auth check, theme, bookmarks) and
// anything from /, /login, /signup -- a same-segment error.tsx can't catch its own layout's throws,
// only the parent boundary can. Renders through the plain root <html>/<body> (no data-theme/data-accent
// attributes are set outside (authenticated)/layout.tsx), so this is dark-styled by default, same as
// /login and /signup already render today.
export default function RootError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <StatePage
      title="Something went wrong"
      message="An unexpected error occurred."
      action={
        <div className="flex gap-3">
          <button type="button" onClick={reset} className="rounded bg-accent px-4 py-2 text-sm text-accent-foreground">
            Try again
          </button>
          <Link href="/" className="rounded border px-4 py-2 text-sm">
            Home
          </Link>
        </div>
      }
    />
  )
}
