-- [[Feature - Add a Pokemon Breeding Check mechanic]]: a bred Egg carries a pre-chosen nature (randomly
-- one of the two parents', not the usual fully-random roll a hatched Pokemon otherwise gets) -- needs
-- somewhere to sit on the Egg item until [[Feature - Add Egg hatching logic]] applies it at hatch time.
-- Same nullable-attachment shape as trainers_items.move_id/pokedex_id (already used for TM/TR and Eggs
-- respectively) -- an Egg either carries a pre-chosen nature (bred) or doesn't (GM-granted blank Egg,
-- gets the normal random roll at hatch).
alter table trainers_items add column nature_id int references natures(id);
