'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// Native `title` only shows on hover (and not reliably on touch), which is why the damage
// breakdown wasn't visible to the user at all -- this swaps it for a click-to-toggle popover, the
// one other client component on this page besides PokemonSprite/SpeciesPicker (again, needed
// because "open on click" has no non-JS equivalent, unlike everything else on this page).
//
// Rendered through a portal into document.body rather than as a normal absolutely-positioned
// child: the Stats table sits inside an `overflow-x-auto` wrapper, and per the CSS spec, setting
// overflow-x without also setting overflow-y forces the browser to compute overflow-y as `auto`
// too -- so a tooltip positioned as a normal descendant was getting silently clipped by that
// wrapper's own scroll box. Portaling to <body> with `position: fixed` (viewport coordinates from
// getBoundingClientRect, which is exactly what `fixed` positions against) sidesteps any ancestor's
// overflow/stacking context entirely, which is what "show on top of the page" actually requires.
export function ClickTooltip({ label, tooltip }: { label: string; tooltip: string }) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleOutsideClick(e: MouseEvent) {
      const target = e.target as Node
      if (buttonRef.current?.contains(target) || tooltipRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [open])

  function handleToggle() {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setPosition({ top: rect.bottom + 4, left: rect.left })
    }
    setOpen((o) => !o)
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className="cursor-pointer underline decoration-dotted underline-offset-2"
      >
        {label}
      </button>
      {open &&
        position &&
        createPortal(
          <div
            ref={tooltipRef}
            style={{ position: 'fixed', top: position.top, left: position.left }}
            className="z-50 w-64 whitespace-pre-line rounded border border-neutral-700 bg-neutral-900 p-2 text-xs text-white shadow-lg"
          >
            {tooltip}
          </div>,
          document.body,
        )}
    </>
  )
}
