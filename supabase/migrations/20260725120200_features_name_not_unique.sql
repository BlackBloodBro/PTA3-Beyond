-- Feature names repeat across levels within the same class (e.g. Ace trainer gets "Stat increase"
-- at levels 3, 7, and 11; "Advanced class" similarly repeats) -- name alone can't be globally
-- unique. Replaced with a composite key that still prevents true duplicate rows.
alter table features drop constraint features_name_key;
alter table features add constraint features_name_class_subclass_level_key
  unique (name, class_id, subclass_id, level_required);
