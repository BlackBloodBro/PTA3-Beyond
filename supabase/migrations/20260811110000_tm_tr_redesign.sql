-- Redesign of the Technical Machines catalog per the user's direct request, replacing the original
-- 7-row shape (3 TM tiers + 3 TR tiers + HM) from 20260808170000_items_technical_machines.sql:
-- - TM and TR collapse from 3 tier-specific rows each into one row each -- price is no longer fixed on
--   the catalog row, it's computed from whichever move is picked at buy/grant time (new
--   technical_machine_prices lookup below).
-- - HM is removed entirely (no longer a distinct item).
-- - Usage semantics flip from the original flavor text: TM is now infinitely reusable (never
--   consumed), TR is now used-3-times-then-spent (previously TM's "up to 3 times" line, now moved to
--   TR). Tracked per-item via the new trainers_items.uses_remaining column, same nullable-means-
--   unlimited convention as pokemon_moves.uses_remaining.
-- - Prices double the original per-tier values (4800/9800/16800 for TM, 2400/4900/8400 for TR).
delete from items_item_categories
where item_id in (select id from items where name in ('TM (At-Will)', 'TM (3/day)', 'TM (1/day)', 'TR (At-Will)', 'TR (3/day)', 'TR (1/day)', 'HM'));

delete from items
where name in ('TM (At-Will)', 'TM (3/day)', 'TM (1/day)', 'TR (At-Will)', 'TR (3/day)', 'TR (1/day)', 'HM');

insert into items (name, buyable, price, stackable, holdable, description)
values
  ('TM', true, null, false, false, 'Teaches a Pokémon a move at a Pokémon Center''s teaching device. Reusable indefinitely -- price depends on the move''s frequency, set when you pick it.'),
  ('TR', true, null, false, false, 'A lower-quality technical record. Teaches a Pokémon a move, but can only be used 3 times before it''s spent -- price depends on the move''s frequency, set when you pick it.');

insert into items_item_categories (item_id, item_category_id)
select i.id, c.id
from items i, item_categories c
where i.name in ('TM', 'TR') and c.name = 'Technical Machines';

-- Not stackable ([[items table]]: stackable=false above) -- each TM/TR now carries its own
-- uses_remaining state (for TR) once a move is attached, so a shared `quantity` across identical
-- copies would make consumption ambiguous. A second identical TM/TR is a no-op, same as any other
-- non-stackable item already behaves.
create table technical_machine_prices (
  item_id int not null references items(id) on delete cascade,
  frequency text not null,
  price int not null,
  primary key (item_id, frequency)
);

alter table technical_machine_prices enable row level security;
create policy "Public read access" on technical_machine_prices for select using (true);

insert into technical_machine_prices (item_id, frequency, price)
select i.id, v.frequency, v.price
from items i, (values
  ('At will', 9600),
  ('3/day', 19600),
  ('1/day', 33600)
) as v(frequency, price)
where i.name = 'TM';

insert into technical_machine_prices (item_id, frequency, price)
select i.id, v.frequency, v.price
from items i, (values
  ('At will', 4800),
  ('3/day', 9800),
  ('1/day', 16800)
) as v(frequency, price)
where i.name = 'TR';

-- Nullable, same convention as pokemon_moves.uses_remaining -- null means "not applicable / unlimited"
-- (every existing item, and TM specifically), a number counts down to 0 (TR starts at 3).
alter table trainers_items add column uses_remaining int;
