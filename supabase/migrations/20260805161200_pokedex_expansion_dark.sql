-- Dark-type (primary type) Pokedex expansion, batch 15 of the 'Fill out the
-- Pokedex more' FR. Same sourcing/methodology as batch 1 (Ground, 20260805130000) -- see that
-- migration's header and the README's 'Pokedex expansion' section for the full formula writeup.
--
-- size_id, weight_id, description left null; Proficiencies/Habitats/Diets get no rows -- no
-- reliable PokeAPI derivation, confirmed during Design.
--
-- COVERAGE: 30 of 42 Dark-type-membership candidates matched. 12 excluded because Dark turned out to be their secondary, not primary, type: Tyranitar (Rock), Nuzleaf (Grass), Shiftry (Grass), Cacturne (Grass), Crawdaunt (Water), Stunky (Poison), Skuntank (Poison), Spiritomb (Ghost), Drapion (Poison), Pangoro (Fighting), Lokix (Bug), Bombirdier (Flying).

insert into pokedex (name, type_1_id, type_2_id, growth_rate_id, base_hp, base_atk, base_def, base_sp_atk, base_sp_def, base_speed, catch_rate, egg_hatch_rate, sprite_code) values
  ('Murkrow', 3, 9, 4, 36, 9, 4, 9, 4, 9, 30, '10 days', 'murkrow'),
  ('Poochyena', 3, null, 3, 24, 6, 4, 3, 3, 4, 255, '7 days', 'poochyena'),
  ('Mightyena', 3, null, 3, 42, 9, 7, 6, 6, 7, 127, '7 days', 'mightyena'),
  ('Honchkrow', 3, 9, 4, 60, 13, 5, 11, 5, 7, 30, '10 days', 'honchkrow'),
  ('Darkrai', 3, null, 5, 42, 9, 9, 14, 9, 13, 3, '60 days', 'darkrai'),
  ('Purrloin', 3, null, 3, 24, 5, 4, 5, 4, 7, 255, '10 days', 'purrloin'),
  ('Liepard', 3, null, 3, 36, 9, 5, 9, 5, 11, 90, '10 days', 'liepard'),
  ('Scraggy', 3, 7, 3, 30, 8, 7, 4, 7, 5, 180, '7 days', 'scraggy'),
  ('Scrafty', 3, 7, 3, 42, 9, 12, 5, 12, 6, 90, '7 days', 'scrafty'),
  ('Zorua', 3, null, 4, 24, 7, 4, 8, 4, 7, 75, '12 days', 'zorua'),
  ('Zoroark', 3, null, 4, 36, 11, 6, 12, 6, 11, 45, '10 days', 'zoroark'),
  ('Pawniard', 3, 18, 3, 30, 9, 7, 4, 4, 6, 120, '10 days', 'pawniard'),
  ('Bisharp', 3, 18, 3, 42, 13, 10, 6, 7, 7, 45, '10 days', 'bisharp'),
  ('Vullaby', 3, 9, 5, 42, 6, 8, 5, 7, 6, 190, '10 days', 'vullaby'),
  ('Mandibuzz', 3, 9, 5, 66, 7, 11, 6, 10, 8, 60, '10 days', 'mandibuzz'),
  ('Deino', 3, 4, 5, 30, 7, 5, 5, 5, 4, 45, '20 days', 'deino'),
  ('Zweilous', 3, 4, 5, 42, 9, 7, 7, 7, 6, 45, '20 days', 'zweilous'),
  ('Hydreigon', 3, 4, 5, 54, 11, 9, 13, 9, 10, 45, '20 days', 'hydreigon'),
  ('Inkay', 3, 16, 3, 30, 5, 5, 4, 5, 5, 190, '10 days', 'inkay'),
  ('Malamar', 3, 16, 3, 54, 9, 9, 7, 8, 7, 80, '10 days', 'malamar'),
  ('Yveltal', 3, 9, 5, 78, 13, 10, 13, 10, 10, 45, '60 days', 'yveltal'),
  ('Guzzlord', 3, 4, 5, 132, 10, 5, 10, 5, 4, 45, '60 days', 'guzzlord'),
  ('Nickit', 3, null, 2, 24, 3, 3, 5, 5, 5, 255, '7 days', 'nickit'),
  ('Thievul', 3, null, 2, 42, 6, 6, 9, 9, 9, 127, '7 days', 'thievul'),
  ('Obstagoon', 3, 14, 3, 54, 9, 10, 6, 8, 10, 45, '7 days', 'obstagoon'),
  ('Zarude', 3, 11, 5, 66, 12, 11, 7, 10, 11, 3, '60 days', 'zarude'),
  ('Overqwil', 3, 15, 3, 54, 12, 10, 7, 7, 9, 135, '10 days', 'overqwil'),
  ('Maschiff', 3, null, 4, 36, 8, 6, 4, 5, 5, 150, '10 days', 'maschiff'),
  ('Mabosstiff', 3, null, 4, 48, 12, 9, 6, 7, 9, 75, '10 days', 'mabosstiff'),
  ('Kingambit', 3, 18, 3, 60, 14, 12, 6, 9, 5, 25, '10 days', 'kingambit')
on conflict (name) do nothing;
