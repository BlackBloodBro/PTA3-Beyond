-- Add Eggs as Item: new dedicated "Eggs" category (same precedent as Evolution Stones/Technical
-- Machines each getting their own small category rather than folding into "Goods"), one "Egg" item.
--
-- Not buyable: confirmed via the 337-row catalog (Fill out the Items table) that no canonical Egg
-- price exists anywhere in the source material, unlike every other catalog item which was priced
-- straight from the Handbook. Rather than inventing a number, this follows the HM precedent
-- (buyable = false, price = null) -- a GM-granted item, not a shop purchase.
insert into item_categories (name) values ('Eggs');

insert into items (name, buyable, price, stackable, holdable, description)
select 'Egg', false, null, true, false,
  'An unhatched Pokémon Egg. When selected, choose which species it will hatch into.'
where not exists (select 1 from items where name = 'Egg');

insert into items_item_categories (item_id, item_category_id)
select i.id, c.id
from items i, item_categories c
where i.name = 'Egg' and c.name = 'Eggs'
  and not exists (
    select 1 from items_item_categories where item_id = i.id and item_category_id = c.id
  );
