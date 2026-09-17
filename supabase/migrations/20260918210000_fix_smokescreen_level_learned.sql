-- Follow-up to 20260918200000_fix_pokedex_moves_level_learned.sql: that pass missed 13 "Smoke screen"
-- rows because PokeAPI's real move slug is "smokescreen" (one word), not "smoke-screen" -- the
-- generic slugifier's hyphenation broke the lookup silently. Re-run with the corrected slug against
-- the same [confirmed] cross-version-discrepancy rule (same move at level > 1 in one game version and
-- level 1 in another, for the same species -- corrected to the minimum level > 1 seen).
--
-- 5 of the 13 had no evidence of a problem and are left untouched: Carkol/Centiskorch/Coalossal are
-- evolved forms with Smoke Screen flat at level 1 in every game (legitimate evolution-carryover, same
-- exclusion as the main fix); Rolycoly/Sizzlipede are base forms but the move's typical level among
-- other species that know it is exactly 10, which doesn't clear the ">10" threshold either rule uses.
update pokedex_moves set level_learned = 9 where pokedex_id = 382 and move_id = 494; -- Charizard: 1 -> 9 (versions saw: 1,9,10,13,20)
update pokedex_moves set level_learned = 9 where pokedex_id = 381 and move_id = 494; -- Charmeleon: 1 -> 9 (versions saw: 1,9,10,13,20)
update pokedex_moves set level_learned = 4 where pokedex_id = 636 and move_id = 494; -- Kingdra: 1 -> 4 (versions saw: 1,4,5,8)
update pokedex_moves set level_learned = 8 where pokedex_id = 501 and move_id = 494; -- Magmar: 1 -> 8 (versions saw: 1,8,10,11,25,48)
update pokedex_moves set level_learned = 8 where pokedex_id = 502 and move_id = 494; -- Magmortar: 1 -> 8 (versions saw: 1,8,10,11)
update pokedex_moves set level_learned = 4 where pokedex_id = 384 and move_id = 494; -- Quilava: 1 -> 4 (versions saw: 1,4,6)
update pokedex_moves set level_learned = 4 where pokedex_id = 635 and move_id = 494; -- Seadra: 1 -> 4 (versions saw: 1,4,5,6,8,19)
update pokedex_moves set level_learned = 4 where pokedex_id = 385 and move_id = 494; -- Typhlosion: 1 -> 4 (versions saw: 1,4,6)
