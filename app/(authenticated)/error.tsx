'use client'

import Link from 'next/link'
import { StatePage } from '@/components/StatePage'

// Covers every page under (authenticated) via route-group inheritance -- renders inside the layout's
// Sidebar/header shell, which stays mounted (a segment's error.tsx wraps its children, not its own
// layout.tsx). Does NOT catch throws from (authenticated)/layout.tsx itself -- see the root app/error.tsx
// for that.
export default function AuthenticatedError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <StatePage
      title="Something went wrong"
      message="An unexpected error occurred. You can try again, or head back to the dashboard."
      action={
        <div className="flex gap-3">
          <button type="button" onClick={reset} className="rounded bg-accent px-4 py-2 text-sm text-accent-foreground">
            Try again
          </button>
          <Link href="/dashboard" className="rounded border px-4 py-2 text-sm">
            Dashboard
          </Link>
        </div>
      }
    />
  )
}
