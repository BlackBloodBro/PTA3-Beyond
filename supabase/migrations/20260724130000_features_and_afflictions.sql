-- Resolves two of the open items from the initial schema:
--
-- 1. Features unlock automatically from a trainer's class + level (not individually picked), so instead
--    of a trainers_features join table, features gets class_id/subclass_id/level_required and trainers
--    gets a level column. "Which features are active" is a derived query, not stored state:
--      select * from features
--      where features.class_id = trainers.class_id
--        and features.level_required <= trainers.level
--        and (features.subclass_id is null or features.subclass_id = trainers.subclass_id)
--
-- 2. Afflictions now affect stats and are tracked as live per-Pokemon state:
--    - afflictions_stats: reference<->reference (which stat an affliction modifies, and by how much)
--    - pokemon_afflictions: active data (which afflictions are currently on a specific owned Pokemon)
--
-- (Catch_modifiers_* tables confirmed as lookup-only; no schema change needed.)

alter table trainers
  add column level int not null default 1 references levels(level_number);

-- ASSUMPTION: subclass_id is nullable so a feature can apply to the whole class (null) or be
-- gated to one specific subclass. Not enforced: that subclass_id's parent class matches class_id.
alter table features
  add column class_id int not null references classes(id),
  add column subclass_id int references subclasses(id),
  add column level_required int not null default 1;

create index on features (class_id);
create index on features (subclass_id);

create table afflictions_stats (
  affliction_id int not null references afflictions(id) on delete cascade,
  stat_id int not null references stats(id) on delete cascade,
  modifier int not null,
  primary key (affliction_id, stat_id)
);

create index on afflictions_stats (stat_id);

create table pokemon_afflictions (
  pokemon_id uuid not null references pokemon(id) on delete cascade,
  affliction_id int not null references afflictions(id) on delete cascade,
  applied_at timestamptz not null default now(),
  primary key (pokemon_id, affliction_id)
);

create index on pokemon_afflictions (affliction_id);

-- RLS: afflictions_stats is reference<->reference (public read, service-role write, same as the
-- other reference relationship tables). pokemon_afflictions is active data scoped to the owning
-- trainer, same pattern as pokemon_moves.

alter table afflictions_stats enable row level security;

create policy "Public read access" on afflictions_stats
  for select using (true);

alter table pokemon_afflictions enable row level security;

create policy "Owner manages pokemon_afflictions" on pokemon_afflictions
  for all using (
    exists (
      select 1 from trainers_pokemon tp
      join trainers t on t.id = tp.trainer_id
      where tp.pokemon_id = pokemon_afflictions.pokemon_id and t.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from trainers_pokemon tp
      join trainers t on t.id = tp.trainer_id
      where tp.pokemon_id = pokemon_afflictions.pokemon_id and t.user_id = auth.uid()
    )
  );
