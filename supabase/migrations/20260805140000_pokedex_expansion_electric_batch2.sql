-- Electric-type (primary type) Pokedex expansion, batch 2 of the 'Fill out the Pokedex more' FR.
-- Same sourcing/methodology as batch 1 (20260805130000, Ground) -- see that migration's header and
-- the README's 'Pokedex expansion' section for the full formula writeup.
--
-- size_id, weight_id, description left null; Proficiencies/Habitats/Diets get no rows -- same reason
-- as batch 1 (no reliable PokeAPI derivation, confirmed during Design).
--
-- COVERAGE: 36 of 39 Electric-type-membership candidates matched. 3 excluded because Electric turned
-- out to be their secondary, not primary, type: Joltik (Bug), Galvantula (Bug), Zekrom (Dragon).

insert into pokedex (name, type_1_id, type_2_id, growth_rate_id, base_hp, base_atk, base_def, base_sp_atk, base_sp_def, base_speed, catch_rate, egg_hatch_rate, sprite_code) values
  ('Electabuzz', 5, null, 3, 42, 8, 6, 10, 9, 11, 45, '12 days', 'electabuzz'),
  ('Zapdos', 5, 9, 5, 54, 9, 9, 13, 9, 10, 3, '40 days', 'zapdos'),
  ('Elekid', 5, null, 3, 30, 6, 4, 7, 6, 10, 45, '12 days', 'elekid'),
  ('Raikou', 5, null, 5, 54, 9, 8, 12, 10, 12, 3, '40 days', 'raikou'),
  ('Plusle', 5, null, 3, 36, 5, 4, 9, 8, 10, 200, '10 days', 'plusle'),
  ('Minun', 5, null, 3, 36, 4, 5, 8, 9, 10, 200, '10 days', 'minun'),
  ('Shinx', 5, null, 4, 30, 7, 3, 4, 3, 5, 235, '10 days', 'shinx'),
  ('Luxio', 5, null, 4, 36, 9, 5, 6, 5, 6, 120, '10 days', 'luxio'),
  ('Luxray', 5, null, 4, 48, 12, 8, 10, 8, 7, 45, '10 days', 'luxray'),
  ('Pachirisu', 5, null, 3, 36, 5, 7, 5, 9, 10, 200, '5 days', 'pachirisu'),
  ('Electivire', 5, null, 3, 48, 12, 7, 10, 9, 10, 30, '12 days', 'electivire'),
  ('Blitzle', 5, null, 3, 30, 6, 3, 5, 3, 8, 190, '10 days', 'blitzle'),
  ('Zebstrika', 5, null, 3, 48, 10, 6, 8, 6, 12, 75, '10 days', 'zebstrika'),
  ('Tynamo', 5, null, 5, 24, 6, 4, 5, 4, 6, 190, '10 days', 'tynamo'),
  ('Eelektrik', 5, null, 5, 42, 9, 7, 8, 7, 4, 60, '10 days', 'eelektrik'),
  ('Eelektross', 5, null, 5, 54, 12, 8, 11, 8, 5, 30, '10 days', 'eelektross'),
  ('Helioptile', 5, 14, 3, 24, 4, 3, 6, 4, 7, 190, '10 days', 'helioptile'),
  ('Heliolisk', 5, 14, 3, 36, 6, 5, 11, 9, 11, 75, '10 days', 'heliolisk'),
  ('Togedemaru', 5, 18, 3, 42, 10, 6, 4, 7, 10, 180, '5 days', 'togedemaru'),
  ('Xurkitree', 5, null, 5, 48, 9, 7, 17, 7, 8, 45, '60 days', 'xurkitree'),
  ('Zeraora', 5, null, 5, 54, 11, 8, 10, 8, 14, 3, '60 days', 'zeraora'),
  ('Yamper', 5, null, 2, 36, 5, 5, 4, 5, 3, 255, '10 days', 'yamper'),
  ('Boltund', 5, null, 2, 42, 9, 6, 9, 6, 12, 45, '10 days', 'boltund'),
  ('Toxel', 5, 15, 4, 24, 4, 4, 5, 4, 4, 75, '12 days', 'toxel'),
  ('Pincurchin', 5, null, 3, 30, 10, 10, 9, 9, 2, 75, '10 days', 'pincurchin'),
  ('Dracozolt', 5, 4, 5, 54, 10, 9, 8, 7, 8, 45, '17 days', 'dracozolt'),
  ('Arctozolt', 5, 13, 5, 54, 10, 9, 9, 8, 6, 45, '17 days', 'arctozolt'),
  ('Regieleki', 5, null, 5, 48, 10, 5, 10, 5, 20, 3, '60 days', 'regieleki'),
  ('Pawmi', 5, null, 3, 30, 5, 2, 4, 3, 6, 190, '7 days', 'pawmi'),
  ('Pawmo', 5, 7, 3, 36, 8, 4, 5, 4, 9, 80, '7 days', 'pawmo'),
  ('Pawmot', 5, 7, 3, 42, 12, 7, 7, 6, 11, 45, '7 days', 'pawmot'),
  ('Tadbulb', 5, null, 3, 36, 3, 4, 6, 4, 5, 190, '10 days', 'tadbulb'),
  ('Bellibolt', 5, null, 3, 66, 6, 9, 10, 8, 5, 50, '10 days', 'bellibolt'),
  ('Wattrel', 5, 9, 4, 24, 4, 4, 6, 4, 7, 180, '10 days', 'wattrel'),
  ('Kilowattrel', 5, 9, 4, 42, 7, 6, 11, 6, 13, 90, '10 days', 'kilowattrel'),
  ('Miraidon', 5, 4, 5, 60, 9, 10, 14, 12, 14, 3, '25 days', 'miraidon')
on conflict (name) do nothing;
