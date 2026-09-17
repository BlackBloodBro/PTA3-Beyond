-- [[Feature - GM Custom - Skills]]: lets a GM add custom Trainer Skills scoped to their own Campaign,
-- alongside the global catalog -- same shape as every other "GM Custom X" sibling: one shared table
-- with a nullable campaign_id (null = global reference data, set = that Campaign's own custom Skill).
-- skills has no relation tables of its own to update -- classes_skill_talents/
-- subclasses_skill_talents/origins_skill_talent_group_options are all definitional data belonging to
-- always-global Classes/Subclasses/Origins, unreachable by any GM write path.

alter table skills add column campaign_id uuid references campaigns(id) on delete cascade;
create index on skills (campaign_id);

-- Replaces the flat unique(name) -- global names still can't collide with each other, but two
-- Campaigns (or a Campaign and the global catalog) can each freely have their own same-named custom
-- Skill.
alter table skills drop constraint skills_name_key;
create unique index skills_name_global_key on skills (name) where campaign_id is null;
create unique index skills_name_campaign_key on skills (campaign_id, name) where campaign_id is not null;

-- skills had its own standalone "Public read access" policy (20260725120000), not the generic loop --
-- same drop-and-replace treatment either way: global rows stay public-read, a Campaign's own custom
-- Skill is visible to that Campaign's GM + members only, and only that Campaign's GM can write it.
drop policy "Public read access" on skills;

create policy "Global skills are public-read" on skills
  for select using (campaign_id is null);

create policy "Campaign members can view their campaign's custom skills" on skills
  for select using (campaign_id is not null and is_campaign_member(campaign_id));

create policy "GM manages their campaign's custom skills" on skills
  for all using (campaign_id is not null and is_campaign_gm(campaign_id))
  with check (campaign_id is not null and is_campaign_gm(campaign_id));

-- Delete-in-use guard: unlike every other "GM Custom X" sibling so far, a Skill can be *actually
-- picked* by a real Trainer as a Skill Talent (the Handbook's Talented/+2, Expert/+5 system), tracked
-- across three places -- trainer_skill_talents/trainer_base_skill_talents (both skill_id on delete
-- cascade, so an unguarded delete would silently erase a real pick) and trainer_milestones'
-- talent_skill_id/bonus_talent_skill_id (no cascade -- a bare FK-restrict error otherwise). This
-- SECURITY DEFINER RPC bypasses RLS to count real usage across all four, matching the pattern already
-- proven for [[Feature - GM Custom - Afflictions]]/[[Feature - GM Custom - Moves]]/
-- [[Feature - GM Custom - Passives]].
create or replace function count_trainers_using_skill(target_skill_id int)
returns bigint
language sql
security definer
stable
set search_path = public
as $$
  select
    (select count(*) from trainer_skill_talents where skill_id = target_skill_id)
    + (select count(*) from trainer_base_skill_talents where skill_id = target_skill_id)
    + (select count(*) from trainer_milestones where talent_skill_id = target_skill_id)
    + (select count(*) from trainer_milestones where bonus_talent_skill_id = target_skill_id);
$$;
