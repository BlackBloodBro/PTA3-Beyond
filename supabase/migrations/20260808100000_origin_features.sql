-- Origin features: same features table, not a new parallel one (per FR decision) -- an Origin's
-- feature is unlocked immediately on choosing that Origin, no level gate, no player choice, rendered
-- in the same Passive Features section Class passives already use. class_id loosens to nullable so a
-- row can be either class-scoped or origin-scoped (never both).
alter table features
  add column origin_id int references origins(id) on delete cascade,
  alter column class_id drop not null;

alter table features drop constraint features_name_class_subclass_level_key;
alter table features add constraint features_name_class_subclass_origin_level_key
  unique (name, class_id, subclass_id, origin_id, level_required);
