-- Lets a GM override an individual Pokemon's Type(s), Size, and Weight away from its species
-- (pokedex) default -- e.g. a wild Pokemon that's unusually large, or was retyped by some in-game
-- effect. Nullable: null means "use the species default", exactly like held_item_id already works
-- for "no item held" (except here null falls back to a value rather than meaning "none").
--
-- type_2_id specifically only supports override-or-species-default, not a third "force mono-type"
-- state -- a GM can't use this to strip a naturally dual-type species down to one type. Adding that
-- would need a real tri-state (unset / explicit-none / explicit-type) which nothing here asked for.
alter table pokemon add column type_1_id int references types(id);
alter table pokemon add column type_2_id int references types(id);
alter table pokemon add column size_id int references sizes(id);
alter table pokemon add column weight_id int references weights(id);
