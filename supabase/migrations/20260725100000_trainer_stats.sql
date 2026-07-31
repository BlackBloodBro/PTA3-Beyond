-- Trainers have their own stats, per the Player's Handbook's "Trainer Stats and Skills" section
-- (pages 6-11): the same 5 stats Pokemon use (Attack/Defense/Special Attack/Special Defense/Speed,
-- 1-6 at creation, modifier = floor(value/2)), plus HP that always starts at 20 for a level-1
-- trainer (rising by 1d4 at levels 3/7/11 -- not modeled here, that's a leveling-time action, not
-- a creation-time one).
--
-- Point-buy cost validation (1->1, 2->2, 3->3, 4->6, 5->8, 6->11 points, 25-point budget) is
-- enforced in the application layer at creation time, not as a DB constraint -- consistent with
-- how other business rules (max 3 stat passives, etc.) have been handled so far. The 1-6 range
-- itself is enforced here since it's a simple, permanent invariant for a freshly created trainer.
alter table trainers
  add column attack int not null default 1 check (attack between 1 and 6),
  add column defense int not null default 1 check (defense between 1 and 6),
  add column special_attack int not null default 1 check (special_attack between 1 and 6),
  add column special_defense int not null default 1 check (special_defense between 1 and 6),
  add column speed int not null default 1 check (speed between 1 and 6),
  add column max_hp int not null default 20,
  add column current_hp int not null default 20;
