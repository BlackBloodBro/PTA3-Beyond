-- Dragon-type (primary type) Pokedex expansion, batch 14 of the 'Fill out the
-- Pokedex more' FR. Same sourcing/methodology as batch 1 (Ground, 20260805130000) -- see that
-- migration's header and the README's 'Pokedex expansion' section for the full formula writeup.
--
-- size_id, weight_id, description left null; Proficiencies/Habitats/Diets get no rows -- no
-- reliable PokeAPI derivation, confirmed during Design.
--
-- COVERAGE: 30 of 48 Dragon-type-membership candidates matched. 18 excluded because Dragon turned out to be their secondary, not primary, type: Dialga (Steel), Palkia (Water), Deino (Dark), Zweilous (Dark), Hydreigon (Dark), Dragalge (Poison), Tyrunt (Rock), Tyrantrum (Rock), Noibat (Flying), Noivern (Flying), Drampa (Normal), Guzzlord (Dark), Naganadel (Poison), Dracovish (Water), Duraludon (Steel), Eternatus (Poison), Koraidon (Fighting), Archaludon (Steel).

insert into pokedex (name, type_1_id, type_2_id, growth_rate_id, base_hp, base_atk, base_def, base_sp_atk, base_sp_def, base_speed, catch_rate, egg_hatch_rate, sprite_code) values
  ('Dratini', 4, null, 5, 24, 6, 5, 5, 5, 5, 45, '20 days', 'dratini'),
  ('Dragonair', 4, null, 5, 36, 8, 7, 7, 7, 7, 45, '20 days', 'dragonair'),
  ('Dragonite', 4, 9, 5, 54, 13, 10, 10, 10, 8, 45, '20 days', 'dragonite'),
  ('Bagon', 4, null, 5, 30, 8, 6, 4, 3, 5, 45, '20 days', 'bagon'),
  ('Shelgon', 4, null, 5, 42, 10, 10, 6, 5, 5, 45, '20 days', 'shelgon'),
  ('Salamence', 4, 9, 5, 60, 14, 8, 11, 8, 10, 45, '20 days', 'salamence'),
  ('Latias', 4, 16, 5, 48, 8, 9, 11, 13, 11, 3, '60 days', 'latias'),
  ('Latios', 4, 16, 5, 48, 9, 8, 13, 11, 11, 3, '60 days', 'latios'),
  ('Rayquaza', 4, 9, 5, 66, 15, 9, 15, 9, 10, 45, '60 days', 'rayquaza'),
  ('Gible', 4, 12, 5, 36, 7, 5, 4, 5, 4, 45, '20 days', 'gible'),
  ('Gabite', 4, 12, 5, 42, 9, 7, 5, 6, 8, 45, '20 days', 'gabite'),
  ('Garchomp', 4, 12, 5, 66, 13, 10, 8, 9, 10, 45, '20 days', 'garchomp'),
  ('Axew', 4, null, 5, 30, 9, 6, 3, 4, 6, 75, '20 days', 'axew'),
  ('Fraxure', 4, null, 5, 42, 12, 7, 4, 5, 7, 60, '20 days', 'fraxure'),
  ('Haxorus', 4, null, 5, 48, 15, 9, 6, 7, 10, 45, '20 days', 'haxorus'),
  ('Druddigon', 4, null, 3, 48, 12, 9, 6, 9, 5, 45, '15 days', 'druddigon'),
  ('Reshiram', 4, 8, 5, 60, 12, 10, 15, 12, 9, 3, '60 days', 'reshiram'),
  ('Zekrom', 4, 5, 5, 60, 15, 12, 12, 10, 9, 3, '60 days', 'zekrom'),
  ('Kyurem', 4, 13, 5, 78, 13, 9, 13, 9, 10, 3, '60 days', 'kyurem'),
  ('Goomy', 4, null, 5, 30, 5, 4, 6, 8, 4, 45, '20 days', 'goomy'),
  ('Sliggoo', 4, null, 5, 42, 8, 5, 8, 11, 6, 45, '20 days', 'sliggoo'),
  ('Goodra', 4, null, 5, 54, 10, 7, 11, 15, 8, 45, '20 days', 'goodra'),
  ('Dreepy', 4, 10, 5, 18, 6, 3, 4, 3, 8, 45, '20 days', 'dreepy'),
  ('Drakloak', 4, 10, 5, 42, 8, 5, 6, 5, 10, 45, '20 days', 'drakloak'),
  ('Dragapult', 4, 10, 5, 54, 12, 8, 10, 8, 14, 45, '20 days', 'dragapult'),
  ('Regidrago', 4, null, 5, 120, 10, 5, 10, 5, 8, 3, '60 days', 'regidrago'),
  ('Cyclizar', 4, 14, 4, 42, 10, 7, 9, 7, 12, 190, '15 days', 'cyclizar'),
  ('Frigibax', 4, 13, 5, 42, 8, 5, 4, 5, 6, 45, '20 days', 'frigibax'),
  ('Arctibax', 4, 13, 5, 54, 10, 7, 5, 7, 6, 25, '20 days', 'arctibax'),
  ('Baxcalibur', 4, 13, 5, 72, 15, 9, 8, 9, 9, 10, '20 days', 'baxcalibur')
on conflict (name) do nothing;
