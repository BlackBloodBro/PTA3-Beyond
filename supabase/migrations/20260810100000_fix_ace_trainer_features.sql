-- Corrective fixes for Ace trainer Features, found while cross-checking the existing seeded rows
-- against the Player's Handbook PDF (pages 16-29) as part of [[Add all Class features to the list]]
-- (seeding Breeder/Coordinator/Ranger). User-confirmed fixes, one per discrepancy found.

-- 1. "Stat increase" + "Advanced class" were two separate, truncated rows at levels 3/7/11. The PDF
-- presents this as one combined feature, and both split DB rows were missing real rule text (the 1d4
-- max HP gain, the "or a different base Class" option, and the "only one at a time" constraint).
-- Replace the 6 split rows with 3 merged rows, one per level.
delete from features
where name in ('Stat increase', 'Advanced class')
  and class_id = (select id from classes where name = 'Ace trainer')
  and subclass_id is null
  and level_required in (3, 7, 11);

insert into features (name, description, class_id, subclass_id, level_required) values
  ('Stat increase and advanced class', 'Choose two different Trainer Stats to increase by 1, then gain 1d4 max HP. You only gain new stats at levels 3, 7, and 11. Choose an Ace Trainer Advanced Class or a different base Class. You can only ever gain a single Class or Advanced Class at a time, at level 3, level 7, and level 11', (select id from classes where name = 'Ace trainer'), null, 3),
  ('Stat increase and advanced class', 'Choose two different Trainer Stats to increase by 1, then gain 1d4 max HP. You only gain new stats at levels 3, 7, and 11. Choose an Ace Trainer Advanced Class or a different base Class. You can only ever gain a single Class or Advanced Class at a time, at level 3, level 7, and level 11', (select id from classes where name = 'Ace trainer'), null, 7),
  ('Stat increase and advanced class', 'Choose two different Trainer Stats to increase by 1, then gain 1d4 max HP. You only gain new stats at levels 3, 7, and 11. Choose an Ace Trainer Advanced Class or a different base Class. You can only ever gain a single Class or Advanced Class at a time, at level 3, level 7, and level 11', (select id from classes where name = 'Ace trainer'), null, 11);

-- 2. Name typo
update features set name = 'Constructive Criticism'
where name = 'Constructive critisicm' and class_id = (select id from classes where name = 'Ace trainer') and subclass_id is null and level_required = 4;

-- 3. Missing trailing clause
update features set description = 'Your Pokémon’s strength is inspired by your presence to push out a little more with every attack. Whenever your Pokémon hits with an attack, they deal additional damage equal to twice your Attack or Special Attack stat, regardless of which Attack or Special Attack modifier your Pokémon is adding to their attack respectively. Your Pokémon may also add either your twice your Attack or Special Attack modifier to attacks without a Damage value, to deal damage with those attacks (this feature does not replace Improved Attacks)'
where name = 'Grand master' and class_id = (select id from classes where name = 'Ace trainer') and subclass_id is null and level_required = 15;

-- 4. Strategist Adaptive boost: restore the 5 explicit stat options and the PDF's actual constraint wording
update features set description = 'After Spending time with your Pokémon, you’ve been able to urge more diverse tactical advantages out of the moves they already know. 3/week, after an hour of work with one of your Pokémon, you may permanently alter one of their Pokémon move effects to have one of the following abilities as long as it does not result in the move temporarily raising the same stat twice: "On hit, your Attack is +1 for 10 mins." "On hit, your Defense is +1 for 10 mins." "On hit, your Special Attack is +1 for 10 mins." "On hit, your Special Defense is +1 for 10 mins." "On hit, your Speed is +1 for 10 mins." If a Pokémon move that has already been altered by Adaptive Boost is changed again, replace the previously added effect with the new effect'
where name = 'Adaptive boost' and subclass_id = (select id from subclasses where name = 'Strategist') and level_required = 3;

-- 5. Strategist Weather vortex: restore the "third instance dismisses both" rule
update features set description = 'Whenever your Pokémon uses a Weather move and it overlaps another Weather effect on the field of battle, you may choose for the previous weather effect to remain while the new weather effect is also active. Whenever your Pokémon uses a Terrain move and it overlaps another Terrain effect on the field of battle, you may choose for the previous terrain effect to remain while the new terrain effect is also active. A third instance of weather or terrain overlapping either areas affected by Weather Vortex will dismiss the other two weather or terrain effects'
where name = 'Weather vortex' and subclass_id = (select id from subclasses where name = 'Strategist') and level_required = 10;

-- 6. Strategist Brute strategy: wrong name (description was already correct)
update features set name = 'Brute Strategy'
where name = 'Brute strength' and subclass_id = (select id from subclasses where name = 'Strategist') and level_required = 13;

-- 7. Type Ace Elemental metamorphosis: restore the single-type case
update features set description = 'Once per week, after eight hours of uninterrupted meditation with one of your Pokémon, they will permanently gain your favored type and gain move proficiency in your favored type. If your Pokémon has two types, permanently replace one of its types. If your Pokémon has a single type, it gains a second type. Your Pokémon’s physical appearance is altered appropriately and may continue to change over the next two weeks to adjust to its new typing. Your Pokémon’s change will only be successful if your Pokémon has at least loyalty 3. Without your influence, a Pokémon who underwent elemental metamorphosis might revert to their regular typing in the care of another trainer over time'
where name = 'Elemental metamorphosis' and class_id = (select id from classes where name = 'Ace trainer') and subclass_id is null and level_required = 3;

-- 8. Type Ace Resistance piercing: restore the Type Immunity interaction clause
update features set description = 'Your training has empowered your Pokémon’s attacks to break through your foe’s natural resistances. 3/day when your Pokémon hits with an attack with the same type as your favored type, the attack ignores any resistances or immunities. (If a Pokémon is benefitting from the Ace Trainer feature: Type Immunity, your Pokémon’s attack is treated as resisted in this case.)'
where name = 'Resistance piercing' and class_id = (select id from classes where name = 'Ace trainer') and subclass_id is null and level_required = 8;

-- 9. Strategist Quick set: restore "effect" moves wording
update features set description = 'Your Pokémon are training in order to quickly set the stage of battle in order to maximize your chances of victory. 3/day you can have one of your Pokémon during their turn use two effect moves as one action if they are both Coat, Hazard, Terrain, Wall, and/or Weather moves'
where name = 'Quick set' and subclass_id = (select id from subclasses where name = 'Strategist') and level_required = 2;

-- 10. Underdog Champ in the making: cosmetic spacing typo
update features set description = 'Your intensive training has improved the general being of your underdog Pokémon. 3/day as an action choose one of your Underdog Pokémon that has not been targeted by this feature today gains 12 temporary HP. The temporary HP lasts for up to 1 hour'
where name = 'Champ in the making' and subclass_id = (select id from subclasses where name = 'Underdog') and level_required = 6;
