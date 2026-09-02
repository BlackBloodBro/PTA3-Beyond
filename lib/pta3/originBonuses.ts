// [[Origin - Raring to go has additional feature]]: this Origin's flavor text ("Choose one stat and
// raise it by 1. When you get to level 3, 7, and 11, you may take one additional Skill Talent from
// your new class.") is the only Origin whose bonus maps onto a system this app already tracks
// (base stats, Skill Talent picks) -- every other Origin's "roll with advantage on X checks" is a
// narrative/GM-adjudicated mechanic with no dice-rolling/skill-check system to hook into (confirmed
// via a full audit of all 15 Origins). Matched by name (lowercased, matching this codebase's
// established ADVANCED_CLASS_MILESTONE_NAME precedent) rather than a dedicated boolean column, since
// this is the only Origin that needs any special-casing at all.
const RARING_TO_GO_NAME = 'raring to go'

export function isRaringToGoOrigin(originName: string | null | undefined): boolean {
  return (originName ?? '').toLowerCase() === RARING_TO_GO_NAME
}

// The levels at which Raring to go grants one additional Skill Talent pick, on top of whatever the
// Class/Subclass milestone itself already grants at that same level -- these are exactly the levels
// a new Advanced Class is ever granted (see ADVANCED_CLASS_MILESTONE_NAME's own trigger levels), so
// "your new class" in the flavor text is that same milestone's own Advanced Class, not the base Class.
export const RARING_TO_GO_BONUS_TALENT_LEVELS = [3, 7, 11]
