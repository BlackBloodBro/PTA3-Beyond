-- [[Improvement - Move Trainer editing (Name, Origin, Talents, Stats) to the build page]]: lets the
-- build page re-pick a Trainer's base Class/Origin Skill Talents after creation (previously only
-- settable once, at creation, via TrainerForm) and lets a Class/Origin change force those specific
-- picks to be released and re-chosen. trainer_skill_talents only tracks a combined picked_count
-- across every source (base Class, base Origin, each Advanced Class milestone) with no way to tell a
-- base pick apart from a milestone-granted one -- trainer_milestones already has its own
-- talent_skill_id/bonus_talent_skill_id for the milestone sources (see
-- 20260902110000_milestone_talent_skill.sql); this is the equivalent per-source record for the two
-- sources milestones don't cover.
create table trainer_base_skill_talents (
  trainer_id uuid not null references trainers(id) on delete cascade,
  skill_id int not null references skills(id) on delete cascade,
  source text not null check (source in ('class', 'origin')),
  primary key (trainer_id, skill_id, source)
);

create index on trainer_base_skill_talents (trainer_id);

alter table trainer_base_skill_talents enable row level security;

-- Same owner-or-campaign-GM manage pattern as trainer_skill_talents/trainer_milestones.
create policy "Owner manages trainer_base_skill_talents" on trainer_base_skill_talents
  for all using (
    exists (select 1 from trainers t where t.id = trainer_base_skill_talents.trainer_id and t.user_id = auth.uid())
  ) with check (
    exists (select 1 from trainers t where t.id = trainer_base_skill_talents.trainer_id and t.user_id = auth.uid())
  );

create policy "GM manages campaign trainer_base_skill_talents" on trainer_base_skill_talents
  for all using (is_campaign_gm_for_trainer(trainer_id)) with check (is_campaign_gm_for_trainer(trainer_id));

-- Best-effort backfill for Trainers created before this table existed: trainer_skill_talents has no
-- record of which source granted which pick, so this infers it from whether the picked skill is on
-- the Trainer's *current* Class/Origin talent list. A skill that's eligible from both a base list and
-- an Advanced Class's own list (rare) can end up double-attributed here -- an acceptable ambiguity for
-- pre-existing data, not something worth reconstructing exactly.
insert into trainer_base_skill_talents (trainer_id, skill_id, source)
select distinct tst.trainer_id, tst.skill_id, 'class'
from trainer_skill_talents tst
join trainers t on t.id = tst.trainer_id
join classes_skill_talents cst on cst.class_id = t.class_id and cst.skill_id = tst.skill_id
on conflict do nothing;

insert into trainer_base_skill_talents (trainer_id, skill_id, source)
select distinct tst.trainer_id, tst.skill_id, 'origin'
from trainer_skill_talents tst
join trainers t on t.id = tst.trainer_id
join origins_skill_talent_groups og on og.origin_id = t.origin_id
join origins_skill_talent_group_options ogo on ogo.group_id = og.id and ogo.skill_id = tst.skill_id
on conflict do nothing;
