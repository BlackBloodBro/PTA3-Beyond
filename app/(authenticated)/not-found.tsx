import Link from 'next/link'
import { StatePage } from '@/components/StatePage'

// Catches all of this app's existing notFound() route-guard calls (campaign/trainer mismatches etc.)
// -- renders inside the Sidebar/header shell, unlike the root not-found.tsx.
export default function AuthenticatedNotFound() {
  return (
    <StatePage
      title="Not found"
      message="That page doesn't exist, or you don't have access to it."
      action={
        <Link href="/dashboard" className="rounded bg-accent px-4 py-2 text-sm text-accent-foreground">
          Back to Dashboard
        </Link>
      }
    />
  )
}
