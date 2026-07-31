-- Prerequisite for importing PokeAPI level-up learnsets: pokedex_moves currently only models
-- "this species can learn this move" with no level, since its existing rows are a small curated
-- list from the Player's Handbook sheet, not a full per-level moveset. level_learned is nullable so
-- those existing rows are unaffected; new learnset rows populate it.
--
-- pokedex_passives gets the same column for the same reason: some PokeAPI level-up "moves" are
-- modeled as Passives in PTA3 instead of Moves (e.g. Growl), so they land here rather than in
-- pokedex_moves, and need the same level-gating.
alter table pokedex_moves add column level_learned int;
alter table pokedex_passives add column level_learned int;
