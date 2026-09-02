-- [[Class can't be edited when editing subclass or level]]: re-editing an already-resolved milestone
-- silently left its Skill Talent pick untouched (or hid the field entirely -- see the deliberate
-- "resolved cards get an empty skillTalentOptionsByChoice" precedent this replaces), because there
-- was no way to know which skill a specific milestone had granted -- only the trainer-wide running
-- total in trainer_skill_talents.picked_count. Recording it here lets saveMilestone's update branch
-- undo the old pick and apply the new one ("replace," not "add," semantics), and lets the Class
-- Builder pre-fill + correctly re-offer the currently-chosen skill on re-edit.
--
-- Nullable: a milestone whose Advanced Class had every eligible skill already at the 2-pick cap from
-- elsewhere shows no Skill Talent field at all (see AdvancedClassPicker), so there's nothing to record.
alter table trainer_milestones
  add column talent_skill_id int references skills(id);
