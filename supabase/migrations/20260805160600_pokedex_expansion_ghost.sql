-- Ghost-type (primary type) Pokedex expansion, batch 9 of the 'Fill out the
-- Pokedex more' FR. Same sourcing/methodology as batch 1 (Ground, 20260805130000) -- see that
-- migration's header and the README's 'Pokedex expansion' section for the full formula writeup.
--
-- size_id, weight_id, description left null; Proficiencies/Habitats/Diets get no rows -- no
-- reliable PokeAPI derivation, confirmed during Design.
--
-- COVERAGE: 22 of 39 Ghost-type-membership candidates matched. 17 excluded because Ghost turned out to be their secondary, not primary, type: Shedinja (Bug), Honedge (Steel), Doublade (Steel), Hoopa (Psychic), Lunala (Psychic), Marshadow (Fighting), Blacephalon (Fire), Dreepy (Dragon), Drakloak (Dragon), Dragapult (Dragon), Bramblin (Grass), Brambleghast (Grass), Annihilape (Fighting), Gholdengo (Steel), Poltchageist (Grass), Sinistcha (Grass), Pecharunt (Poison).

insert into pokedex (name, type_1_id, type_2_id, growth_rate_id, base_hp, base_atk, base_def, base_sp_atk, base_sp_def, base_speed, catch_rate, egg_hatch_rate, sprite_code) values
  ('Shuppet', 10, null, 2, 24, 8, 4, 6, 3, 5, 225, '12 days', 'shuppet'),
  ('Banette', 10, null, 2, 36, 12, 7, 8, 6, 7, 45, '12 days', 'banette'),
  ('Duskull', 10, null, 2, 12, 4, 9, 3, 9, 3, 190, '12 days', 'duskull'),
  ('Dusclops', 10, null, 2, 24, 7, 13, 6, 13, 3, 90, '12 days', 'dusclops'),
  ('Drifloon', 10, 9, 6, 54, 5, 3, 6, 4, 7, 125, '15 days', 'drifloon'),
  ('Drifblim', 10, 9, 6, 90, 8, 4, 9, 5, 8, 60, '15 days', 'drifblim'),
  ('Spiritomb', 10, 3, 3, 30, 9, 11, 9, 11, 4, 100, '15 days', 'spiritomb'),
  ('Dusknoir', 10, null, 2, 30, 10, 14, 7, 14, 5, 45, '12 days', 'dusknoir'),
  ('Yamask', 10, null, 3, 24, 3, 9, 6, 7, 3, 190, '12 days', 'yamask'),
  ('Cofagrigus', 10, null, 3, 36, 5, 15, 10, 11, 3, 90, '12 days', 'cofagrigus'),
  ('Phantump', 10, 11, 3, 24, 7, 5, 5, 6, 4, 120, '10 days', 'phantump'),
  ('Trevenant', 10, 11, 3, 54, 11, 8, 7, 8, 6, 60, '10 days', 'trevenant'),
  ('Sandygast', 10, 12, 3, 36, 6, 8, 7, 5, 2, 140, '7 days', 'sandygast'),
  ('Palossand', 10, 12, 3, 54, 8, 11, 10, 8, 4, 60, '7 days', 'palossand'),
  ('Dhelmise', 10, 11, 3, 42, 13, 10, 9, 9, 4, 25, '12 days', 'dhelmise'),
  ('Sinistea', 10, null, 3, 24, 5, 5, 7, 5, 5, 120, '10 days', 'sinistea'),
  ('Polteageist', 10, null, 3, 36, 7, 7, 13, 11, 7, 60, '10 days', 'polteageist'),
  ('Cursola', 10, null, 2, 36, 10, 5, 15, 13, 3, 30, '10 days', 'cursola'),
  ('Spectrier', 10, null, 5, 60, 7, 6, 15, 8, 13, 3, '60 days', 'spectrier'),
  ('Greavard', 10, null, 4, 30, 6, 6, 3, 6, 3, 120, '10 days', 'greavard'),
  ('Houndstone', 10, null, 4, 42, 10, 10, 5, 10, 7, 60, '10 days', 'houndstone'),
  ('Gimmighoul', 10, null, 5, 30, 3, 7, 8, 7, 1, 45, '25 days', 'gimmighoul')
on conflict (name) do nothing;
