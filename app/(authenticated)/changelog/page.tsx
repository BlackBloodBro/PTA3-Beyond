import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import changelog from '@/content/changelog.json'

// Category labels/order match this vault's own status-note taxonomy (Feature/Improve/Fix). Imported
// directly from content/changelog.json rather than read from disk at request time -- Next.js bundles
// a real code-level import into the build output automatically (same pattern already proven for
// package.json's version on the Settings page), which sidesteps having to also update the
// Dockerfile's COPY list to carry an extra file into the runner stage.
//
// Updating this page is a release-time step, not automated: each time master promotes to production,
// add one entry to content/changelog.json summarizing whichever FR/bug notes moved to Release in that
// batch, as part of the same commit as the version bump (see [[Git Workflow]]).
const CATEGORY_LABELS: Record<string, string> = {
  feature: 'Feature',
  improve: 'Improve',
  fix: 'Fix',
}

const CATEGORY_CLASSES: Record<string, string> = {
  feature: 'text-success',
  improve: 'text-accent',
  fix: 'text-danger',
}

export default async function ChangelogPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-24">
      <div className="w-full max-w-2xl">
        <Link href="/dashboard" className="text-sm underline">
          ← Dashboard
        </Link>
      </div>

      <h1 className="w-full max-w-2xl text-2xl font-bold">Changelog</h1>

      <div className="flex w-full max-w-2xl flex-col gap-8">
        {changelog.map((release) => (
          <section key={release.version}>
            <h2 className="mb-2 font-semibold">
              v{release.version} <span className="font-normal text-muted">— {release.date}</span>
            </h2>
            <ul className="flex flex-col gap-1">
              {release.entries.map((entry, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className={`w-16 shrink-0 font-semibold ${CATEGORY_CLASSES[entry.category] ?? ''}`}>
                    {CATEGORY_LABELS[entry.category] ?? entry.category}
                  </span>
                  <span>{entry.summary}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  )
}
