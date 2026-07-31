-- Prerequisites for the trainer detail page.

-- Cross-Classing: trainers can hold up to 3 Advanced Classes (subclasses) simultaneously.
-- Per-class levels are not persisted (per user direction) -- derivable from the trainer's overall
-- level once Cross Classing rules (Player's Handbook p.89, not yet extracted) are implemented.
alter table trainers
  add column advanced_class_1_id int references subclasses(id),
  add column advanced_class_2_id int references subclasses(id),
  add column advanced_class_3_id int references subclasses(id);

alter table trainers add column temporary_hp int not null default 0;

-- The 1-6 stat range was creation-time only (point buy), not a permanent invariant -- stats grow
-- through leveling (e.g. the example level-5 trainer sheet shows Attack 7). The 1-6 range is
-- still validated in the creation Server Action; dropping it here since it's not a lasting truth.
alter table trainers drop constraint trainers_attack_check;
alter table trainers drop constraint trainers_defense_check;
alter table trainers drop constraint trainers_special_attack_check;
alter table trainers drop constraint trainers_special_defense_check;
alter table trainers drop constraint trainers_speed_check;

-- Reference: the 18 trainer skills, each tied to the stat that provides its modifier.
-- Talented/Expert tier tracking (the +2/+5 bonus system) is deferred for now -- skills only
-- expose their base stat modifier until that's built.
create table skills (
  id serial primary key,
  name text not null unique,
  stat_id int not null references stats(id)
);

alter table skills enable row level security;
create policy "Public read access" on skills for select using (true);

-- Active data: which moves a trainer currently knows. Trainers can attack directly (Tackle by
-- default, more granted via class features like "Sync move"), and some classes can learn many
-- moves, so this needs to be an explicit table, mirroring pokemon_moves.
create table trainer_moves (
  trainer_id uuid not null references trainers(id) on delete cascade,
  move_id int not null references moves(id) on delete cascade,
  uses_remaining int,
  resets_on text check (resets_on in ('turn', 'encounter', 'rest')),
  primary key (trainer_id, move_id)
);

create index on trainer_moves (move_id);

alter table trainer_moves enable row level security;
create policy "Owner manages trainer_moves" on trainer_moves
  for all using (
    exists (select 1 from trainers t where t.id = trainer_moves.trainer_id and t.user_id = auth.uid())
  ) with check (
    exists (select 1 from trainers t where t.id = trainer_moves.trainer_id and t.user_id = auth.uid())
  );
