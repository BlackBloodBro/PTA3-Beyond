'use client'

import { useState } from 'react'
import { PokemonSprite } from './PokemonSprite'

// Replaces the old free-text "type the species name" input (backed by a <datalist>) with an
// actual select-from-a-list control, plus a live sprite preview of whichever species is currently
// highlighted -- a <select>'s own <option>s can't embed images, so the preview has to be driven by
// onChange in a client component; the dropdown itself still submits by name exactly like the old
// text input did, so no Server Action changed.
export function SpeciesPicker({
  species,
  name = 'species',
  label = 'Species',
  value,
  onChange,
}: {
  species: { name: string; sprite_code: string }[]
  name?: string
  label?: string
  // Optional controlled mode -- the Pokemon-creation form rebuild ([[Bug - Improve Wild Pokemon
  // creation and editing]]) needs to know which species is selected (to load its learnset/growth
  // rate for the Moves/Passives/EXP panels), so it lifts this state up instead of letting the
  // picker own it. Omitting both keeps the original uncontrolled behavior (starter-Pokemon flow's
  // plain <form action> submission, which only reads the value at submit time).
  value?: string
  onChange?: (name: string) => void
}) {
  const [internalName, setInternalName] = useState(species[0]?.name ?? '')
  const selectedName = value ?? internalName
  const selected = species.find((s) => s.name === selectedName)

  if (species.length === 0) {
    return <p className="text-sm text-muted">No species match the current filters.</p>
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name}>{label}</label>
      <div className="flex items-center gap-3">
        {selected ? (
          <PokemonSprite key={selected.sprite_code} spriteCode={selected.sprite_code} alt={selected.name} size={64} />
        ) : (
          <div style={{ width: 64, height: 64 }} className="shrink-0 rounded bg-surface-muted" />
        )}
        <select
          id={name}
          name={name}
          required
          value={selectedName}
          onChange={(e) => (onChange ? onChange(e.target.value) : setInternalName(e.target.value))}
          className="bg-surface-subtle flex-1 rounded border px-3 py-2"
        >
          {species.map((s) => (
            <option key={s.name} value={s.name}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
