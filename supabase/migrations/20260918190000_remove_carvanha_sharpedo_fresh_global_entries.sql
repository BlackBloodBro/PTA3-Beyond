-- Per the user: "Carvanha (Fresh)" and "Sharpedo (Fresh)" (global pokedex ids 675/676) shouldn't be in
-- the global Pokedex, same kind of request as the "Tropius (Ancient)"/"Torkoal (Steam)" removals
-- (20260918170000/20260918180000). Confirmed unused before removing -- zero real Pokemon
-- (pokemon.pokedex_id), eggs (pokemon_eggs/trainers_items.pokedex_id), or campaign_scanned_species
-- rows reference either. The only evolution_triggers row involving them is self-contained between the
-- two (Carvanha (Fresh) -> Sharpedo (Fresh)), so it's deleted here rather than orphaned -- that FK has
-- no on-delete action, so it must go before the pokedex rows themselves.
delete from evolution_triggers where from_pokedex_id in (675, 676) or to_pokedex_id in (675, 676);

delete from pokedex where id = 675 and name = 'Carvanha (Fresh)' and campaign_id is null;
delete from pokedex where id = 676 and name = 'Sharpedo (Fresh)' and campaign_id is null;
