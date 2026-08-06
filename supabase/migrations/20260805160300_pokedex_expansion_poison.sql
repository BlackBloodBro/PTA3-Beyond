-- Poison-type (primary type) Pokedex expansion, batch 6 of the 'Fill out the
-- Pokedex more' FR. Same sourcing/methodology as batch 1 (Ground, 20260805130000) -- see that
-- migration's header and the README's 'Pokedex expansion' section for the full formula writeup.
--
-- size_id, weight_id, description left null; Proficiencies/Habitats/Diets get no rows -- no
-- reliable PokeAPI derivation, confirmed during Design.
--
-- COVERAGE: 35 of 63 Poison-type-membership candidates matched. 28 excluded because Poison turned out to be their secondary, not primary, type: Weedle (Bug), Kakuna (Bug), Beedrill (Bug), Oddish (Grass), Gloom (Grass), Vileplume (Grass), Venonat (Bug), Venomoth (Bug), Bellsprout (Grass), Weepinbell (Grass), Victreebel (Grass), Tentacool (Water), Tentacruel (Water), Spinarak (Bug), Ariados (Bug), Qwilfish (Water), Dustox (Bug), Roselia (Grass), Budew (Grass), Roserade (Grass), Foongus (Grass), Amoonguss (Grass), Nihilego (Rock), Overqwil (Dark), Varoom (Steel), Revavroom (Steel), Glimmet (Rock), Glimmora (Rock).

insert into pokedex (name, type_1_id, type_2_id, growth_rate_id, base_hp, base_atk, base_def, base_sp_atk, base_sp_def, base_speed, catch_rate, egg_hatch_rate, sprite_code) values
  ('Ekans', 15, null, 3, 24, 6, 4, 4, 5, 6, 255, '10 days', 'ekans'),
  ('Arbok', 15, null, 3, 36, 10, 7, 7, 8, 8, 90, '10 days', 'arbok'),
  ('Nidorina', 15, null, 4, 42, 6, 7, 6, 6, 6, 120, '10 days', 'nidorina'),
  ('Nidoqueen', 15, 12, 4, 54, 9, 9, 8, 9, 8, 45, '10 days', 'nidoqueen'),
  ('Nidorino', 15, null, 4, 36, 7, 6, 6, 6, 7, 120, '10 days', 'nidorino'),
  ('Nidoking', 15, 12, 4, 48, 10, 8, 9, 8, 9, 45, '10 days', 'nidoking'),
  ('Grimer', 15, null, 3, 48, 8, 5, 4, 5, 3, 190, '10 days', 'grimer'),
  ('Muk', 15, null, 3, 66, 11, 8, 7, 10, 5, 75, '10 days', 'muk'),
  ('Koffing', 15, null, 3, 24, 7, 10, 6, 5, 4, 190, '10 days', 'koffing'),
  ('Weezing', 15, null, 3, 42, 9, 12, 9, 7, 6, 60, '10 days', 'weezing'),
  ('Gulpin', 15, null, 6, 42, 4, 5, 4, 5, 4, 225, '10 days', 'gulpin'),
  ('Swalot', 15, null, 6, 60, 7, 8, 7, 8, 6, 75, '10 days', 'swalot'),
  ('Seviper', 15, null, 6, 42, 10, 6, 10, 6, 7, 90, '10 days', 'seviper'),
  ('Stunky', 15, 3, 3, 36, 6, 5, 4, 4, 7, 225, '10 days', 'stunky'),
  ('Skuntank', 15, 3, 3, 60, 9, 7, 7, 6, 8, 60, '10 days', 'skuntank'),
  ('Skorupi', 15, 2, 5, 24, 5, 9, 3, 6, 7, 120, '10 days', 'skorupi'),
  ('Drapion', 15, 3, 5, 42, 9, 11, 6, 8, 10, 45, '10 days', 'drapion'),
  ('Croagunk', 15, 7, 3, 30, 6, 4, 6, 4, 5, 140, '5 days', 'croagunk'),
  ('Toxicroak', 15, 7, 3, 48, 11, 7, 9, 7, 9, 75, '10 days', 'toxicroak'),
  ('Trubbish', 15, null, 3, 30, 5, 6, 4, 6, 7, 190, '10 days', 'trubbish'),
  ('Garbodor', 15, null, 3, 48, 10, 8, 6, 8, 8, 60, '10 days', 'garbodor'),
  ('Skrelp', 15, 19, 3, 30, 6, 6, 6, 6, 3, 225, '10 days', 'skrelp'),
  ('Dragalge', 15, 4, 3, 42, 8, 9, 10, 12, 4, 55, '10 days', 'dragalge'),
  ('Mareanie', 15, 19, 3, 30, 5, 6, 4, 5, 5, 190, '10 days', 'mareanie'),
  ('Toxapex', 15, 19, 3, 30, 6, 15, 5, 14, 4, 75, '10 days', 'toxapex'),
  ('Poipole', 15, null, 5, 42, 7, 7, 7, 7, 7, 45, '60 days', 'poipole'),
  ('Naganadel', 15, 4, 5, 42, 7, 7, 13, 7, 12, 45, '60 days', 'naganadel'),
  ('Eternatus', 15, 4, 5, 84, 9, 10, 15, 10, 13, 255, '60 days', 'eternatus'),
  ('Shroodle', 15, 14, 4, 24, 7, 4, 4, 4, 8, 190, '10 days', 'shroodle'),
  ('Grafaiai', 15, 14, 4, 36, 10, 7, 8, 7, 11, 90, '10 days', 'grafaiai'),
  ('Clodsire', 15, 12, 3, 78, 8, 6, 5, 10, 2, 90, '10 days', 'clodsire'),
  ('Okidogi', 15, 7, 5, 54, 13, 12, 6, 9, 8, 3, '25 days', 'okidogi'),
  ('Munkidori', 15, 16, 5, 54, 8, 7, 13, 9, 11, 3, '25 days', 'munkidori'),
  ('Fezandipiti', 15, 6, 5, 54, 9, 8, 7, 13, 10, 3, '25 days', 'fezandipiti'),
  ('Pecharunt', 15, 10, 5, 54, 9, 16, 9, 9, 9, 3, '10 days', 'pecharunt')
on conflict (name) do nothing;
