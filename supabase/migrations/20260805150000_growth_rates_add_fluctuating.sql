-- Adds the 6th real growth-rate tier ("Fluctuating", PokeAPI's fast-then-very-slow), missing from
-- the original 5-row seed since no already-imported species needed it. Surfaced by the Pokedex
-- expansion batches (Fighting/Poison/Bug/Ghost/Water/Grass all include species with this growth
-- rate) -- added as a real row rather than folding those species into a neighboring tier, per the
-- FR's Design notes.
--
-- exp_modifier is an ESTIMATE, not sourced from the PDF -- flagging rather than blocking, matching
-- this batch's practice of leaving genuinely-unsourced fields visibly incomplete instead of guessing
-- silently. The other 5 rows' modifiers don't cleanly reduce to a single formula against real
-- Pokemon's total-exp-to-level-100 figures (Erratic 600k/Fast 800k/Medium Fast 1M/Medium Slow
-- 1.06M/Slow 1.25M -> stored 1.5/1.2/1/0.85/0.75 -- close to but not exactly 1M/total), so there's no
-- exact formula to extend. Real Fluctuating needs 1.64M exp (the slowest of all 6, even slower than
-- Slow) -- 0.6 sits appropriately below Slow's 0.75, calibrated loosely against that same ratio
-- pattern. Revisit once the real PDF value is available.
insert into growth_rates (name, exp_modifier) values
  ('Fluctuating', 0.6)
on conflict (name) do nothing;
