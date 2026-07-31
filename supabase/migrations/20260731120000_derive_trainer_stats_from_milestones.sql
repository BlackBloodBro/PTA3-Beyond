-- Fixes the level-down bug: stat increases and advanced classes granted by resolveMilestone were
-- raw-mutated columns with no way back when a trainer's level dropped below the milestone that
-- granted them. This migration makes trainer_milestones the single source of truth: stat/advanced-
-- class/max-HP totals are now derived fresh from (level, trainer_milestones) on every read, never
-- stored as a running total. See lib/pta3/trainerFeatures.ts for the derivation helpers.

-- 1. Rename the 5 stat columns to make clear they now hold ONLY the point-buy base, never a running
-- total -- a silent meaning change on the same column name is exactly the kind of drift this fix is
-- meant to eliminate, so every call site has to be touched deliberately (the old names now 404 at
-- compile time instead of silently reading a redefined value).
alter table trainers rename column attack to base_attack;
alter table trainers rename column defense to base_defense;
alter table trainers rename column special_attack to base_special_attack;
alter table trainers rename column special_defense to base_special_defense;
alter table trainers rename column speed to base_speed;

-- 2. Backfill true base values. Today's stored value already includes every +1 a resolved milestone
-- ever granted (resolveMilestone wrote `trainer[stat] + 1` directly), so subtract however many
-- trainer_milestones rows named this stat as stat_a/stat_b -- the same reconstruction the trainer
-- page's Stats tooltip already did to display a "Base:" line.
update trainers t set
  base_attack = base_attack - (select count(*) from trainer_milestones tm where tm.trainer_id = t.id and (tm.stat_a = 'attack' or tm.stat_b = 'attack')),
  base_defense = base_defense - (select count(*) from trainer_milestones tm where tm.trainer_id = t.id and (tm.stat_a = 'defense' or tm.stat_b = 'defense')),
  base_special_attack = base_special_attack - (select count(*) from trainer_milestones tm where tm.trainer_id = t.id and (tm.stat_a = 'special_attack' or tm.stat_b = 'special_attack')),
  base_special_defense = base_special_defense - (select count(*) from trainer_milestones tm where tm.trainer_id = t.id and (tm.stat_a = 'special_defense' or tm.stat_b = 'special_defense')),
  base_speed = base_speed - (select count(*) from trainer_milestones tm where tm.trainer_id = t.id and (tm.stat_a = 'speed' or tm.stat_b = 'speed'));

-- 3. Max HP becomes fully computed (BASE_MAX_HP + MILESTONE_HP_GAIN per qualifying milestone) --
-- same "never stored" treatment Pokemon max HP already gets (base_hp + ev_hp * 6, computed inline,
-- no column). current_hp stays: it's genuine mutable state, not derivable from level.
alter table trainers drop column max_hp;

-- 4. The 3 advanced-class slot columns are now fully superseded by trainer_milestones (each row
-- already records which subclass was granted and at what level) -- and the legacy single
-- trainers.subclass_id column from the very first migration was already dead (nothing in the app
-- reads it; superseded by the 3-slot columns before those were themselves superseded here).
alter table trainers drop column advanced_class_1_id;
alter table trainers drop column advanced_class_2_id;
alter table trainers drop column advanced_class_3_id;
alter table trainers drop column subclass_id;
