-- "Get Talents locked in" -- the Handbook's Talented/Expert skill-check bonus system (p.6, p.13-89,
-- p.90-99). Being Talented in a Skill adds +2 to d20 rolls for that skill; a second pick of the same
-- skill (from a different source) upgrades it to Expert, +5; a skill can't be picked a third time.
--
-- Classes and Advanced Classes are simple -- each is one flat "choose N from this list" (N is a
-- constant per source type: always 2 for a Class, always 1 for an Advanced Class -- not stored,
-- enforced in app code). Origins are not uniformly "choose N from one list": reading every Origin's
-- printed Skill Talent text turned up two shapes that don't fit that -- a few Origins grant a
-- mandatory skill plus a separate "choose 1 more" from a different list (Artist/Entertainer: Perform
-- + choose one; Doctor: Medicine + choose one), and Athlete grants two independent 1-of-N picks from
-- two different small lists rather than "choose 2" from one pool. Modeling Origins as one or more
-- *groups*, each with its own pick_count and its own eligible-skill list, covers every real shape
-- without special-casing: a mandatory skill is just a group of size 1 (pick_count 1, one option), a
-- normal Origin is a single group, Athlete is two groups, Raring to Go ("choose any one skill") is a
-- single group whose options are all 18 skills, and Trust Funded (no picks at all) simply has zero
-- groups.

-- Classes: pick 2 (always), from this flat list.
create table classes_skill_talents (
  class_id int not null references classes(id) on delete cascade,
  skill_id int not null references skills(id) on delete cascade,
  primary key (class_id, skill_id)
);

alter table classes_skill_talents enable row level security;
create policy "Public read access" on classes_skill_talents for select using (true);

-- Advanced Classes: pick 1 (always), from this flat list.
create table subclasses_skill_talents (
  subclass_id int not null references subclasses(id) on delete cascade,
  skill_id int not null references skills(id) on delete cascade,
  primary key (subclass_id, skill_id)
);

alter table subclasses_skill_talents enable row level security;
create policy "Public read access" on subclasses_skill_talents for select using (true);

-- Origins: one or more pick-groups, each with its own pick_count and its own eligible-skill list --
-- see the file header for why this shape (not a flat per-Origin list) is needed.
create table origins_skill_talent_groups (
  id serial primary key,
  origin_id int not null references origins(id) on delete cascade,
  pick_count int not null check (pick_count > 0),
  sort_order int not null default 0
);

create index on origins_skill_talent_groups (origin_id);

alter table origins_skill_talent_groups enable row level security;
create policy "Public read access" on origins_skill_talent_groups for select using (true);

create table origins_skill_talent_group_options (
  group_id int not null references origins_skill_talent_groups(id) on delete cascade,
  skill_id int not null references skills(id) on delete cascade,
  primary key (group_id, skill_id)
);

alter table origins_skill_talent_group_options enable row level security;
create policy "Public read access" on origins_skill_talent_group_options for select using (true);

-- Active data: which Skills a Trainer has actually picked as Talents, and how many times (1 =
-- Talented/+2, 2 = Expert/+5 -- derived at read time from picked_count, not stored redundantly).
-- Sourced across up to 3 different grant points (base Class at creation, Origin at creation, each
-- Advanced Class taken during level-up), which is exactly why this is its own trainer_id/skill_id
-- table rather than three separate per-source tables -- the "max 2 picks total, across every source"
-- cap has to be checked against one combined picture, not three disjoint ones.
create table trainer_skill_talents (
  trainer_id uuid not null references trainers(id) on delete cascade,
  skill_id int not null references skills(id) on delete cascade,
  picked_count int not null check (picked_count in (1, 2)),
  primary key (trainer_id, skill_id)
);

create index on trainer_skill_talents (skill_id);

alter table trainer_skill_talents enable row level security;

-- Same owner-or-campaign-GM manage pattern as trainer_feature_uses/trainer_milestones.
create policy "Owner manages trainer_skill_talents" on trainer_skill_talents
  for all using (
    exists (select 1 from trainers t where t.id = trainer_skill_talents.trainer_id and t.user_id = auth.uid())
  ) with check (
    exists (select 1 from trainers t where t.id = trainer_skill_talents.trainer_id and t.user_id = auth.uid())
  );

create policy "GM manages campaign trainer_skill_talents" on trainer_skill_talents
  for all using (is_campaign_gm_for_trainer(trainer_id)) with check (is_campaign_gm_for_trainer(trainer_id));
