'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { getCombatantDetail, type CombatantDetail } from './combatantDetailActions'

// [[Feature - Show more Pokemon and trainer information in Encounters]]: replaces the combatant name's
// old plain navigate-away link with a clickable trigger that opens an in-page overlay instead --
// resolved with the user (2026-09-15) after weighing it against an inline "section underneath the
// others" alternative: the overlay avoids a spatial disconnect (the combatant list lives in the
// sidebar; an inline section would land at the bottom of the main column, away from where the click
// happened) and fits the "quick peek mid-decision, then back to what I was doing" way this info is
// actually used. This is genuinely new UI for this codebase -- no other modal/overlay exists anywhere
// else in the app today. `href` (from the page's own existing combatantHref) is kept as a "View full
// page" link inside the overlay -- this is a read-only summary, not a replacement for the real page
// when something actually needs editing (held item, Bag contents, etc).
export function CombatantDetailModal({ combatantId, label, href }: { combatantId: string; label: string; href: string | null }) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState<CombatantDetail | null>(null)

  useEffect(() => {
    if (!isOpen) return
    document.body.style.overflow = 'hidden'
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  async function handleOpen() {
    setIsOpen(true)
    if (detail) return // Already fetched from a previous open this session -- no need to refetch every time.
    setLoading(true)
    const result = await getCombatantDetail(combatantId)
    setLoading(false)
    setDetail(result)
  }

  return (
    <>
      <button type="button" onClick={handleOpen} className="font-semibold underline">
        {label}
      </button>

      {isOpen &&
        createPortal(
          // Portalled to document.body rather than rendered in place -- the trigger button above lives
          // inside a <p> in page.tsx's own combatant-card markup (a Trainer/Pokemon's name line), and
          // this dialog's block-level content (h3/div/p/ul) would otherwise nest INSIDE that <p>, which
          // is invalid HTML and throws real hydration errors ("<p> cannot contain a nested <div>", etc,
          // confirmed live in the console) -- not just a cosmetic concern.
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setIsOpen(false)}
            role="presentation"
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label={label}
              onClick={(e) => e.stopPropagation()}
              className="bg-background flex max-h-[85vh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded border p-4 text-sm shadow-lg"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-base font-semibold">{label}</h3>
                <button type="button" onClick={() => setIsOpen(false)} className="text-muted shrink-0 text-lg leading-none" aria-label="Close">
                  ×
                </button>
              </div>

              {loading && <p className="text-muted text-xs">Loading…</p>}
              {!loading && detail && <CombatantDetailBody detail={detail} />}

              {href && (
                <Link href={href} className="text-xs underline">
                  View full page →
                </Link>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}

function CombatantDetailBody({ detail }: { detail: CombatantDetail }) {
  if ('error' in detail) {
    return <p className="text-danger text-xs">{detail.error}</p>
  }

  if (detail.kind === 'pokemon' && !detail.identified) {
    return <p className="text-muted text-xs">Not yet identified -- use the Pokédex to reveal this Pokémon's information.</p>
  }

  return (
    <div className="flex flex-col gap-3">
      {detail.kind === 'pokemon' && (
        <p className="text-muted text-xs">
          {detail.types.length > 0 ? detail.types.join(' / ') : 'No type'}
          {detail.ability ? ` · Ability: ${detail.ability}` : ''} · Held item: {detail.heldItem ?? 'None'}
        </p>
      )}
      {detail.kind === 'trainer' && detail.className && <p className="text-muted text-xs">Class: {detail.className}</p>}

      <div>
        <p className="text-muted text-xs font-semibold">Stats</p>
        <ul className="grid grid-cols-2 gap-x-3 gap-y-0.5">
          {detail.stats.map((s) => (
            <li key={s.label} className="flex justify-between">
              <span>{s.label}</span>
              <span className="font-semibold">{s.value}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="text-muted text-xs font-semibold">Moves</p>
        {detail.moves.length === 0 ? <p className="text-muted text-xs">None known.</p> : <p className="text-xs">{detail.moves.join(', ')}</p>}
      </div>

      {detail.kind === 'trainer' && (
        <>
          <div>
            <p className="text-muted text-xs font-semibold">Features</p>
            {detail.features.length === 0 ? (
              <p className="text-muted text-xs">None.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {detail.features.map((f) => (
                  <li key={f.id}>
                    <span className="font-medium">{f.name}</span>
                    <p className="text-muted text-xs">{f.description}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <p className="text-muted text-xs font-semibold">Bag</p>
            {detail.items.length === 0 ? (
              <p className="text-muted text-xs">Empty.</p>
            ) : (
              <p className="text-xs">{detail.items.map((i) => `${i.name} ×${i.quantity}`).join(', ')}</p>
            )}
          </div>
        </>
      )}

      {detail.kind === 'pokemon' && (
        <div>
          <p className="text-muted text-xs font-semibold">Afflictions</p>
          {detail.afflictions.length === 0 ? (
            <p className="text-muted text-xs">None.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {detail.afflictions.map((a) => (
                <li key={a.name}>
                  <span className="font-medium">{a.name}</span>
                  <p className="text-muted text-xs">{a.description}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
