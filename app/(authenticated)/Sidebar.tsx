'use client'

import { Fragment, useState } from 'react'
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
// The two campaign-scoped list pages that actually exist as their own routes
// (app/(authenticated)/campaigns/[id]/npcs and .../wild-pokemon) -- player Trainers have no
// equivalent list route of their own (the roster lives on the Campaign page itself, which the
// bookmark's own Link already goes to), so there's no third shortcut to add here.
const CAMPAIGN_SHORTCUTS = [
  { path: 'npcs', label: 'NPCs' },
  { path: 'wild-pokemon', label: 'Wild Pokémon' },
]

export function Sidebar({ bookmarks }: { bookmarks: SidebarBookmark[] }) {
  const pathname = usePathname()
  // [[Add Campaign Trainers and Pokemon to the sidebar]]: which bookmarked Campaigns have their
  // NPCs/Wild Pokémon shortcuts expanded -- keyed by the Campaign's own entityId, not the bookmark
  // row's id, so it stays keyed the same way even if the bookmark itself were ever removed/re-added.
  const [expandedCampaignIds, setExpandedCampaignIds] = useState<Set<string>>(new Set())

  function toggleCampaign(campaignId: string) {
    setExpandedCampaignIds((prev) => {
      const next = new Set(prev)
      if (next.has(campaignId)) {
        next.delete(campaignId)
      } else {
        next.add(campaignId)
      }
      return next
    })
  }

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

              if (bookmark.entityType !== 'campaign') {
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
              }

              // A bookmarked Campaign additionally gets a fold toggle revealing shortcuts straight
              // to its NPCs and Wild Pokémon lists -- [[Add Campaign Trainers and Pokemon to the
              // sidebar]]. The toggle and the Link are separate controls in the same row: the Link
              // still just navigates to the Campaign page like any other bookmark, the toggle
              // (▸/▾) only expands/collapses the shortcuts below it.
              const isExpanded = expandedCampaignIds.has(bookmark.entityId)
              return (
                <Fragment key={bookmark.id}>
                  {showDivider && <hr className="my-1" />}
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => toggleCampaign(bookmark.entityId)}
                      className="shrink-0 rounded px-1 py-1.5 text-xs text-muted hover:bg-surface-subtle"
                      aria-expanded={isExpanded}
                      aria-label={isExpanded ? `Collapse ${bookmark.label} shortcuts` : `Expand ${bookmark.label} shortcuts`}
                    >
                      {isExpanded ? '▾' : '▸'}
                    </button>
                    <Link
                      href={bookmark.href}
                      title={bookmark.label}
                      className={`min-w-0 flex-1 truncate rounded px-2 py-1.5 text-xs ${isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-surface-subtle'}`}
                    >
                      {bookmark.label}
                    </Link>
                  </div>
                  {isExpanded && (
                    <nav className="ml-5 flex flex-col gap-0.5">
                      {CAMPAIGN_SHORTCUTS.map((shortcut) => {
                        const shortcutHref = `/campaigns/${bookmark.entityId}/${shortcut.path}`
                        const shortcutIsActive = pathname === shortcutHref || pathname.startsWith(`${shortcutHref}/`)
                        return (
                          <Link
                            key={shortcut.path}
                            href={shortcutHref}
                            className={`truncate rounded px-2 py-1 text-xs ${shortcutIsActive ? 'bg-accent text-accent-foreground' : 'hover:bg-surface-subtle'}`}
                          >
                            {shortcut.label}
                          </Link>
                        )
                      })}
                    </nav>
                  )}
                </Fragment>
              )
            })}
          </nav>
        </details>
      )}
    </aside>
  )
}
