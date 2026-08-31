-- [[Let a GM override a Pokemon's individual base stats]]: additive bonus columns, not nullable
-- replacement overrides like Type/Size/Weight -- a Pokemon's effective base stat is always
-- `species.base_x + pokemon.bonus_base_x`. Not nullable: 0 is the natural "no change" default for
-- an additive number. Chosen over a replacement override specifically so the Breeder class's
-- eventual per-hatch permanent stat increase (a repeated, incremental write) composes cleanly with
-- this schema later -- that mechanic itself is out of scope here.

alter table pokemon
  add column bonus_base_hp int not null default 0,
  add column bonus_base_atk int not null default 0,
  add column bonus_base_def int not null default 0,
  add column bonus_base_sp_atk int not null default 0,
  add column bonus_base_sp_def int not null default 0,
  add column bonus_base_speed int not null default 0;
