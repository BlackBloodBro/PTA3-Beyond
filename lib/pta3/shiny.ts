// Shared by the Pokemon-creation form's "Random" Shininess option
// ([[Bug - Improve Wild Pokemon creation and editing]]). The rate is a GM-tunable "1 in N" denominator
// ([[Feature - Let a GM customize their Campaign's shiny rate]]) resolved via
// lib/pta3/shinyRateSettings.ts -- not the mainline games' 1/4096, and not sourced from the Handbook (no
// shiny odds are defined anywhere in this schema).
export function pickRandomShiny(denominator: number): boolean {
  return Math.random() < 1 / denominator
}
