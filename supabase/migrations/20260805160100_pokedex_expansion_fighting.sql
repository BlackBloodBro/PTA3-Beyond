-- Fighting-type (primary type) Pokedex expansion, batch 4 of the 'Fill out the
-- Pokedex more' FR. Same sourcing/methodology as batch 1 (Ground, 20260805130000) -- see that
-- migration's header and the README's 'Pokedex expansion' section for the full formula writeup.
--
-- size_id, weight_id, description left null; Proficiencies/Habitats/Diets get no rows -- no
-- reliable PokeAPI derivation, confirmed during Design.
--
-- COVERAGE: 34 of 49 Fighting-type-membership candidates matched. 15 excluded because Fighting turned out to be their secondary, not primary, type: Heracross (Bug), Breloom (Grass), Croagunk (Poison), Toxicroak (Poison), Scraggy (Dark), Scrafty (Dark), Cobalion (Steel), Terrakion (Rock), Virizion (Grass), Stufful (Normal), Bewear (Normal), Buzzwole (Bug), Pheromosa (Bug), Flamigo (Flying), Okidogi (Poison).

insert into pokedex (name, type_1_id, type_2_id, growth_rate_id, base_hp, base_atk, base_def, base_sp_atk, base_sp_def, base_speed, catch_rate, egg_hatch_rate, sprite_code) values
  ('Mankey', 7, null, 3, 24, 8, 4, 4, 5, 7, 190, '10 days', 'mankey'),
  ('Primeape', 7, null, 3, 42, 11, 6, 6, 7, 10, 75, '10 days', 'primeape'),
  ('Machop', 7, null, 4, 42, 8, 5, 4, 4, 4, 180, '10 days', 'machop'),
  ('Machoke', 7, null, 4, 48, 10, 7, 5, 6, 5, 90, '10 days', 'machoke'),
  ('Machamp', 7, null, 4, 54, 13, 8, 7, 9, 6, 45, '10 days', 'machamp'),
  ('Hitmonlee', 7, null, 3, 30, 12, 5, 4, 11, 9, 45, '12 days', 'hitmonlee'),
  ('Hitmonchan', 7, null, 3, 30, 11, 8, 4, 11, 8, 45, '12 days', 'hitmonchan'),
  ('Tyrogue', 7, null, 3, 24, 4, 4, 4, 4, 4, 75, '12 days', 'tyrogue'),
  ('Hitmontop', 7, null, 3, 30, 10, 10, 4, 11, 7, 45, '12 days', 'hitmontop'),
  ('Makuhita', 7, null, 6, 42, 6, 3, 2, 3, 3, 180, '10 days', 'makuhita'),
  ('Hariyama', 7, null, 6, 84, 12, 6, 4, 6, 5, 200, '10 days', 'hariyama'),
  ('Meditite', 7, 16, 3, 18, 4, 6, 4, 6, 6, 180, '10 days', 'meditite'),
  ('Medicham', 7, 16, 3, 36, 6, 8, 6, 8, 8, 90, '10 days', 'medicham'),
  ('Timburr', 7, null, 4, 48, 8, 6, 3, 4, 4, 180, '10 days', 'timburr'),
  ('Gurdurr', 7, null, 4, 54, 11, 9, 4, 5, 4, 90, '10 days', 'gurdurr'),
  ('Conkeldurr', 7, null, 4, 66, 14, 10, 6, 7, 5, 45, '10 days', 'conkeldurr'),
  ('Throh', 7, null, 3, 72, 10, 9, 3, 9, 5, 45, '10 days', 'throh'),
  ('Sawk', 7, null, 3, 48, 13, 8, 3, 8, 9, 45, '10 days', 'sawk'),
  ('Mienfoo', 7, null, 4, 30, 9, 5, 6, 5, 7, 180, '12 days', 'mienfoo'),
  ('Mienshao', 7, null, 4, 42, 13, 6, 10, 6, 11, 45, '12 days', 'mienshao'),
  ('Pancham', 7, null, 3, 42, 8, 6, 5, 5, 4, 220, '12 days', 'pancham'),
  ('Pangoro', 7, 3, 3, 60, 12, 8, 7, 7, 6, 65, '12 days', 'pangoro'),
  ('Hawlucha', 7, 9, 3, 48, 9, 8, 7, 6, 12, 100, '10 days', 'hawlucha'),
  ('Crabrawler', 7, null, 3, 30, 8, 6, 4, 5, 6, 225, '10 days', 'crabrawler'),
  ('Crabominable', 7, 13, 3, 60, 13, 8, 6, 7, 4, 60, '10 days', 'crabominable'),
  ('Marshadow', 7, 10, 5, 54, 13, 8, 9, 9, 13, 3, '60 days', 'marshadow'),
  ('Clobbopus', 7, null, 4, 30, 7, 6, 5, 5, 3, 180, '12 days', 'clobbopus'),
  ('Grapploct', 7, null, 4, 48, 12, 9, 7, 8, 4, 45, '12 days', 'grapploct'),
  ('Sirfetchd', 7, null, 3, 36, 14, 10, 7, 8, 7, 45, '10 days', 'sirfetchd'),
  ('Falinks', 7, null, 3, 42, 10, 10, 7, 6, 8, 45, '12 days', 'falinks'),
  ('Zamazenta', 7, null, 5, 54, 12, 12, 8, 12, 14, 10, '60 days', 'zamazenta'),
  ('Kubfu', 7, null, 5, 36, 9, 6, 5, 5, 7, 3, '60 days', 'kubfu'),
  ('Annihilape', 7, 10, 3, 66, 12, 8, 5, 9, 9, 45, '10 days', 'annihilape'),
  ('Koraidon', 7, 4, 5, 60, 14, 12, 9, 10, 14, 3, '25 days', 'koraidon')
on conflict (name) do nothing;
