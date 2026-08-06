-- Rock-type (primary type) Pokedex expansion, batch 7 of the 'Fill out the
-- Pokedex more' FR. Same sourcing/methodology as batch 1 (Ground, 20260805130000) -- see that
-- migration's header and the README's 'Pokedex expansion' section for the full formula writeup.
--
-- size_id, weight_id, description left null; Proficiencies/Habitats/Diets get no rows -- no
-- reliable PokeAPI derivation, confirmed during Design.
--
-- COVERAGE: 37 of 42 Rock-type-membership candidates matched. 5 excluded because Rock turned out to be their secondary, not primary, type: Corsola (Water), Dwebble (Bug), Crustle (Bug), Drednaw (Water), Kleavor (Bug).

insert into pokedex (name, type_1_id, type_2_id, growth_rate_id, base_hp, base_atk, base_def, base_sp_atk, base_sp_def, base_speed, catch_rate, egg_hatch_rate, sprite_code) values
  ('Omanyte', 17, 19, 3, 24, 4, 10, 9, 6, 4, 45, '15 days', 'omanyte'),
  ('Omastar', 17, 19, 3, 42, 6, 13, 12, 7, 6, 45, '15 days', 'omastar'),
  ('Kabuto', 17, 19, 3, 18, 8, 9, 6, 5, 6, 45, '15 days', 'kabuto'),
  ('Kabutops', 17, 19, 3, 36, 12, 11, 7, 7, 8, 45, '15 days', 'kabutops'),
  ('Aerodactyl', 17, 9, 5, 48, 11, 7, 6, 8, 13, 45, '17 days', 'aerodactyl'),
  ('Larvitar', 17, 12, 5, 30, 6, 5, 5, 5, 4, 45, '20 days', 'larvitar'),
  ('Pupitar', 17, 12, 5, 42, 8, 7, 7, 7, 5, 45, '20 days', 'pupitar'),
  ('Tyranitar', 17, 3, 5, 60, 13, 11, 10, 10, 6, 45, '20 days', 'tyranitar'),
  ('Nosepass', 17, null, 3, 18, 5, 14, 5, 9, 3, 255, '10 days', 'nosepass'),
  ('Lileep', 17, 11, 1, 42, 4, 8, 6, 9, 2, 45, '15 days', 'lileep'),
  ('Cradily', 17, 11, 1, 54, 8, 10, 8, 11, 4, 45, '15 days', 'cradily'),
  ('Anorith', 17, 2, 1, 30, 10, 5, 4, 5, 8, 45, '15 days', 'anorith'),
  ('Armaldo', 17, 2, 1, 48, 13, 10, 7, 8, 5, 45, '15 days', 'armaldo'),
  ('Regirock', 17, null, 5, 48, 10, 20, 5, 10, 5, 3, '40 days', 'regirock'),
  ('Cranidos', 17, null, 1, 42, 13, 4, 3, 3, 6, 45, '15 days', 'cranidos'),
  ('Rampardos', 17, null, 1, 60, 17, 6, 7, 5, 6, 45, '15 days', 'rampardos'),
  ('Shieldon', 17, 18, 1, 18, 4, 12, 4, 9, 3, 45, '15 days', 'shieldon'),
  ('Bastiodon', 17, 18, 1, 36, 5, 17, 5, 14, 3, 45, '15 days', 'bastiodon'),
  ('Probopass', 17, 18, 3, 36, 6, 15, 8, 15, 4, 60, '10 days', 'probopass'),
  ('Archen', 17, 9, 3, 36, 11, 5, 7, 5, 7, 45, '15 days', 'archen'),
  ('Archeops', 17, 9, 3, 48, 14, 7, 11, 7, 11, 45, '15 days', 'archeops'),
  ('Terrakion', 17, 7, 5, 54, 13, 9, 7, 9, 11, 3, '40 days', 'terrakion'),
  ('Binacle', 17, 19, 3, 24, 5, 7, 4, 6, 5, 120, '10 days', 'binacle'),
  ('Barbaracle', 17, 19, 3, 42, 11, 12, 5, 9, 7, 45, '10 days', 'barbaracle'),
  ('Tyrunt', 17, 4, 3, 36, 9, 8, 5, 5, 5, 45, '15 days', 'tyrunt'),
  ('Tyrantrum', 17, 4, 3, 48, 12, 12, 7, 6, 7, 45, '15 days', 'tyrantrum'),
  ('Diancie', 17, 6, 5, 30, 10, 15, 10, 15, 5, 3, '12 days', 'diancie'),
  ('Rockruff', 17, null, 3, 30, 7, 4, 3, 4, 6, 190, '7 days', 'rockruff'),
  ('Nihilego', 17, 15, 5, 66, 5, 5, 13, 13, 10, 45, '60 days', 'nihilego'),
  ('Stakataka', 17, 18, 5, 36, 13, 21, 5, 10, 1, 30, '60 days', 'stakataka'),
  ('Stonjourner', 17, null, 5, 60, 13, 14, 2, 2, 7, 60, '12 days', 'stonjourner'),
  ('Nacli', 17, null, 4, 36, 6, 8, 4, 4, 3, 255, '10 days', 'nacli'),
  ('Naclstack', 17, null, 4, 36, 6, 10, 4, 7, 4, 120, '10 days', 'naclstack'),
  ('Garganacl', 17, null, 4, 60, 10, 13, 5, 9, 4, 45, '10 days', 'garganacl'),
  ('Klawf', 17, null, 3, 42, 10, 12, 4, 6, 8, 120, '17 days', 'klawf'),
  ('Glimmet', 17, 15, 4, 30, 4, 4, 11, 6, 6, 70, '15 days', 'glimmet'),
  ('Glimmora', 17, 15, 4, 48, 6, 9, 13, 8, 9, 25, '15 days', 'glimmora')
on conflict (name) do nothing;
