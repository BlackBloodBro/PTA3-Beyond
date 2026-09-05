-- [[Improvement - Move Trainer editing (Name, Origin, Talents, Stats) to the build page]]: the
-- previous migration's backfill (20260905140000) inferred a base Class/Origin pick from whether a
-- currently-held skill is eligible from the Trainer's current Class/Origin list -- but a skill
-- actually granted by an Advanced Class milestone (trainer_milestones.talent_skill_id or
-- bonus_talent_skill_id) can also happen to be on that same base Class's flat list or the Origin's
-- own group list, over-attributing it as a base pick too. Confirmed against real data: a Level 11 Ace
-- trainer with 3 resolved milestones showed "3 / 2" Class Skill Talent picks after the backfill.
-- Milestone-granted picks are already recorded precisely elsewhere, so they're excluded outright here
-- rather than re-guessed at.
delete from trainer_base_skill_talents tbst
where exists (
  select 1 from trainer_milestones tm
  where tm.trainer_id = tbst.trainer_id
    and (tm.talent_skill_id = tbst.skill_id or tm.bonus_talent_skill_id = tbst.skill_id)
);
