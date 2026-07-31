-- Records the specific stat (for "Stat ace") or Pokemon type (for "Type ace") a trainer chose at
-- a given milestone. Stat ace itself stays 5 distinct subclass rows (their feature text differs
-- genuinely per stat -- different paired afflictions, different tutored moves -- not just a stat
-- name substitution), so chosen_stat is redundant with which of the 5 rows ended up in
-- advanced_class_N_id, but storing it explicitly means future code (e.g. auto-adding a move to a
-- Pokemon based on the trainer's favored stat) doesn't need to string-parse "Stat ace (attack)".
-- Type ace, on the other hand, is a single subclass row with no per-type variants -- chosen_type_id
-- is the only place that choice lives at all.
alter table trainer_milestones
  add column chosen_stat text check (chosen_stat in ('attack', 'defense', 'special_attack', 'special_defense', 'speed')),
  add column chosen_type_id int references types(id);
