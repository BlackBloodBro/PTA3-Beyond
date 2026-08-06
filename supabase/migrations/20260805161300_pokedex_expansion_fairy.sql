-- Fairy-type (primary type) Pokedex expansion, batch 16 of the 'Fill out the
-- Pokedex more' FR. Same sourcing/methodology as batch 1 (Ground, 20260805130000) -- see that
-- migration's header and the README's 'Pokedex expansion' section for the full formula writeup.
--
-- size_id, weight_id, description left null; Proficiencies/Habitats/Diets get no rows -- no
-- reliable PokeAPI derivation, confirmed during Design.
--
-- COVERAGE: 25 of 38 Fairy-type-membership candidates matched. 13 excluded because Fairy turned out to be their secondary, not primary, type: Wigglytuff (Normal), Mawile (Steel), Cottonee (Grass), Whimsicott (Grass), Klefki (Steel), Diancie (Rock), Cutiefly (Bug), Ribombee (Bug), Morelull (Grass), Shiinotic (Grass), Magearna (Steel), Hatterene (Psychic), Fezandipiti (Poison).

insert into pokedex (name, type_1_id, type_2_id, growth_rate_id, base_hp, base_atk, base_def, base_sp_atk, base_sp_def, base_speed, catch_rate, egg_hatch_rate, sprite_code) values
  ('Clefairy', 6, null, 2, 42, 5, 5, 6, 7, 4, 150, '5 days', 'clefairy'),
  ('Clefable', 6, null, 2, 60, 7, 7, 10, 9, 6, 25, '5 days', 'clefable'),
  ('Cleffa', 6, null, 2, 30, 3, 3, 5, 6, 2, 150, '5 days', 'cleffa'),
  ('Togepi', 6, null, 2, 24, 2, 7, 4, 7, 2, 190, '5 days', 'togepi'),
  ('Togetic', 6, 9, 2, 36, 4, 9, 8, 11, 4, 75, '5 days', 'togetic'),
  ('Snubbull', 6, null, 2, 36, 8, 5, 4, 4, 3, 190, '10 days', 'snubbull'),
  ('Granbull', 6, null, 2, 54, 12, 8, 6, 6, 5, 75, '10 days', 'granbull'),
  ('Togekiss', 6, 9, 2, 54, 5, 10, 12, 12, 8, 30, '5 days', 'togekiss'),
  ('Flabebe', 6, null, 3, 24, 4, 4, 6, 8, 4, 225, '10 days', 'flabebe'),
  ('Floette', 6, null, 3, 30, 5, 5, 8, 10, 5, 120, '10 days', 'floette'),
  ('Florges', 6, null, 3, 48, 7, 7, 11, 15, 8, 45, '10 days', 'florges'),
  ('Spritzee', 6, null, 3, 48, 5, 6, 6, 7, 2, 200, '10 days', 'spritzee'),
  ('Aromatisse', 6, null, 3, 60, 7, 7, 10, 9, 3, 140, '10 days', 'aromatisse'),
  ('Swirlix', 6, null, 3, 36, 5, 7, 6, 6, 5, 200, '10 days', 'swirlix'),
  ('Slurpuff', 6, null, 3, 48, 8, 9, 9, 8, 7, 140, '10 days', 'slurpuff'),
  ('Xerneas', 6, null, 5, 78, 13, 10, 13, 10, 10, 45, '60 days', 'xerneas'),
  ('Comfey', 6, null, 2, 30, 5, 9, 8, 11, 10, 60, '10 days', 'comfey'),
  ('Milcery', 6, null, 3, 30, 4, 4, 5, 6, 3, 200, '10 days', 'milcery'),
  ('Alcremie', 6, null, 3, 42, 6, 8, 11, 12, 6, 100, '10 days', 'alcremie'),
  ('Zacian', 6, null, 5, 54, 12, 12, 8, 12, 14, 10, '60 days', 'zacian'),
  ('Fidough', 6, null, 4, 24, 6, 7, 3, 6, 7, 190, '10 days', 'fidough'),
  ('Dachsbun', 6, null, 4, 36, 8, 12, 5, 8, 10, 90, '10 days', 'dachsbun'),
  ('Tinkatink', 6, 18, 4, 30, 5, 5, 4, 6, 6, 190, '10 days', 'tinkatink'),
  ('Tinkatuff', 6, 18, 4, 42, 6, 6, 5, 8, 8, 90, '10 days', 'tinkatuff'),
  ('Tinkaton', 6, 18, 4, 54, 8, 8, 7, 11, 9, 45, '10 days', 'tinkaton')
on conflict (name) do nothing;
