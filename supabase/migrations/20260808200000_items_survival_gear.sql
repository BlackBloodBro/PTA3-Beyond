-- Fill out the Items table, batch 10: Survival Gear. Source: PTA3PlayersHandbook.pdf page 200.
-- Flat category, no detail table -- same treatment as the last several batches. Minor grammar cleanup
-- on Blizzard Wear/Desert Gear's descriptions (source reads "Carefully made clothes for humans protect
-- them from..." missing a "that"/"which") -- a plain readability fix, not a content change. Diving
-- Gear's "refilled ... with a solar-powered tank" is almost certainly a source typo for "pump" (a tank
-- being refilled by another tank doesn't parse) -- corrected, same as prior batches' typo fixes.
insert into item_categories (name) values ('Survival Gear');

insert into items (name, item_category_id, buyable, price, description)
select v.name, c.id, true, v.price, v.description
from item_categories c,
(values
  ('Blizzard Wear', 1050, 'Carefully made clothes for humans that protect them from harmful hail and snowstorms. While worn, human trainers do not take damage from Hailing weather, whether made by a Pokémon or naturally occurring.'),
  ('Desert Gear', 1050, 'Carefully made clothes for humans that protect them from harmful sandstorms and desert winds. While worn, human trainers do not take damage from Sandstorming weather, whether made by a Pokémon or naturally occurring.'),
  ('Wet Suit', 750, 'Insulated body suit for diving in any waters, includes gloves and flippers. While worn, human trainers will not suffer damage in even arctic temperatures.'),
  ('Diving Gear', 1050, 'Self-contained underwater breathing apparatus. Allows a human to explore underwater with enough air to breathe for two hours. The tank can be refilled above water with a solar-powered pump in two hours.')
) as v(name, price, description)
where c.name = 'Survival Gear';
