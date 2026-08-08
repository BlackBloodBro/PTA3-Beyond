-- Fill out the Items table, batch 1: Poké Balls. Source: PTA3PlayersHandbook.pdf pages 188-189.
--
-- items.price didn't exist before this -- adding it now since it's real, structured PDF data every
-- item has, not just flavor text. Nullable/non-negative per Create Inventory System's already-decided
-- shape (its own Notes call this out as needed for the future shop), built ahead of that FR landing.
alter table items add column price int check (price >= 0);

-- Catch modifiers are heterogeneous (some conditional on battle state, a couple with two thresholds),
-- so this stores the primary numeric modifier plus a free-text condition -- matches this app's
-- "nothing auto-applies effects" convention elsewhere (e.g. move damage tooltips, held item text).
-- Deliberately NOT linking to the pre-existing catch_modifiers_ball table (name/modifier/description,
-- no item_id) -- see "Fill out the Items table" FR Notes (2026-08-03) for the full reasoning: this
-- table needs to be item_id-keyed so a future GM-custom Poké Ball's catch data can work the same way
-- as a catalog one, which catch_modifiers_ball was never shaped to support.
create table pokeball_catch_modifiers (
  item_id int primary key references items(id) on delete cascade,
  modifier int not null,
  condition text
);

alter table pokeball_catch_modifiers enable row level security;
create policy "Public read access" on pokeball_catch_modifiers for select using (true);

insert into item_categories (name) values ('Poké Balls');

insert into items (name, item_category_id, buyable, price, description)
select v.name, c.id, v.buyable, v.price, v.description
from item_categories c,
(values
  ('Basic Ball', true, 100, null),
  ('Great Ball', true, 600, null),
  ('Ultra Ball', true, 1000, null),
  ('Master Ball', false, null, 'Nearly impossible to find -- only two are said to be produced world wide per year. Can and will often fail when thrown at legendary Pokémon.'),
  ('Park Ball', true, 550, null),
  ('Safari Ball', true, 550, null),
  ('Sport Ball', true, 550, 'These luxury Poké Balls encourage friendly partnerships even with freshly caught Pokémon. High-end items, different looks for a personal touch.'),
  ('Cherish Ball', true, 1500, 'Captured Pokémon are more easily befriended.'),
  ('Luxury Ball', true, 1500, 'Captured Pokémon are more easily befriended.'),
  ('Premier Ball', true, 1500, 'Captured Pokémon are more easily befriended. Many Poké Marts hold promotions to give away 1 Premier Ball for free for large purchases of other Poké Balls.'),
  ('Dive Ball', true, 1250, null),
  ('Dusk Ball', true, 1150, null),
  ('Fast Ball', true, 1250, null),
  ('Lure Ball', true, 1250, null),
  ('Quick Ball', true, 1550, null),
  ('Repeat Ball', true, 1250, null),
  ('Timer Ball', true, 1550, null),
  ('Friend Ball', true, 1000, 'Captured Pokémon are more easily befriended.'),
  ('Heal Ball', true, 1000, 'Captured Pokémon are healed 20 hit points.'),
  ('Dream Ball', true, 1250, null),
  ('Heavy Ball', true, 1250, null),
  ('Level Ball', true, 1250, null),
  ('Love Ball', true, 1250, null),
  ('Moon Ball', true, 1250, null),
  ('Nest Ball', true, 1250, null),
  ('Net Ball', true, 1250, null)
) as v(name, buyable, price, description)
where c.name = 'Poké Balls';

insert into pokeball_catch_modifiers (item_id, modifier, condition)
select i.id, v.modifier, v.condition
from items i,
(values
  ('Basic Ball', 5, null),
  ('Great Ball', 0, null),
  ('Ultra Ball', -5, null),
  ('Master Ball', -100, null),
  ('Park Ball', -20, 'Against domesticated wild Pokémon.'),
  ('Safari Ball', -20, 'Against domesticated wild Pokémon.'),
  ('Sport Ball', -20, 'Against domesticated wild Pokémon.'),
  ('Cherish Ball', -5, null),
  ('Luxury Ball', -5, null),
  ('Premier Ball', -5, null),
  ('Dive Ball', -12, 'If the Pokémon is in water.'),
  ('Dusk Ball', -7, 'If it''s night time (no sunlight).'),
  ('Fast Ball', -8, 'On a Pokémon that acts before your Pokémon.'),
  ('Lure Ball', -10, 'If you lured the wild Pokémon into combat.'),
  ('Quick Ball', -20, 'If thrown as your first action during combat.'),
  ('Repeat Ball', -10, 'If the Pokémon already had a Poké Ball thrown at it this encounter.'),
  ('Timer Ball', -10, 'If the encounter has lasted at least one minute; -25 instead if it has lasted at least two minutes.'),
  ('Friend Ball', 0, null),
  ('Heal Ball', 0, null),
  ('Dream Ball', -10, 'If the Pokémon is afflicted.'),
  ('Heavy Ball', -15, 'If the Pokémon is Heavy or Superweight.'),
  ('Level Ball', -10, 'If the Pokémon can evolve, but is not evolved.'),
  ('Love Ball', -10, 'If the target is the opposite sex of your Pokémon.'),
  ('Moon Ball', -10, 'If the Pokémon evolves with an evolution stone.'),
  ('Nest Ball', -10, 'If the Pokémon can evolve, but is not evolved.'),
  ('Net Ball', -15, 'When used against a Bug or Water type Pokémon.')
) as v(name, modifier, condition)
where i.name = v.name;
