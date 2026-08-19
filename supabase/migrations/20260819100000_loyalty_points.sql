-- [[Add a Loyalty editor]]: pokemon.loyalty_id (a GM-picked force-a-tier FK) is replaced with an
-- accumulating loyalty_points ("LP") counter, mirroring how pokemon.level was dropped in favor of
-- always-computed-from-exp. The tier a Pokemon sits at is now always derived from LP via
-- computeLoyaltyTier, never stored/force-set directly.

-- sort_order gives loyalties a real ordinal column -- isMaxLoyalty used to fragile-match on
-- `name = '5'`, the same gap the Evolution FR's sizes/weights sort_order columns already fixed for
-- those tables. min_points is the LP threshold to reach that tier (points-to-tier lookup needs a
-- real ordering to work at all).
alter table loyalties add column sort_order int;
alter table loyalties add column min_points int;

update loyalties set sort_order = t.ord, min_points = t.pts from (
  values ('0', 0, 0), ('1', 1, 5), ('2', 2, 12), ('3', 3, 25), ('4', 4, 45), ('5', 5, 80)
) as t(name, ord, pts) where loyalties.name = t.name;

alter table loyalties alter column sort_order set not null;
alter table loyalties alter column min_points set not null;

-- Dead weight -- confirmed via full repo grep that no application code reads exp_modifier,
-- breeding_modifier, or breeding_modifiers. Dropped while this table is already being migrated,
-- per Design, rather than left to rot further.
alter table loyalties drop column exp_modifier;
alter table loyalties drop column breeding_modifier;
drop table breeding_modifiers;

-- loyalty_points replaces loyalty_id. Existing Pokemon backfill to 0 (bottom tier) via the column
-- default -- a clean reset, not an attempt to reconstruct history that never existed, per Design.
alter table pokemon add column loyalty_points int not null default 0;
alter table pokemon drop column loyalty_id;

-- Tunable per-event LP deltas live in data, not code -- matches the existing small-reference-table
-- idiom (obtain_methods, growth_rates, etc.) rather than hardcoded constants, per Design. First-pass,
-- unplaytested balance numbers -- easy to retune later since they're plain data, not logic.
create table loyalty_point_events (
  id serial primary key,
  name text not null unique,
  points int not null
);

insert into loyalty_point_events (name, points) values
  ('Sleep', 1),
  ('Pokemon Center (damaged)', 1),
  ('Fainted', -3);

alter table loyalty_point_events enable row level security;
create policy "Public read access" on loyalty_point_events for select using (true);
