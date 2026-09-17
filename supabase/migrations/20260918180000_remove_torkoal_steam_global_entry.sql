-- Per the user: "Torkoal (Steam)" (global pokedex id 674) shouldn't be in the global Pokedex, same
-- kind of request as the "Tropius (Ancient)" removal (20260918170000). Confirmed unused before
-- removing -- zero real Pokemon (pokemon.pokedex_id), eggs
-- (pokemon_eggs/trainers_items.pokedex_id), evolution links (evolution_triggers), or
-- campaign_scanned_species rows reference it. Its own six relation-table rows
-- (pokedex_habitats/moves/passives/proficiencies/diets/egg_groups) cascade away with it.
delete from pokedex where id = 674 and name = 'Torkoal (Steam)' and campaign_id is null;
