'use client'

import { useEffect, useRef, useState } from 'react'

// Dropdown multi-select: a button trigger (label + selected count) that opens a checkbox-list panel,
// so a large option set (e.g. 33 habitats) doesn't permanently eat vertical space the way an always-
// expanded checkbox row did. Closes on outside click, same as any standard dropdown.
//
// [[Improvement - Add filters to Homebrew catalog overview pages]]: extracted out of
// app/(authenticated)/pokedex/PokedexBrowser.tsx (where it was a private, unexported component) once a
// second consumer (the Homebrew Pokédex filter) needed the identical Type/Habitat multi-select shape.
export function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: string[]
  selected: string[]
  onChange: (next: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  function toggle(name: string) {
    onChange(selected.includes(name) ? selected.filter((n) => n !== name) : [...selected, name])
  }

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1">
      <span>{label}</span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`rounded border px-2 py-1 text-left hover:bg-accent/10 ${selected.length > 0 ? 'border-accent bg-accent/10 font-medium text-accent' : 'bg-surface-subtle'}`}
      >
        {selected.length === 0 ? 'Any' : `${selected.length} selected`}
      </button>
      {open && (
        <div className="bg-surface-subtle absolute top-full left-0 z-10 mt-1 flex max-h-64 w-48 flex-col gap-1 overflow-y-auto rounded border border-accent p-2 shadow-md">
          {selected.length > 0 && (
            <button type="button" onClick={() => onChange([])} className="mb-1 self-start text-xs text-accent underline">
              Clear
            </button>
          )}
          {options.map((name) => (
            <label key={name} className="flex items-center gap-1 whitespace-nowrap">
              <input type="checkbox" checked={selected.includes(name)} onChange={() => toggle(name)} />
              {name}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
