-- [[Bug report]]: "Sandshrew (Ice)"/"Sandslash (Ice)" (pokedex 572/573, this app's Alolan Sandshrew/
-- Sandslash) never matched PokeAPI's real "sandshrew-alola"/"sandslash-alola" entries during the
-- original import (custom parenthetical naming, same gap already found for Arcanine (Ancient) etc.) --
-- both ended up with a thin, hand-curated move list, every row wrongly flagged `level_learned = null`
-- ("always known/TM-eligible") instead of real per-level data.
--
-- Sandshrew (Ice) is corrected here to its real Alolan Sandshrew level-up learnset (verified directly
-- against PokeAPI's raw sun-moon/ultra-sun-ultra-moon data, 2026-09-21). 3 of its 17 real level-up
-- moves -- Defense Curl, Iron Defense, Swords Dance -- are modeled as Passives in this app, not Moves
-- (confirmed against the `passives` table), so those 3 are fixed in pokedex_passives instead, below.
--
-- Sandslash (Ice)'s Moves/Passives are then derived entirely from Sandshrew (Ice)'s own corrected
-- learnset, per the user's own rule (2026-09-21): every Move/Passive Sandshrew learns by leveling is
-- also learnable by Sandslash by leveling, at Sandshrew's own level + 3 -- replacing whatever Sandslash
-- previously had, rather than layering this on top of separately-sourced "real" Alolan-Sandslash-only
-- moves (which would reintroduce the same fragile-PokeAPI-archaeology problem this fix is getting away
-- from).

-- Moves: replace both species' rows entirely.
delete from pokedex_moves where pokedex_id in (572, 573);

insert into pokedex_moves (pokedex_id, move_id, level_learned)
select 572, m.id, v.level
from moves m
join (values
  ('Scratch', 1), ('Bide', 3), ('Powder snow', 5), ('Ice ball', 7), ('Rapid spin', 9),
  ('Fury cutter', 11), ('Metal claw', 14), ('Swift', 17), ('Fury swipes', 20), ('Slash', 26),
  ('Iron head', 30), ('Gyro ball', 34), ('Hail', 42), ('Blizzard', 46)
) as v(name, level) on m.name = v.name
where m.campaign_id is null;

insert into pokedex_moves (pokedex_id, move_id, level_learned)
select 573, m.id, v.level + 3
from moves m
join (values
  ('Scratch', 1), ('Bide', 3), ('Powder snow', 5), ('Ice ball', 7), ('Rapid spin', 9),
  ('Fury cutter', 11), ('Metal claw', 14), ('Swift', 17), ('Fury swipes', 20), ('Slash', 26),
  ('Iron head', 30), ('Gyro ball', 34), ('Hail', 42), ('Blizzard', 46)
) as v(name, level) on m.name = v.name
where m.campaign_id is null;

-- Passives: Sandshrew's "Defense curl" was already correctly at level 1 -- add the 2 it was missing
-- (Iron defense at 23, Swords dance at 38). Sandslash had both at the wrong level (1, inherited
-- verbatim instead of shifted) and was missing Defense curl entirely -- replace all 3 with the
-- Sandshrew-derived, +3-shifted values. Ability-type passives (Snow cloak, Burrow, Freezer, Slush
-- rush) are untouched -- unrelated to this fix.
insert into pokedex_passives (pokedex_id, passive_id, level_learned)
select 572, p.id, 23 from passives p where p.name = 'Iron defense'
union all
select 572, p.id, 38 from passives p where p.name = 'Swords dance'
on conflict (pokedex_id, passive_id) do update set level_learned = excluded.level_learned;

delete from pokedex_passives
where pokedex_id = 573
  and passive_id in (select id from passives where name in ('Iron defense', 'Swords dance'));

insert into pokedex_passives (pokedex_id, passive_id, level_learned)
select 573, p.id, 4 from passives p where p.name = 'Defense curl'
union all
select 573, p.id, 26 from passives p where p.name = 'Iron defense'
union all
select 573, p.id, 41 from passives p where p.name = 'Swords dance'
on conflict (pokedex_id, passive_id) do update set level_learned = excluded.level_learned;
