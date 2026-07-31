-- Prerequisites for the Pokemon detail page (mirrors the user's own Google Sheet example: species,
-- nickname, trainer, gender, shiny, type, size/weight (already on pokedex), nature, held item,
-- HP/temp HP, and a per-stat EV allocation).
--
-- EVs: a homebrew PTA3 rule (not derived from any existing table) -- every 8 levels a Pokemon
-- gains 1 EV point the trainer distributes freely; each of the 6 stats can hold at most 2 EVs;
-- 1 EV = +1 to that stat, except HP where 1 EV = +6. At level 100 a Pokemon has 12 EVs (100/8,
-- floored), enough to max all 6 stats at 2 EVs each. Stored as flat columns (one per stat) rather
-- than a join table, matching how trainers.attack/defense/etc. and pokedex.base_atk/base_def/etc.
-- are already modeled as fixed columns for this fixed set of 6 stats -- not a join table, since
-- there's no per-instance "which stats have EVs" set to enumerate, just a capped count per stat.
-- The number of AVAILABLE (unallocated) EVs is derived (floor(level / 8) - sum of ev_* columns),
-- not stored, same approach as the trainer milestone slot-counting pattern.
--
-- gender/is_shiny/held_item_id/temporary_hp: straightforward per-instance fields the sheet shows
-- that had no home yet. gender is unconstrained beyond the 3 real values since PTA3 doesn't model
-- species-locked gender ratios (e.g. always-genderless species) in any existing table.
alter table pokemon
  add column gender text check (gender in ('male', 'female', 'genderless')),
  add column is_shiny boolean not null default false,
  add column held_item_id int references items(id),
  add column temporary_hp int not null default 0,
  add column ev_hp int not null default 0 check (ev_hp between 0 and 2),
  add column ev_attack int not null default 0 check (ev_attack between 0 and 2),
  add column ev_defense int not null default 0 check (ev_defense between 0 and 2),
  add column ev_special_attack int not null default 0 check (ev_special_attack between 0 and 2),
  add column ev_special_defense int not null default 0 check (ev_special_defense between 0 and 2),
  add column ev_speed int not null default 0 check (ev_speed between 0 and 2);
