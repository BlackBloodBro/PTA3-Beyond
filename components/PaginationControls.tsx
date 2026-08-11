'use client'

import { PAGE_SIZE_OPTIONS } from '@/lib/pta3/usePagination'

export function PaginationControls({
  page,
  totalPages,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  page: number
  totalPages: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="rounded border border-accent px-2 py-1 text-accent hover:bg-accent/10 disabled:border-border disabled:text-muted disabled:opacity-50 disabled:hover:bg-transparent"
      >
        Prev
      </button>
      <span className="text-muted">
        Page {page} of {totalPages}
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="rounded border border-accent px-2 py-1 text-accent hover:bg-accent/10 disabled:border-border disabled:text-muted disabled:opacity-50 disabled:hover:bg-transparent"
      >
        Next
      </button>
      <label htmlFor="pageSize" className="ml-auto flex items-center gap-1 text-muted">
        Per page
        <select
          id="pageSize"
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="bg-surface-subtle rounded border border-accent px-2 py-1"
        >
          {PAGE_SIZE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
