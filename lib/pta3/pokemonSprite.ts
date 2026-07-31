// pokedex.sprite_code was already populated (PokeAPI-style slugs, e.g. "arcanine-hisuian",
// "basculin-red-striped") during the learnset import -- verified against pokemondb.net directly:
// 349/351 species resolve correctly, the only 2 misses ("Torkoal (Steam)", "Tropius (Ancient)")
// being homebrew-only forms with no real sprite anywhere to link to.
export function pokemonSpriteUrl(spriteCode: string, variant: 'normal' | 'shiny' = 'normal'): string {
  return `https://img.pokemondb.net/sprites/home/${variant}/1x/${spriteCode}.png`
}
