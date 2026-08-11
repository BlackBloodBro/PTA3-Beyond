'use client'

import { useEffect, useMemo, useState } from 'react'

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const

// items is expected to be a memoized array (from useMemo, recomputed only when a filter/search/sort
// actually changes) -- the effect resets to page 1 whenever its reference changes, so narrowing a
// filter never leaves the view stuck on a page number that no longer matches what's shown.
export function usePagination<T>(items: T[], defaultPageSize: (typeof PAGE_SIZE_OPTIONS)[number] = 25) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(defaultPageSize)

  useEffect(() => {
    setPage(1)
  }, [items])

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const clampedPage = Math.min(page, totalPages)

  const pageItems = useMemo(
    () => items.slice((clampedPage - 1) * pageSize, clampedPage * pageSize),
    [items, clampedPage, pageSize],
  )

  return { page: clampedPage, setPage, pageSize, setPageSize, pageItems, totalPages }
}
