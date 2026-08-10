// Shared by the Pokemon-creation form's "Random" Shininess option
// ([[Bug - Improve Wild Pokemon creation and editing]]). This campaign's shiny rate is ~1/250, per
// the user directly -- not the mainline games' 1/4096, and not sourced from the Handbook (no shiny
// odds are defined anywhere in this schema).
const SHINY_RATE = 1 / 250

export function pickRandomShiny(): boolean {
  return Math.random() < SHINY_RATE
}
