-- Fix for [[Bug - Real Pokemon abilities are seeded as Stat Passives instead of Ability Passives]]:
-- 19 real Pokemon abilities were seeded with passive_type = 'stat' -- the manually-chosen, max-3-slot
-- kind -- when they should be passive_type = 'ability' (auto-derived from species+level, free,
-- no slot cost). User-verified against the Player's Handbook (2026-08-31); the other ~9 candidates
-- considered (Gooey, Gorilla tactics, Huge power, Intimidate, Moxie, Run away, Speed boost, Stamina,
-- Super luck) are correctly Stat Passives as-is and are untouched.
--
-- Reclassifies passive_type to 'ability', context to 'combat' (matching every existing ability row),
-- and category to null (categories are a stat-passive-only concept, used for the one-per-category
-- cap). No pokedex_passives changes needed -- that table already links the right species to these
-- passives via level_learned; flipping passive_type alone moves them from the manually-learnable
-- Stat Passive list to the auto-derived Ability Passive list for free. Confirmed live beforehand: all
-- 38 pokedex_passives rows for these 19 ids already have level_learned = null (none were part of the
-- original 351's leveled migration), consistent with every other genuine ability-type row.
--
-- Also deletes any pokemon_passives rows for these 19 ids, so a player who'd already spent one of
-- their 3 Stat Passive slots on one of these gets that slot back instead of being left holding an
-- orphaned row. Confirmed live beforehand: 0 such rows exist today, so this is a no-op now, kept for
-- correctness going forward.

delete from pokemon_passives where passive_id in (
  384, 385, 386, 387, 388, 389, 390, 391, 392, 393, 394, 396, 397, 398, 399, 400, 401, 402, 403
);

update passives
set passive_type = 'ability', context = 'combat', category = null
where id in (
  384, 385, 386, 387, 388, 389, 390, 391, 392, 393, 394, 396, 397, 398, 399, 400, 401, 402, 403
);
