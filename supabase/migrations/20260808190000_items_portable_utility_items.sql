-- Fill out the Items table, batch 9: Portable Utility Items. Source: PTA3PlayersHandbook.pdf page 200.
-- Flat category, no detail table -- same "descriptive text only" treatment as the last few batches.
--
-- "Portable Berry Planter" is the item batch 5 (Berries) deliberately deferred here -- that chapter
-- only mentioned "Berry Planter" in passing (2800P, no mechanics given), pointing at this section for
-- the real writeup. This is that real writeup, so the earlier deferral is now resolved.
insert into item_categories (name) values ('Portable Utility Items');

insert into items (name, item_category_id, buyable, price, description)
select v.name, c.id, true, v.price, v.description
from item_categories c,
(values
  ('Egg Incubator', 1350, 'Electronic, reusable container that safely keeps and warms a Pokémon egg. Once charged over 4 hours, lasts for weeks to keep the egg safe and warm for healthy hatching. Can be dropped from up to 100 ft or submerged in water without harming the egg. Heavy, but easier than carrying an egg around in your arms. 15 lbs. 16x8x8 in. 4ft strap. (Carrying two in a backpack is a tight squeeze, but fine.)'),
  ('Folding Bicycle', 950, 'A 3-speed bike that folds onto itself. Wheels are 26 in. Unfolded, its frame length and height are 48x40 in. Telescoping handles and seat adjust for any person''s height. 25 lbs. 30x30x6 in. when folded.'),
  ('Portable Berry Planter', 2800, 'Planting a berry inside creates a mini-ecosystem for it to rapidly grow into a fruit-bearing shrub. Roll a Nature skill check when planting, then once per day for the next 5 days while watering it. If you ever roll under 6, the shrub yields 1 berry when it fruits; if you roll over 5 every time, it yields 2; if you ever roll over 20 without ever rolling under 6, it yields 3. Failing to water the shrub at least once per day, or harvesting its berries, kills the shrub. 3 lbs. 2x1x1 ft. 4ft strap.'),
  ('Solar Charger', 50, 'An unfolding solar panel that charges devices -- phones, computers, or other portable items. Does not hold a charge itself, only charges other things.')
) as v(name, price, description)
where c.name = 'Portable Utility Items';
