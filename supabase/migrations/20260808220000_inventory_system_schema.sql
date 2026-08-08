-- Create Inventory System: schema layer. See "Create Inventory System" FR notes for the full
-- decision history -- this migration builds everything that FR's "New schema needed" list still
-- called for after items.price landed separately ("Fill out the Items table").

alter table trainers add column money int not null default 0;

alter table items add column stackable boolean not null default true;

-- Backfilled per-category rather than a flat default -- only the original "Held Items" category was
-- ever meant to be equippable, so `= true` for everything would need manual correction on 248 of the
-- 337 rows. This gets all of them right in one pass instead.
alter table items add column holdable boolean not null default true;
update items set holdable = false where item_category_id <> 1;

-- Multi-category items: an item can belong to more than one category (the Bag's category filter shows
-- an item under every category it belongs to). Replaces the single item_category_id FK.
create table items_item_categories (
  item_id int not null references items(id) on delete cascade,
  item_category_id int not null references item_categories(id) on delete cascade,
  unique (item_id, item_category_id)
);

alter table items_item_categories enable row level security;
create policy "Public read access" on items_item_categories for select using (true);

insert into items_item_categories (item_id, item_category_id)
select id, item_category_id from items;

alter table items drop column item_category_id;

-- Category-specific detail table, same pattern as pokeball_catch_modifiers/berries from "Fill out the
-- Items table" -- only items that actually grant a stat boost get a row, no more NULLs on `items` for
-- non-boosting items.
create table held_item_boosts (
  item_id int primary key references items(id) on delete cascade,
  boosted_type_id int not null references types(id),
  boost_amount int not null
);

alter table held_item_boosts enable row level security;
create policy "Public read access" on held_item_boosts for select using (true);

insert into held_item_boosts (item_id, boosted_type_id, boost_amount)
select id, boosted_type_id, boost_amount from items where boosted_type_id is not null;

alter table items drop column boosted_type_id;
alter table items drop column boost_amount;
