'use client'

import { useState } from 'react'
import { pokemonSpriteUrl } from '@/lib/pta3/pokemonSprite'

// Client component only because of the onError fallback -- 2 of 351 sprite_code values (both
// homebrew-only forms with no real-world sprite: "Torkoal (Steam)", "Tropius (Ancient)") 404
// against pokemondb, and that can only be detected once the browser actually tries to load it.
export function PokemonSprite({
  spriteCode,
  shiny,
  alt,
  size = 64,
  className,
}: {
  spriteCode: string
  shiny?: boolean
  alt: string
  size?: number
  className?: string
}) {
  const [errored, setErrored] = useState(false)

  if (errored) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`flex shrink-0 items-center justify-center rounded bg-neutral-100 text-[10px] text-neutral-400 ${className ?? ''}`}
      >
        No image
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- external, unoptimized sprite host
    <img
      src={pokemonSpriteUrl(spriteCode, shiny ? 'shiny' : 'normal')}
      alt={alt}
      width={size}
      height={size}
      className={`shrink-0 object-contain ${className ?? ''}`}
      onError={() => setErrored(true)}
    />
  )
}
