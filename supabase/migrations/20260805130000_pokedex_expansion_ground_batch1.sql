-- Ground-type (primary type) Pokedex expansion, batch 1 of the 'Fill out the Pokedex more' FR.
-- Sourced from PokeAPI (https://pokeapi.co) per the FR's Design investigation: base stats via
-- round(real_stat / 10) (ties round up, base_hp is the same formula x6), types direct, catch_rate
-- direct copy of capture_rate, egg_hatch_rate = floor(hatch_counter / 2) + ' days', growth_rate
-- name-mapped, sprite_code = PokeAPI's own species slug.
--
-- size_id, weight_id, and description are intentionally left null -- Size/Weight tiers have no
-- reliable PokeAPI derivation (confirmed during Design: same real height can land in different
-- tiers for different species) and description is PDF flavor text neither sourced yet. Proficiencies,
-- Habitats, and Diets for these species are separate follow-up work (no rows inserted into their join
-- tables here) -- all four are genuinely PDF/manual-only per the FR's Design notes.
--
-- COVERAGE: 28 of 41 Ground-type-membership candidates matched (13 excluded because Ground turned out
-- to be their secondary, not primary, type -- Nidoqueen/Nidoking/Clodsire (Poison), Larvitar/Pupitar
-- (Rock), Nincada (Bug), Gastrodon (Water), Gible/Gabite/Garchomp (Dragon), Diggersby (Normal),
-- Sandygast/Palossand (Ghost) -- correctly left for their own primary-type batch instead. Hyphenated
-- PokeAPI slugs (regional forms etc.) were excluded from candidates entirely, matching the original
-- learnset import's precedent of not guessing at form-slug mappings.

insert into pokedex (name, type_1_id, type_2_id, growth_rate_id, base_hp, base_atk, base_def, base_sp_atk, base_sp_def, base_speed, catch_rate, egg_hatch_rate, sprite_code) values
  ('Sandshrew', 12, null, 3, 30, 8, 9, 2, 3, 4, 255, '10 days', 'sandshrew'),
  ('Sandslash', 12, null, 3, 48, 10, 11, 5, 6, 7, 90, '10 days', 'sandslash'),
  ('Diglett', 12, null, 3, 6, 6, 3, 4, 5, 10, 255, '10 days', 'diglett'),
  ('Dugtrio', 12, null, 3, 24, 10, 5, 5, 7, 12, 50, '10 days', 'dugtrio'),
  ('Cubone', 12, null, 3, 30, 5, 10, 4, 5, 4, 190, '10 days', 'cubone'),
  ('Marowak', 12, null, 3, 36, 8, 11, 5, 8, 5, 75, '10 days', 'marowak'),
  ('Phanpy', 12, null, 3, 54, 6, 6, 4, 4, 4, 120, '10 days', 'phanpy'),
  ('Donphan', 12, null, 3, 54, 12, 12, 6, 6, 5, 60, '10 days', 'donphan'),
  ('Trapinch', 12, null, 4, 30, 10, 5, 5, 5, 1, 255, '10 days', 'trapinch'),
  ('Vibrava', 12, 4, 4, 30, 7, 5, 5, 5, 7, 120, '10 days', 'vibrava'),
  ('Flygon', 12, 4, 4, 48, 10, 8, 8, 8, 10, 45, '10 days', 'flygon'),
  ('Groudon', 12, null, 5, 60, 15, 14, 10, 9, 9, 3, '60 days', 'groudon'),
  ('Hippopotas', 12, null, 5, 42, 7, 8, 4, 4, 3, 140, '15 days', 'hippopotas'),
  ('Hippowdon', 12, null, 5, 66, 11, 12, 7, 7, 5, 60, '15 days', 'hippowdon'),
  ('Drilbur', 12, null, 3, 36, 9, 4, 3, 5, 7, 120, '10 days', 'drilbur'),
  ('Excadrill', 12, 18, 3, 66, 14, 6, 5, 7, 9, 60, '10 days', 'excadrill'),
  ('Sandile', 12, 3, 4, 30, 7, 4, 4, 4, 7, 180, '10 days', 'sandile'),
  ('Krokorok', 12, 3, 4, 36, 8, 5, 5, 5, 7, 90, '10 days', 'krokorok'),
  ('Krookodile', 12, 3, 4, 60, 12, 8, 7, 7, 9, 45, '10 days', 'krookodile'),
  ('Stunfisk', 12, 5, 3, 66, 7, 8, 8, 10, 3, 75, '10 days', 'stunfisk'),
  ('Mudbray', 12, null, 3, 42, 10, 7, 5, 6, 5, 190, '10 days', 'mudbray'),
  ('Mudsdale', 12, null, 3, 60, 13, 10, 6, 9, 4, 60, '10 days', 'mudsdale'),
  ('Silicobra', 12, null, 3, 30, 6, 8, 4, 5, 5, 255, '10 days', 'silicobra'),
  ('Sandaconda', 12, null, 3, 42, 11, 13, 7, 7, 7, 120, '10 days', 'sandaconda'),
  ('Runerigus', 12, 10, 3, 36, 10, 15, 5, 11, 3, 90, '12 days', 'runerigus'),
  ('Ursaluna', 12, 14, 3, 78, 14, 11, 5, 8, 5, 75, '10 days', 'ursaluna'),
  ('Toedscool', 12, 11, 4, 24, 4, 4, 5, 10, 7, 190, '10 days', 'toedscool'),
  ('Toedscruel', 12, 11, 4, 48, 7, 7, 8, 12, 10, 90, '10 days', 'toedscruel')
on conflict (name) do nothing;
