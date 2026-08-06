-- Psychic-type (primary type) Pokedex expansion, batch 13 of the 'Fill out the
-- Pokedex more' FR. Same sourcing/methodology as batch 1 (Ground, 20260805130000) -- see that
-- migration's header and the README's 'Pokedex expansion' section for the full formula writeup.
--
-- size_id, weight_id, description left null; Proficiencies/Habitats/Diets get no rows -- no
-- reliable PokeAPI derivation, confirmed during Design.
--
-- COVERAGE: 44 of 67 Psychic-type-membership candidates matched. 23 excluded because Psychic turned out to be their secondary, not primary, type: Slowpoke (Water), Slowbro (Water), Exeggcute (Grass), Exeggutor (Grass), Starmie (Water), Slowking (Water), Girafarig (Normal), Meditite (Fighting), Medicham (Fighting), Beldum (Steel), Metang (Steel), Metagross (Steel), Latias (Dragon), Latios (Dragon), Jirachi (Steel), Inkay (Dark), Malamar (Dark), Bruxish (Water), Wyrdeer (Normal), Rabsca (Bug), Veluza (Water), Farigiraf (Normal), Munkidori (Poison).

insert into pokedex (name, type_1_id, type_2_id, growth_rate_id, base_hp, base_atk, base_def, base_sp_atk, base_sp_def, base_speed, catch_rate, egg_hatch_rate, sprite_code) values
  ('Abra', 16, null, 4, 18, 2, 2, 11, 6, 9, 200, '10 days', 'abra'),
  ('Kadabra', 16, null, 4, 24, 4, 3, 12, 7, 11, 100, '10 days', 'kadabra'),
  ('Alakazam', 16, null, 4, 36, 5, 5, 14, 10, 12, 50, '10 days', 'alakazam'),
  ('Drowzee', 16, null, 3, 36, 5, 5, 4, 9, 4, 190, '10 days', 'drowzee'),
  ('Hypno', 16, null, 3, 54, 7, 7, 7, 12, 7, 75, '10 days', 'hypno'),
  ('Mewtwo', 16, null, 5, 66, 11, 9, 15, 9, 13, 3, '60 days', 'mewtwo'),
  ('Mew', 16, null, 4, 60, 10, 10, 10, 10, 10, 45, '60 days', 'mew'),
  ('Natu', 16, 9, 3, 24, 5, 5, 7, 5, 7, 190, '10 days', 'natu'),
  ('Xatu', 16, 9, 3, 42, 8, 7, 10, 7, 10, 75, '10 days', 'xatu'),
  ('Unown', 16, null, 3, 30, 7, 5, 7, 5, 5, 225, '20 days', 'unown'),
  ('Wobbuffet', 16, null, 3, 114, 3, 6, 3, 6, 3, 45, '10 days', 'wobbuffet'),
  ('Lugia', 16, 9, 5, 66, 9, 13, 9, 15, 11, 3, '60 days', 'lugia'),
  ('Celebi', 16, 11, 4, 60, 10, 10, 10, 10, 10, 45, '60 days', 'celebi'),
  ('Spoink', 16, null, 2, 36, 3, 4, 7, 8, 6, 255, '10 days', 'spoink'),
  ('Grumpig', 16, null, 2, 48, 5, 7, 9, 11, 8, 60, '10 days', 'grumpig'),
  ('Chimecho', 16, null, 2, 48, 5, 8, 10, 9, 7, 45, '12 days', 'chimecho'),
  ('Wynaut', 16, null, 3, 60, 2, 5, 2, 5, 2, 125, '10 days', 'wynaut'),
  ('Chingling', 16, null, 2, 30, 3, 5, 7, 5, 5, 120, '12 days', 'chingling'),
  ('Uxie', 16, null, 5, 48, 8, 13, 8, 13, 10, 3, '40 days', 'uxie'),
  ('Mesprit', 16, null, 5, 48, 11, 11, 11, 11, 8, 3, '40 days', 'mesprit'),
  ('Azelf', 16, null, 5, 48, 13, 7, 13, 7, 12, 3, '40 days', 'azelf'),
  ('Cresselia', 16, null, 5, 72, 7, 11, 8, 12, 9, 3, '60 days', 'cresselia'),
  ('Victini', 16, 8, 5, 60, 10, 10, 10, 10, 10, 3, '60 days', 'victini'),
  ('Woobat', 16, 9, 3, 42, 5, 4, 6, 4, 7, 190, '7 days', 'woobat'),
  ('Swoobat', 16, 9, 3, 42, 6, 6, 8, 6, 11, 45, '7 days', 'swoobat'),
  ('Sigilyph', 16, 9, 3, 42, 6, 8, 10, 8, 10, 45, '10 days', 'sigilyph'),
  ('Solosis', 16, null, 4, 30, 3, 4, 11, 5, 2, 200, '10 days', 'solosis'),
  ('Duosion', 16, null, 4, 42, 4, 5, 13, 6, 3, 100, '10 days', 'duosion'),
  ('Reuniclus', 16, null, 4, 66, 7, 8, 13, 9, 3, 50, '10 days', 'reuniclus'),
  ('Elgyem', 16, null, 3, 36, 6, 6, 9, 6, 3, 255, '10 days', 'elgyem'),
  ('Beheeyem', 16, null, 3, 48, 8, 8, 13, 10, 4, 90, '10 days', 'beheeyem'),
  ('Espurr', 16, null, 3, 36, 5, 5, 6, 6, 7, 190, '10 days', 'espurr'),
  ('Hoopa', 16, 10, 5, 48, 11, 6, 15, 13, 7, 3, '60 days', 'hoopa'),
  ('Cosmog', 16, null, 5, 24, 3, 3, 3, 3, 4, 45, '60 days', 'cosmog'),
  ('Cosmoem', 16, null, 5, 24, 3, 13, 3, 13, 4, 45, '60 days', 'cosmoem'),
  ('Solgaleo', 16, 18, 5, 84, 14, 11, 11, 9, 10, 45, '60 days', 'solgaleo'),
  ('Lunala', 16, 10, 5, 84, 11, 9, 14, 11, 10, 45, '60 days', 'lunala'),
  ('Necrozma', 16, null, 5, 60, 11, 10, 13, 9, 8, 255, '60 days', 'necrozma'),
  ('Hatenna', 16, null, 5, 24, 3, 5, 6, 5, 4, 235, '10 days', 'hatenna'),
  ('Hattrem', 16, null, 5, 36, 4, 7, 9, 7, 5, 120, '10 days', 'hattrem'),
  ('Hatterene', 16, 6, 5, 36, 9, 10, 14, 10, 3, 45, '10 days', 'hatterene'),
  ('Calyrex', 16, 11, 5, 60, 8, 8, 8, 8, 8, 3, '60 days', 'calyrex'),
  ('Flittle', 16, null, 4, 18, 4, 3, 6, 3, 8, 120, '10 days', 'flittle'),
  ('Espathra', 16, null, 4, 60, 6, 6, 10, 6, 11, 60, '10 days', 'espathra')
on conflict (name) do nothing;
