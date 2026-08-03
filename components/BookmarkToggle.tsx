'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toggleBookmark, type BookmarkEntityType } from '@/app/(authenticated)/bookmarks/actions'

// Star toggle for the Add Bookmarks feature -- plain Unicode glyphs (★/☆) rather than an icon
// dependency, matching this app's existing "no icon library" convention.
export function BookmarkToggle({
  entityType,
  entityId,
  initialBookmarked,
}: {
  entityType: BookmarkEntityType
  entityId: string
  initialBookmarked: boolean
}) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked)
  const [pending, setPending] = useState(false)
  const router = useRouter()

  async function handleClick() {
    setPending(true)
    const result = await toggleBookmark(entityType, entityId)
    setPending(false)
    if ('error' in result) {
      return
    }
    setBookmarked(result.bookmarked)
    // The Sidebar's Bookmarks section is fetched in the (authenticated) layout, which Next.js
    // doesn't re-run on a plain client-side navigation -- without this, a newly (un)bookmarked
    // entity wouldn't show up/disappear from the Sidebar until a hard reload.
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-label={bookmarked ? 'Remove bookmark' : 'Add bookmark'}
      title={bookmarked ? 'Remove bookmark' : 'Add bookmark'}
      className={`text-xl leading-none disabled:opacity-50 ${bookmarked ? 'text-warning' : 'text-muted hover:text-foreground'}`}
    >
      {bookmarked ? '★' : '☆'}
    </button>
  )
}
