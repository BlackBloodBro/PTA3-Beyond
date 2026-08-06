-- Steel-type (primary type) Pokedex expansion, batch 10 of the 'Fill out the
-- Pokedex more' FR. Same sourcing/methodology as batch 1 (Ground, 20260805130000) -- see that
-- migration's header and the README's 'Pokedex expansion' section for the full formula writeup.
--
-- size_id, weight_id, description left null; Proficiencies/Habitats/Diets get no rows -- no
-- reliable PokeAPI derivation, confirmed during Design.
--
-- COVERAGE: 28 of 48 Steel-type-membership candidates matched. 20 excluded because Steel turned out to be their secondary, not primary, type: Forretress (Bug), Scizor (Bug), Shieldon (Rock), Bastiodon (Rock), Probopass (Rock), Heatran (Fire), Escavalier (Bug), Ferroseed (Grass), Ferrothorn (Grass), Pawniard (Dark), Bisharp (Dark), Durant (Bug), Genesect (Bug), Solgaleo (Psychic), Kartana (Grass), Stakataka (Rock), Tinkatink (Fairy), Tinkatuff (Fairy), Tinkaton (Fairy), Kingambit (Dark).

insert into pokedex (name, type_1_id, type_2_id, growth_rate_id, base_hp, base_atk, base_def, base_sp_atk, base_sp_def, base_speed, catch_rate, egg_hatch_rate, sprite_code) values
  ('Skarmory', 18, 9, 5, 42, 8, 14, 4, 7, 7, 25, '12 days', 'skarmory'),
  ('Mawile', 18, 6, 2, 30, 9, 9, 6, 6, 5, 45, '10 days', 'mawile'),
  ('Beldum', 18, 16, 5, 24, 6, 8, 4, 6, 3, 3, '20 days', 'beldum'),
  ('Metang', 18, 16, 5, 36, 8, 10, 6, 8, 5, 3, '20 days', 'metang'),
  ('Metagross', 18, 16, 5, 48, 14, 13, 10, 9, 7, 3, '20 days', 'metagross'),
  ('Registeel', 18, null, 5, 48, 8, 15, 8, 15, 5, 3, '40 days', 'registeel'),
  ('Jirachi', 18, 16, 5, 60, 10, 10, 10, 10, 10, 3, '60 days', 'jirachi'),
  ('Dialga', 18, 4, 5, 60, 12, 12, 15, 10, 9, 3, '60 days', 'dialga'),
  ('Klink', 18, null, 4, 24, 6, 7, 5, 6, 3, 130, '10 days', 'klink'),
  ('Klang', 18, null, 4, 36, 8, 10, 7, 9, 5, 60, '10 days', 'klang'),
  ('Klinklang', 18, null, 4, 36, 10, 12, 7, 9, 9, 30, '10 days', 'klinklang'),
  ('Cobalion', 18, 7, 5, 54, 9, 13, 9, 7, 11, 3, '40 days', 'cobalion'),
  ('Honedge', 18, 10, 3, 30, 8, 10, 4, 4, 3, 180, '10 days', 'honedge'),
  ('Doublade', 18, 10, 3, 36, 11, 15, 5, 5, 4, 90, '10 days', 'doublade'),
  ('Klefki', 18, 6, 2, 36, 8, 9, 8, 9, 8, 75, '10 days', 'klefki'),
  ('Celesteela', 18, 9, 5, 60, 10, 10, 11, 10, 6, 45, '60 days', 'celesteela'),
  ('Magearna', 18, 6, 5, 48, 10, 12, 13, 12, 7, 3, '60 days', 'magearna'),
  ('Meltan', 18, null, 5, 30, 7, 7, 6, 4, 3, 3, '60 days', 'meltan'),
  ('Melmetal', 18, null, 5, 84, 14, 14, 8, 7, 3, 3, '60 days', 'melmetal'),
  ('Perrserker', 18, null, 3, 42, 11, 10, 5, 6, 5, 90, '10 days', 'perrserker'),
  ('Cufant', 18, null, 3, 42, 8, 5, 4, 5, 4, 190, '12 days', 'cufant'),
  ('Copperajah', 18, null, 3, 72, 13, 7, 8, 7, 3, 90, '12 days', 'copperajah'),
  ('Duraludon', 18, 4, 3, 42, 10, 12, 12, 5, 9, 45, '15 days', 'duraludon'),
  ('Varoom', 18, 15, 3, 30, 7, 6, 3, 5, 5, 190, '10 days', 'varoom'),
  ('Revavroom', 18, 15, 3, 48, 12, 9, 5, 7, 9, 75, '10 days', 'revavroom'),
  ('Orthworm', 18, null, 5, 42, 9, 15, 6, 6, 7, 25, '17 days', 'orthworm'),
  ('Gholdengo', 18, 10, 5, 54, 6, 10, 13, 9, 8, 45, '25 days', 'gholdengo'),
  ('Archaludon', 18, 4, 3, 54, 11, 13, 13, 7, 9, 10, '15 days', 'archaludon')
on conflict (name) do nothing;
