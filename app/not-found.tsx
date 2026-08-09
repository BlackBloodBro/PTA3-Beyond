import Link from 'next/link'
import { StatePage } from '@/components/StatePage'

export default function RootNotFound() {
  return (
    <StatePage
      title="Not found"
      message="That page doesn't exist."
      action={
        <Link href="/" className="rounded bg-accent px-4 py-2 text-sm text-accent-foreground">
          Back home
        </Link>
      }
    />
  )
}
