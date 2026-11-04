-- [[Feature - Craft a free Repel each Sleep on Repel crafting (Researcher)]]: a Researcher with "Repel
-- crafting" and a Portable Chemistry Set wakes up from every Sleep with exactly one homemade Repel.
-- This adds that item: a non-buyable clone of Repel (same Combat Enhancers category), so it can only ever
-- come from the Feature. The Sleep logic itself lives in restSleep.
insert into items (name, buyable, price, stackable, holdable, description)
select 'Repel (handmade)', false, null, true, false,
  'A homemade Repel from the Researcher''s Repel crafting. Wild Pokémon find the smell repulsive for one hour after applied, but may ignore it to protect something precious to them. It loses its potency by the next morning, so use it before you Sleep.'
where not exists (select 1 from items where name = 'Repel (handmade)' and campaign_id is null);

insert into items_item_categories (item_id, item_category_id)
select i.id, c.id
from items i, item_categories c
where i.name = 'Repel (handmade)' and i.campaign_id is null and c.name = 'Combat Enhancers'
  and not exists (
    select 1 from items_item_categories where item_id = i.id and item_category_id = c.id
  );

-- The original text promised "one hour of work", naming the concoction and a 24-hour shelf life -- none of
-- which this app tracks. Rewritten to describe what actually happens: Sleep stands in for both timers.
update features
set description = 'Advanced study of chemistry and an expansive knowledge of Pokémon lets you craft concoctions repulsive to unfriendly Pokémon. As long as you have a Portable Chemistry Set, part of your Sleep goes to crafting a Repel -- you wake up with exactly one homemade Repel, replacing yesterday''s whether you used it or not, since it loses its potency by morning if left unused.'
where name = 'Repel crafting'
  and class_id = (select id from classes where name = 'Researcher');
