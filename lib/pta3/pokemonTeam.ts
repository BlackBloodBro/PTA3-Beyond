// No in-schema source for a configurable team cap (no Feature/Item raises it, no per-class
// variance) -- 6 is simply the standard team size, same as the main games. Shared here so the
// Trainer page, the PC page, and the actions that assign into a slot can't drift out of sync.
export const MAX_TEAM_SIZE = 6

// Lowest slot in 1..MAX_TEAM_SIZE not present in usedSlots, or null if the Team is full.
export function findNextOpenSlot(usedSlots: (number | null)[]): number | null {
  const used = new Set(usedSlots.filter((s): s is number => s !== null))
  for (let slot = 1; slot <= MAX_TEAM_SIZE; slot++) {
    if (!used.has(slot)) return slot
  }
  return null
}
