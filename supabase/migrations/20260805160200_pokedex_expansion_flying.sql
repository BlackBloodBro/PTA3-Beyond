-- Flying-type (primary type) Pokedex expansion, batch 5 of the 'Fill out the
-- Pokedex more' FR. Same sourcing/methodology as batch 1 (Ground, 20260805130000) -- see that
-- migration's header and the README's 'Pokedex expansion' section for the full formula writeup.
--
-- size_id, weight_id, description left null; Proficiencies/Habitats/Diets get no rows -- no
-- reliable PokeAPI derivation, confirmed during Design.
--
-- COVERAGE: 5 of 72 Flying-type-membership candidates matched. 67 excluded because Flying turned out to be their secondary, not primary, type: Pidgey (Normal), Pidgeotto (Normal), Pidgeot (Normal), Spearow (Normal), Fearow (Normal), Farfetchd (Normal), Doduo (Normal), Dodrio (Normal), Scyther (Bug), Aerodactyl (Rock), Articuno (Ice), Moltres (Fire), Dragonite (Dragon), Hoothoot (Normal), Noctowl (Normal), Ledyba (Bug), Ledian (Bug), Togetic (Fairy), Natu (Psychic), Xatu (Psychic), Yanma (Bug), Murkrow (Dark), Mantine (Water), Skarmory (Steel), Lugia (Psychic), Beautifly (Bug), Taillow (Normal), Swellow (Normal), Wingull (Water), Pelipper (Water), Masquerain (Bug), Ninjask (Bug), Salamence (Dragon), Rayquaza (Dragon), Starly (Normal), Staravia (Normal), Staraptor (Normal), Mothim (Bug), Combee (Bug), Vespiquen (Bug), Drifloon (Ghost), Drifblim (Ghost), Honchkrow (Dark), Chatot (Normal), Mantyke (Water), Togekiss (Fairy), Yanmega (Bug), Pidove (Normal), Tranquill (Normal), Unfezant (Normal), Woobat (Psychic), Swoobat (Psychic), Sigilyph (Psychic), Archen (Rock), Archeops (Rock), Ducklett (Water), Swanna (Water), Rufflet (Normal), Braviary (Normal), Vullaby (Dark), Mandibuzz (Dark), Hawlucha (Fighting), Yveltal (Dark), Pikipek (Normal), Trumbeak (Normal), Toucannon (Normal), Celesteela (Steel).

insert into pokedex (name, type_1_id, type_2_id, growth_rate_id, base_hp, base_atk, base_def, base_sp_atk, base_sp_def, base_speed, catch_rate, egg_hatch_rate, sprite_code) values
  ('Noibat', 9, 4, 3, 24, 3, 4, 5, 4, 6, 190, '10 days', 'noibat'),
  ('Noivern', 9, 4, 3, 54, 7, 8, 10, 8, 12, 45, '10 days', 'noivern'),
  ('Cramorant', 9, 19, 3, 42, 9, 6, 9, 10, 9, 45, '10 days', 'cramorant'),
  ('Bombirdier', 9, 3, 5, 42, 10, 9, 6, 9, 8, 25, '17 days', 'bombirdier'),
  ('Flamigo', 9, 7, 4, 48, 12, 7, 8, 6, 9, 100, '10 days', 'flamigo')
on conflict (name) do nothing;
