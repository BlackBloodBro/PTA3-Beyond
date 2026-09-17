-- Per the user: "Tropius (Ancient)" (global pokedex id 677) shouldn't be in the global Pokedex.
-- Confirmed unused before removing -- zero real Pokemon (pokemon.pokedex_id), eggs
-- (pokemon_eggs/trainers_items.pokedex_id), evolution links (evolution_triggers), or
-- campaign_scanned_species rows reference it. Its own six relation-table rows
-- (pokedex_habitats/moves/passives/proficiencies/diets/egg_groups) cascade away with it.
delete from pokedex where id = 677 and name = 'Tropius (Ancient)' and campaign_id is null;
