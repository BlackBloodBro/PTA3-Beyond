'use client'

import { Fragment } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { SidebarBookmark } from '@/lib/pta3/bookmarks'

const SECTIONS = [
  { href: '/campaigns', label: 'Campaigns' },
  { href: '/trainers', label: 'Trainers' },
  { href: '/pokemon', label: 'Pokémon' },
  { href: '/pokedex', label: 'Pokédex' },
]

// Persistent left-column section nav, separate from the topbar's account-level links (Settings).
// Text-only, no icons -- explicitly decided against adding an icon dependency for this. No
// collapse/hamburger behavior for small viewports, matching this app's existing desktop-first
// convention (confirmed only one file anywhere uses a responsive breakpoint class).
export function Sidebar({ bookmarks }: { bookmarks: SidebarBookmark[] }) {
  const pathname = usePathname()

  return (
    <aside className="w-48 shrink-0 border-r p-3">
      <nav className="flex flex-col gap-1">
        {SECTIONS.map((section) => {
          const isActive = pathname === section.href || pathname.startsWith(`${section.href}/`)
          return (
            <Link
              key={section.href}
              href={section.href}
              className={`rounded px-3 py-2 text-sm ${isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-surface-subtle'}`}
            >
              {section.label}
            </Link>
          )
        })}
      </nav>

      {/* Hidden entirely with zero bookmarks -- costs nothing visually for anyone who doesn't use
          the feature. A separate, dedicated section rather than nested under Campaigns/Trainers/
          Pokémon -- a bookmark's whole point is jumping to a page while browsing somewhere else
          entirely, which a per-entity-type nesting wouldn't meaningfully save clicks over. Open by
          default (not collapsed) since that's the direct point of the feature, but still
          collapsible for anyone who wants it out of the way. */}
      {bookmarks.length > 0 && (
        <details open className="mt-3 border-t pt-3">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted">Bookmarks</summary>
          <nav className="mt-2 flex flex-col gap-1">
            {bookmarks.map((bookmark, i) => {
              const isActive = pathname === bookmark.href
              // Bookmarks are already grouped by entityType (Campaigns/Trainers/Pokémon, see
              // loadBookmarksForSidebar) -- a divider marks each boundary between groups.
              const showDivider = i > 0 && bookmarks[i - 1].entityType !== bookmark.entityType
              return (
                <Fragment key={bookmark.id}>
                  {showDivider && <hr className="my-1" />}
                  <Link
                    href={bookmark.href}
                    title={bookmark.label}
                    className={`truncate rounded px-3 py-1.5 text-xs ${isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-surface-subtle'}`}
                  >
                    {bookmark.label}
                  </Link>
                </Fragment>
              )
            })}
          </nav>
        </details>
      )}
    </aside>
  )
}
