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
}: {
  species: { name: string; sprite_code: string }[]
  name?: string
  label?: string
}) {
  const [selectedName, setSelectedName] = useState(species[0]?.name ?? '')
  const selected = species.find((s) => s.name === selectedName)

  if (species.length === 0) {
    return <p className="text-sm text-neutral-500">No species match the current filters.</p>
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name}>{label}</label>
      <div className="flex items-center gap-3">
        {selected ? (
          <PokemonSprite key={selected.sprite_code} spriteCode={selected.sprite_code} alt={selected.name} size={64} />
        ) : (
          <div style={{ width: 64, height: 64 }} className="shrink-0 rounded bg-neutral-100" />
        )}
        <select
          id={name}
          name={name}
          required
          value={selectedName}
          onChange={(e) => setSelectedName(e.target.value)}
          className="flex-1 rounded border px-3 py-2"
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
