'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const SECTIONS = [
  { href: '/campaigns', label: 'Campaigns' },
  { href: '/trainers', label: 'Trainers' },
  { href: '/pokemon', label: 'Pokémon' },
]

// Persistent left-column section nav, separate from the topbar's account-level links (Settings).
// Text-only, no icons -- explicitly decided against adding an icon dependency for this. No
// collapse/hamburger behavior for small viewports, matching this app's existing desktop-first
// convention (confirmed only one file anywhere uses a responsive breakpoint class).
export function Sidebar() {
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
    </aside>
  )
}
