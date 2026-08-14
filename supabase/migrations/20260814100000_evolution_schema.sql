-- [[Add Evolution functionality]]: schema for the evolution mechanic resolved in Design.
--
-- sort_order lets evolution shift a GM's custom Size/Weight override by the same tier-delta as the
-- species defaults change (e.g. species default Medium -> Large is a +1 shift). Neither table had any
-- ordinal column before this -- only insertion-order `id`, which happened to already be in tier order
-- but was never a designed sort key. Variable gets no sort_order (null) -- it's a non-ordinal sentinel
-- ("varies"), not a real tier, and is excluded from the shift calculation entirely per Design.
alter table sizes add column sort_order int;
alter table weights add column sort_order int;

update sizes set sort_order = t.ord from (
  values ('Tiny', 1), ('Small', 2), ('Medium', 3), ('Large', 4), ('Huge', 5), ('Gigantic', 6)
) as t(name, ord) where sizes.name = t.name;

update weights set sort_order = t.ord from (
  values ('Featherweight', 1), ('Light', 2), ('Medium', 3), ('Heavy', 4), ('Superweight', 5)
) as t(name, ord) where weights.name = t.name;

-- Groups pokedex species into the same PokeAPI evolution chain -- lets the GM-override picker list
-- every other species in a Pokemon's chain (forward AND backward, including devolving) with one query:
-- `select * from pokedex where evolution_chain_id = X and id != current_id`. No other columns needed --
-- this table exists purely to be a shared id to group by. Species not part of any multi-member chain
-- (no evolution relationships at all) are left null -- nothing useful to group them with.
create table evolution_chains (
  id serial primary key
);

alter table pokedex add column evolution_chain_id int references evolution_chains(id);
create index on pokedex (evolution_chain_id);

-- One row per evolution edge (from_pokedex_id evolves into to_pokedex_id). A species can have multiple
-- outgoing edges (e.g. Eevee -> 8 different evolutions), each independently triggered.
--
-- trigger_type:
--   'level'   -- level_requirement is the Pokemon's computed level needed (PokeAPI min_level, and only
--                when min_level was the chain edge's ONLY condition -- see the import script's comments
--                for why edges with additional PokeAPI conditions, e.g. held-item/known-move/location/
--                gender, are NOT auto-imported as 'level' even though they also carry a min_level).
--   'loyalty' -- fixed at Loyalty 5 (this app's max tier), remapped from PokeAPI's min_happiness
--                friendship evolutions per Design -- this app has no Happiness stat to check instead.
--   'item'    -- item_id is one of the 10 existing Evolution Stone catalog items.
--   'other'   -- the edge is real (shown in the GM-override chain picker) but has no automatic trigger
--                this app can check -- trade evolutions, PokeAPI conditions with no in-app equivalent
--                (time-of-day, location, party species, non-stone items), or a level-up edge with
--                extra conditions beyond plain min_level. Reachable only via GM override, matching how
--                trade-only evolutions were already resolved in Design (GM override covers it, no
--                special-casing needed).
create table evolution_triggers (
  id serial primary key,
  from_pokedex_id int not null references pokedex(id),
  to_pokedex_id int not null references pokedex(id),
  trigger_type text not null check (trigger_type in ('level', 'loyalty', 'item', 'other')),
  level_requirement int,
  item_id int references items(id)
);

create index on evolution_triggers (from_pokedex_id);
