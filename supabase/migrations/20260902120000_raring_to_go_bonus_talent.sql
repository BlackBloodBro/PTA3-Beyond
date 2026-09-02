-- [[Origin - Raring to go has additional feature]]: at level 3, 7, or 11, a Raring to go Trainer may
-- take one additional Skill Talent from the Advanced Class they're gaining at that milestone, on top
-- of the one talent_skill_id (20260902110000_milestone_talent_skill.sql) already records. Same
-- reasoning for why this needs its own tracked column, not just a second call to
-- applySkillTalentPicks: saveMilestone's update branch needs to know which specific skill this
-- milestone granted to correctly replace it on a re-edit, not just add to the running total.
alter table trainer_milestones
  add column bonus_talent_skill_id int references skills(id);
