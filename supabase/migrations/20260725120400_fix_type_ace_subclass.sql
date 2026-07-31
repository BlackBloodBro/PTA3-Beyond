-- "Type Ace" is one Advanced Class with an internal favored-type choice, not 18 separate
-- per-type subclasses -- the feature text confirms this directly: "When you become a Type Ace,
-- you will select one of the types... you must choose a different Favored Type each time" (if
-- retaken). The original Lists-sheet import modeled it as 18 rows (Type ace (bug) .. Type ace
-- (water)), which incorrectly let its 12 Advanced Class features (Favored type, Improved type
-- attacks, etc.) get mapped as base Ace trainer features -- meaning every Ace trainer would see
-- them regardless of whether they'd actually picked Type Ace. No trainer references any of the
-- 18 rows yet, so this is safe to collapse without breaking foreign keys.

delete from subclasses where name like 'Type ace (%)';

insert into subclasses (name, class_id)
values ('Type ace', (select id from classes where name = 'Ace trainer'));

update features
set subclass_id = (select id from subclasses where name = 'Type ace')
where class_id = (select id from classes where name = 'Ace trainer')
  and subclass_id is null
  and name in (
    'Favored type', 'Improved type attacks', 'Type resistance', 'Elemental metamorphosis',
    'Elemental grit', 'Type immunity', 'Type loyalty', 'Resistance piercing', 'Bread and butter',
    'Move molding', 'Type embrace', 'Elemental surge'
  );
