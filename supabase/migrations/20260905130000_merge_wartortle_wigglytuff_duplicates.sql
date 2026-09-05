-- [[Bug - Wartortle and Wigglytuff have duplicate pokedex rows under misspelled names]]
--
-- id 409 "Wartorle" and id 1088 "Wartortle" are the same species, split across two import
-- passes (409 from the original 351-species import, 1088 from the later expansion import),
-- neither aware of the other. Same story for 595 "Wiggytuff" / 774 "Wigglytuff". Confirmed via
-- the live DB: zero `pokemon`/`trainers_items`/`pokemon_eggs` rows reference any of the 4 ids,
-- and `evolution_triggers` only references the correctly-spelled rows already -- so nothing
-- needs repointing, just a merge-then-delete.
--
-- The two rows aren't simple duplicates: base stats/type/size/weight/growth_rate/catch_rate
-- match exactly (confirming same species), but moves/passives/habitat diverge -- each side is
-- missing data the other has, not conflicting on anything they share. Verified against
-- PTA3Pokedex.pdf and each row's `level_learned` provenance (null = hand-curated pre-PokeAPI-
-- import data, non-null = merged in by the 2026-07-26 PokeAPI learnset import, which explicitly
-- skipped "Wartorle"/"Wiggytuff" by name):
--   - 409 has passives 582/614/636 (hand-curated) that 1088 never received.
--   - 409 has habitat Ponds (36) matching the PDF's "Lakes / Ponds"; 1088 is missing it.
--   - 595 has moves 443/603 and passives 388/426/447/622 (hand-curated) that 774 never received.
-- So this merges the misspelled row's unique data onto the correctly-spelled row first, then
-- deletes the misspelled rows -- cascade removes their now-redundant junction rows.

insert into pokedex_passives (pokedex_id, passive_id, level_learned) values
  (1088, 582, null),
  (1088, 614, null),
  (1088, 636, null),
  (774, 388, null),
  (774, 426, null),
  (774, 447, null),
  (774, 622, null);

insert into pokedex_moves (pokedex_id, move_id, level_learned) values
  (774, 443, null),
  (774, 603, null);

insert into pokedex_habitats (pokedex_id, habitat_id) values
  (1088, 36);

delete from pokedex where id in (409, 595);
